import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { z, ZodError } from 'zod'
import {
  MODELS,
  PET_FLAT_L,
  PRESENCE_MULT,
  SOURCE_COST_TL_PER_L,
  TAP_TARIFF_TL_PER_L,
  TIME_CAP_DAYS,
  USE_COEFF,
} from '../../../mobile/src/lib/calc.ts'
import { hashToken, newToken } from '../auth.ts'
import { tx, type DB } from '../db.ts'
import type { PushSender } from '../push.ts'
import { generateDevices, importDevices, isKnownModel } from '../provision.ts'
import type { PassResult } from '../scheduler.ts'
import { serviceRequestActionBody } from '../schema.ts'
import { getDevice, toServiceRequestDTO, type DeviceRow, type ServiceRequestRow } from '../state.ts'
import { SERVICE_STATUS_LABEL, type ServiceStatus } from '../../../mobile/src/lib/service.ts'
import type { SchedulerStatus } from '../status.ts'
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './password.ts'
import {
  deviceDetail,
  deviceStatus,
  listDevices,
  listServiceRequests,
  notificationKind,
  overview,
} from './queries.ts'

const COOKIE = 'mk_admin'
const SESSION_TTL_MS = 12 * 3600 * 1000
const LOGIN_MAX_FAILS = 5
const LOGIN_LOCK_MS = 15 * 60 * 1000

export interface AdminAppOptions {
  db: DB
  now?: () => number
  send: PushSender
  /** Bildirim turunu şimdi çalıştırır (zamanlayıcıyla aynı fonksiyon) */
  tick: () => Promise<PassResult>
  status: SchedulerStatus
  version?: string
  secureCookies?: boolean
  trustProxy?: boolean
  logger?: boolean
  staticDir?: string
}

interface AdminCtx {
  adminId: number
  username: string
  sessionId: number
}

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminCtx
  }
}

const idParam = z.object({ id: z.coerce.number().int().positive() })

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, 'Kullanıcı adı 3-32 karakter: harf, rakam, . _ -')

const actionBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('revoke_sessions') }),
  z.object({ type: z.literal('reset_activation') }),
  z.object({ type: z.literal('block'), reason: z.string().trim().max(200).optional() }),
  z.object({ type: z.literal('unblock') }),
  z.object({ type: z.literal('replace_filter') }),
  z.object({ type: z.literal('send_push'), title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(240) }),
  z.object({ type: z.literal('set_note'), note: z.string().trim().max(500) }),
  z.object({ type: z.literal('set_model'), modelId: z.string() }),
])

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function httpError(statusCode: number, code: string): Error {
  return Object.assign(new Error(code), { statusCode, code })
}

export async function buildAdminApp(opts: AdminAppOptions): Promise<FastifyInstance> {
  const { db } = opts
  const now = opts.now ?? Date.now
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: opts.trustProxy ?? false, bodyLimit: 256 * 1024 })
  await app.register(rateLimit, { global: false })

  const lockouts = new Map<string, { fails: number; until: number }>()

  const audit = (admin: string | null, action: string, deviceId: number | null, detail?: string | null) => {
    db.prepare('INSERT INTO audit_log (at, admin_name, action, device_id, detail) VALUES (?, ?, ?, ?, ?)').run(
      now(),
      admin,
      action,
      deviceId,
      detail ?? null,
    )
  }

  // --- Güvenlik başlıkları (statik dosyalar dahil tüm yanıtlar)
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    )
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
  })

  // --- CSRF: durum değiştiren isteklerde özel başlık + aynı origin
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return
    if (req.headers['x-panel'] !== '1') throw httpError(403, 'csrf')
    const origin = req.headers.origin
    if (origin) {
      let host = ''
      try {
        host = new URL(origin).host
      } catch {
        throw httpError(403, 'csrf')
      }
      if (host !== req.headers.host) throw httpError(403, 'csrf')
    }
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: err.issues[0]?.message,
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
    const e = err as { statusCode?: number; code?: string; message?: string }
    const status = e.statusCode ?? 500
    if (status >= 500) req.log.error(err)
    const code = status === 429 ? 'rate_limited' : status >= 500 ? 'internal_error' : (e.code ?? 'bad_request')
    return reply.code(status).send({ error: code })
  })

  const requireAdmin = async (req: FastifyRequest) => {
    const token = parseCookies(req.headers.cookie)[COOKIE]
    if (!token) throw httpError(401, 'unauthorized')
    const row = db
      .prepare(
        `SELECT s.id AS sid, s.expires_at, a.id AS aid, a.username
         FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?`,
      )
      .get(hashToken(token)) as { sid: number; expires_at: number; aid: number; username: string } | undefined
    if (!row || row.expires_at < now()) {
      if (row) db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(row.sid)
      throw httpError(401, 'unauthorized')
    }
    req.admin = { adminId: row.aid, username: row.username, sessionId: row.sid }
  }
  const auth = { preHandler: requireAdmin }

  const setCookie = (reply: FastifyReply, value: string, maxAgeSec: number) => {
    reply.header(
      'Set-Cookie',
      `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${opts.secureCookies ? '; Secure' : ''}`,
    )
  }

  const deviceOr404 = (id: number): DeviceRow => {
    try {
      return getDevice(db, id)
    } catch {
      throw httpError(404, 'not_found')
    }
  }

  // ------------------------------------------------------------------ oturum
  app.post(
    '/api/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = z.object({ username: z.string().max(64), password: z.string().max(200) }).parse(req.body)
      const username = body.username.trim().toLowerCase()
      let lock = lockouts.get(username)
      if (lock && lock.until > now()) throw httpError(429, 'locked')
      if (lock && lock.until !== 0) lock = undefined // kilit süresi doldu, sayaç sıfırdan

      const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username) as
        | { id: number; username: string; password_hash: string }
        | undefined
      // Kullanıcı yoksa da hash hesaplanır (zamanlama farkından kullanıcı adı sızmasın)
      const ok = admin
        ? await verifyPassword(body.password, admin.password_hash)
        : (await verifyPassword(body.password, DUMMY_HASH), false)

      if (!ok || !admin) {
        const fails = (lock?.fails ?? 0) + 1
        lockouts.set(username, { fails, until: fails >= LOGIN_MAX_FAILS ? now() + LOGIN_LOCK_MS : 0 })
        audit(username, 'login_failed', null, req.ip)
        throw httpError(401, 'invalid_credentials')
      }
      lockouts.delete(username)

      const t = now()
      const { token, hash } = newToken()
      db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(t)
      db.prepare('INSERT INTO admin_sessions (admin_id, token_hash, created_at, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?)').run(
        admin.id,
        hash,
        t,
        t + SESSION_TTL_MS,
        req.ip,
        String(req.headers['user-agent'] ?? '').slice(0, 200),
      )
      db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(t, admin.id)
      audit(admin.username, 'login', null, req.ip)
      setCookie(reply, token, SESSION_TTL_MS / 1000)
      return { admin: { username: admin.username } }
    },
  )

  app.get('/api/session', auth, async (req) => ({ admin: { username: req.admin!.username }, serverTime: now() }))

  app.post('/api/logout', auth, async (req, reply) => {
    db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(req.admin!.sessionId)
    audit(req.admin!.username, 'logout', null)
    setCookie(reply, '', 0)
    return reply.code(204).send()
  })

  app.post('/api/password', auth, async (req, reply) => {
    const body = z
      .object({
        current: z.string().max(200),
        next: z.string().min(MIN_PASSWORD_LENGTH, `Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı`).max(200),
      })
      .parse(req.body)
    const row = db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(req.admin!.adminId) as { password_hash: string }
    if (!(await verifyPassword(body.current, row.password_hash))) throw httpError(400, 'wrong_password')
    const hash = await hashPassword(body.next)
    tx(db, () => {
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, req.admin!.adminId)
      // Diğer oturumlar kapanır, bu oturum kalır
      db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND id <> ?').run(req.admin!.adminId, req.admin!.sessionId)
    })
    audit(req.admin!.username, 'password_changed', null)
    return reply.code(204).send()
  })

  // ---------------------------------------------------------------- yöneticiler
  app.get('/api/admins', auth, async () => ({
    admins: (
      db.prepare('SELECT id, username, created_at, last_login_at FROM admins ORDER BY id').all() as {
        id: number
        username: string
        created_at: number
        last_login_at: number | null
      }[]
    ).map((a) => ({ id: a.id, username: a.username, createdAt: a.created_at, lastLoginAt: a.last_login_at })),
  }))

  app.post('/api/admins', auth, async (req) => {
    const body = z.object({ username: usernameSchema }).parse(req.body)
    if (db.prepare('SELECT 1 FROM admins WHERE username = ?').get(body.username)) throw httpError(409, 'username_taken')
    const password = generatePassword()
    db.prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)').run(
      body.username,
      await hashPassword(password),
      now(),
    )
    audit(req.admin!.username, 'admin_created', null, body.username)
    // Parola yalnızca bu yanıtta bir kez gösterilir
    return { username: body.username, password }
  })

  app.delete('/api/admins/:id', auth, async (req, reply) => {
    const { id } = idParam.parse(req.params)
    if (id === req.admin!.adminId) throw httpError(400, 'cannot_delete_self')
    const row = db.prepare('SELECT username FROM admins WHERE id = ?').get(id) as { username: string } | undefined
    if (!row) throw httpError(404, 'not_found')
    db.prepare('DELETE FROM admins WHERE id = ?').run(id)
    audit(req.admin!.username, 'admin_deleted', null, row.username)
    return reply.code(204).send()
  })

  // ------------------------------------------------------------------- genel bakış
  app.get('/api/overview', auth, async () => ({
    ...overview(db, now()),
    scheduler: opts.status,
    recentNotifications: (
      db
        .prepare(
          `SELECT n.key, n.sent_at, n.title, n.body, d.id AS device_id, d.serial_no
           FROM notification_log n JOIN devices d ON d.id = n.device_id
           WHERE n.delivered = 1 ORDER BY n.sent_at DESC LIMIT 6`,
        )
        .all() as { key: string; sent_at: number; title: string | null; body: string | null; device_id: number; serial_no: string }[]
    ).map((n) => ({ kind: notificationKind(n.key), at: n.sent_at, title: n.title, body: n.body, deviceId: n.device_id, serialNo: n.serial_no })),
  }))

  // ------------------------------------------------------------------- cihazlar
  app.get('/api/devices', auth, async (req) => {
    const q = z
      .object({
        q: z.string().max(80).optional(),
        status: z.string().optional(),
        model: z.string().optional(),
        tone: z.string().optional(),
        sort: z.string().optional(),
        dir: z.enum(['asc', 'desc']).optional(),
        page: z.coerce.number().int().optional(),
        pageSize: z.coerce.number().int().optional(),
      })
      .parse(req.query)
    return listDevices(db, q, now())
  })

  app.get('/api/devices/:id', auth, async (req) => {
    const { id } = idParam.parse(req.params)
    return deviceDetail(db, deviceOr404(id), now())
  })

  app.get('/api/devices/:id/code', auth, async (req) => {
    const { id } = idParam.parse(req.params)
    const row = deviceOr404(id)
    audit(req.admin!.username, 'reveal_code', id)
    return { code: row.activation_code }
  })

  app.post('/api/devices/:id/action', auth, async (req) => {
    const { id } = idParam.parse(req.params)
    const body = actionBody.parse(req.body)
    const row = deviceOr404(id)
    const who = req.admin!.username
    const t = now()

    switch (body.type) {
      case 'revoke_sessions': {
        const n = db.prepare('DELETE FROM sessions WHERE device_id = ?').run(id).changes
        audit(who, 'revoke_sessions', id, `${n} oturum`)
        break
      }
      case 'reset_activation': {
        tx(db, () => {
          db.prepare(
            `UPDATE devices SET activated_at = NULL, filter_installed_at = NULL, onboarded_at = NULL,
             household = NULL, notif = NULL WHERE id = ?`,
          ).run(id)
          db.prepare('DELETE FROM sessions WHERE device_id = ?').run(id)
          db.prepare('DELETE FROM notification_log WHERE device_id = ?').run(id)
        })
        audit(who, 'reset_activation', id)
        break
      }
      case 'block': {
        tx(db, () => {
          db.prepare('UPDATE devices SET blocked_at = ? WHERE id = ?').run(t, id)
          db.prepare('DELETE FROM sessions WHERE device_id = ?').run(id)
        })
        audit(who, 'block', id, body.reason)
        break
      }
      case 'unblock': {
        db.prepare('UPDATE devices SET blocked_at = NULL WHERE id = ?').run(id)
        audit(who, 'unblock', id)
        break
      }
      case 'replace_filter': {
        if (row.onboarded_at === null) throw httpError(409, 'not_onboarded')
        db.prepare('UPDATE devices SET filter_installed_at = ? WHERE id = ?').run(t, id)
        audit(who, 'replace_filter', id)
        break
      }
      case 'set_note': {
        db.prepare('UPDATE devices SET note = ? WHERE id = ?').run(body.note || null, id)
        audit(who, 'set_note', id)
        break
      }
      case 'set_model': {
        if (!isKnownModel(body.modelId)) throw httpError(400, 'unknown_model')
        db.prepare('UPDATE devices SET model_id = ? WHERE id = ?').run(body.modelId, id)
        audit(who, 'set_model', id, `${row.model_id} → ${body.modelId}`)
        break
      }
      case 'send_push': {
        const tokens = db
          .prepare('SELECT id, push_token FROM sessions WHERE device_id = ? AND push_token IS NOT NULL')
          .all(id) as { id: number; push_token: string }[]
        if (tokens.length === 0) throw httpError(409, 'no_push_token')
        const results = await opts.send(
          tokens.map((x) => ({ to: x.push_token, title: body.title, body: body.body, data: { type: 'manual', screen: 'home' } })),
        )
        results.forEach((r, i) => {
          if (r.invalidToken) db.prepare('UPDATE sessions SET push_token = NULL WHERE id = ?').run(tokens[i]!.id)
        })
        const delivered = results.some((r) => r.ok)
        db.prepare(
          'INSERT INTO notification_log (device_id, key, sent_at, delivered, title, body) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(id, `manual:${t}:${randomBytes(3).toString('hex')}`, t, delivered ? 1 : 0, body.title, body.body)
        audit(who, 'send_push', id, `${results.filter((r) => r.ok).length}/${results.length} iletildi`)
        return { ok: delivered, sent: results.filter((r) => r.ok).length, total: results.length, detail: deviceDetail(db, getDevice(db, id), now()) }
      }
    }
    return { ok: true, detail: deviceDetail(db, getDevice(db, id), now()) }
  })

  app.delete('/api/devices/:id', auth, async (req, reply) => {
    const { id } = idParam.parse(req.params)
    const { confirm } = z.object({ confirm: z.string() }).parse(req.query)
    const row = deviceOr404(id)
    if (confirm !== row.serial_no) throw httpError(400, 'confirm_mismatch')
    db.prepare('DELETE FROM devices WHERE id = ?').run(id)
    audit(req.admin!.username, 'delete_device', null, `${row.serial_no} (${deviceStatus(row)})`)
    return reply.code(204).send()
  })

  // ----------------------------------------------------------- aktivasyon kodları
  app.post('/api/provision', auth, async (req) => {
    const body = z
      .object({ model: z.string(), count: z.number().int().min(1).max(500) })
      .parse(req.body)
    if (!isKnownModel(body.model)) throw httpError(400, 'unknown_model')
    const items = tx(db, () => generateDevices(db, body.model, body.count, now()))
    audit(req.admin!.username, 'provision', null, `${body.count} × ${body.model}`)
    return { model: body.model, items }
  })

  app.post('/api/provision/import', auth, async (req) => {
    const body = z.object({ text: z.string().max(200_000), model: z.string() }).parse(req.body)
    if (!isKnownModel(body.model)) throw httpError(400, 'unknown_model')
    const r = tx(db, () => importDevices(db, body.text, body.model, now()))
    audit(req.admin!.username, 'import_codes', null, `+${r.added}, tekrar ${r.duplicates}, geçersiz ${r.invalid.length}`)
    return r
  })

  app.get('/api/provision/export', auth, async (req, reply) => {
    const { scope } = z.object({ scope: z.enum(['pending', 'all']).default('pending') }).parse(req.query)
    const rows = db
      .prepare(
        `SELECT activation_code, serial_no, model_id, activated_at, blocked_at FROM devices
         ${scope === 'pending' ? 'WHERE activated_at IS NULL AND blocked_at IS NULL' : ''} ORDER BY id`,
      )
      .all() as { activation_code: string; serial_no: string; model_id: string; activated_at: number | null; blocked_at: number | null }[]
    const csv =
      'kod,seri_no,model,durum\n' +
      rows
        .map((r) => `${r.activation_code},${r.serial_no},${r.model_id},${r.blocked_at ? 'engelli' : r.activated_at ? 'aktive' : 'bekliyor'}`)
        .join('\n') +
      '\n'
    audit(req.admin!.username, 'export_codes', null, `${scope}: ${rows.length} kod`)
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="mukansa-kodlar-${scope}.csv"`)
    return csv
  })

  // ------------------------------------------------------------------ bildirimler
  app.get('/api/notifications', auth, async (req) => {
    const q = z
      .object({
        kind: z.string().optional(),
        delivered: z.enum(['0', '1']).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
        before: z.coerce.number().int().optional(),
      })
      .parse(req.query)
    const rows = db
      .prepare(
        `SELECT n.key, n.sent_at, n.delivered, n.title, n.body, d.id AS device_id, d.serial_no
         FROM notification_log n JOIN devices d ON d.id = n.device_id
         WHERE n.title IS NOT NULL AND (? IS NULL OR n.sent_at < ?) AND (? IS NULL OR n.delivered = ?)
         ORDER BY n.sent_at DESC, n.rowid DESC LIMIT 400`,
      )
      .all(q.before ?? null, q.before ?? null, q.delivered ?? null, q.delivered ? Number(q.delivered) : null) as {
      key: string
      sent_at: number
      delivered: number
      title: string
      body: string
      device_id: number
      serial_no: string
    }[]
    const items = rows
      .map((n) => ({ kind: notificationKind(n.key), at: n.sent_at, delivered: n.delivered === 1, title: n.title, body: n.body, deviceId: n.device_id, serialNo: n.serial_no }))
      .filter((n) => !q.kind || q.kind === 'all' || n.kind === q.kind)
      .slice(0, q.limit)
    return { items }
  })

  // ------------------------------------------------------------- servis talepleri
  app.get('/api/service-requests', auth, async (req) => {
    const q = z
      .object({
        status: z.string().optional(),
        page: z.coerce.number().int().optional(),
        pageSize: z.coerce.number().int().optional(),
      })
      .parse(req.query)
    return listServiceRequests(db, q)
  })

  app.post('/api/service-requests/:id/action', auth, async (req) => {
    const { id } = idParam.parse(req.params)
    const body = serviceRequestActionBody.parse(req.body)
    const existing = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id) as unknown as ServiceRequestRow | undefined
    if (!existing) throw httpError(404, 'not_found')
    const t = now()
    const statusChanged = !!body.status && body.status !== existing.status
    if (body.status) db.prepare('UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?').run(body.status, t, id)
    if (body.adminNote !== undefined) db.prepare('UPDATE service_requests SET admin_note = ?, updated_at = ? WHERE id = ?').run(body.adminNote || null, t, id)
    audit(
      req.admin!.username,
      'service_request_update',
      existing.device_id,
      [body.status ? `durum → ${body.status}` : null, body.adminNote !== undefined ? 'not güncellendi' : null].filter(Boolean).join(', '),
    )
    if (statusChanged) {
      const tokens = db
        .prepare('SELECT id, push_token FROM sessions WHERE device_id = ? AND push_token IS NOT NULL')
        .all(existing.device_id) as { id: number; push_token: string }[]
      if (tokens.length > 0) {
        const title = 'Servis talebiniz güncellendi'
        const pushBody = `Durum: ${SERVICE_STATUS_LABEL[body.status as ServiceStatus]}${body.adminNote ? ` — ${body.adminNote}` : ''}`
        const results = await opts.send(
          tokens.map((x) => ({
            to: x.push_token,
            title,
            body: pushBody,
            data: { type: 'service_request', screen: 'device', requestId: id },
          })),
        )
        results.forEach((r, i) => {
          if (r.invalidToken) db.prepare('UPDATE sessions SET push_token = NULL WHERE id = ?').run(tokens[i]!.id)
        })
        const delivered = results.some((r) => r.ok)
        db.prepare(
          'INSERT INTO notification_log (device_id, key, sent_at, delivered, title, body) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(existing.device_id, `service:${id}:${t}:${randomBytes(3).toString('hex')}`, t, delivered ? 1 : 0, title, pushBody)
      }
    }
    const updated = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id) as unknown as ServiceRequestRow
    return toServiceRequestDTO(updated)
  })

  // ------------------------------------------------------------ denetim günlüğü
  app.get('/api/audit', auth, async (req) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(300).default(100) }).parse(req.query)
    const rows = db
      .prepare(
        `SELECT a.id, a.at, a.admin_name, a.action, a.device_id, a.detail, d.serial_no
         FROM audit_log a LEFT JOIN devices d ON d.id = a.device_id ORDER BY a.at DESC, a.id DESC LIMIT ?`,
      )
      .all(q.limit) as { id: number; at: number; admin_name: string | null; action: string; device_id: number | null; detail: string | null; serial_no: string | null }[]
    return { items: rows.map((r) => ({ id: r.id, at: r.at, admin: r.admin_name, action: r.action, deviceId: r.device_id, serialNo: r.serial_no, detail: r.detail })) }
  })

  // ---------------------------------------------------------------------- sistem
  app.get('/api/system', auth, async () => {
    const pages = db.prepare('PRAGMA page_count').get() as { page_count: number }
    const size = db.prepare('PRAGMA page_size').get() as { page_size: number }
    return {
      version: opts.version ?? 'dev',
      node: process.version,
      uptimeSec: Math.round(process.uptime()),
      dbBytes: pages.page_count * size.page_size,
      scheduler: opts.status,
      serverTime: now(),
    }
  })

  app.post('/api/system/tick', auth, async (req) => {
    const r = await opts.tick()
    audit(req.admin!.username, 'run_scheduler', null, `${r.sent} bildirim`)
    return { result: r, scheduler: opts.status }
  })

  app.get('/api/config', auth, async () => ({
    models: Object.values(MODELS),
    useCoeff: USE_COEFF,
    petFlatL: PET_FLAT_L,
    presenceMult: PRESENCE_MULT,
    timeCapDays: TIME_CAP_DAYS,
    sourceCostTlPerL: SOURCE_COST_TL_PER_L,
    tapTariffTlPerL: TAP_TARIFF_TL_PER_L,
  }))

  // ------------------------------------------------------------------- statik panel
  await app.register(fastifyStatic, {
    root: opts.staticDir ?? join(import.meta.dirname, '../../admin/public'),
    index: 'index.html',
    cacheControl: true,
    maxAge: '5m',
  })

  return app
}

// Kullanıcı adı yokken zamanlamayı eşitlemek için geçerli biçimde sahte hash
const DUMMY_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(32).toString('base64')}`
