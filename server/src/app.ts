import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { hashToken, newToken } from './auth.ts'
import { normalizeCode } from './codes.ts'
import { tx, type DB } from './db.ts'
import {
  activateBody,
  filterReplaceBody,
  onboardingBody,
  profileBody,
  pushTokenBody,
  serviceRequestBody,
} from './schema.ts'
import { getDevice, toServiceRequestDTO, toState, type DeviceRow, type ServiceRequestRow } from './state.ts'

const MAX_SESSIONS_PER_DEVICE = 10
// last_seen_at her istekte yazılmaz
const LAST_SEEN_GRANULARITY_MS = 60 * 60 * 1000

export interface AppOptions {
  db: DB
  now?: () => number
  trustProxy?: boolean
  logger?: boolean
  corsOrigins?: string[]
}

interface Auth {
  sessionId: number
  device: DeviceRow
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: Auth
  }
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db } = opts
  const now = opts.now ?? Date.now
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: opts.trustProxy ?? false,
    bodyLimit: 16 * 1024,
  })

  await app.register(rateLimit, { global: false })
  if (opts.corsOrigins?.length) {
    await app.register(cors, {
      origin: opts.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    })
  }

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid_request',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) req.log.error(err)
    const error = status === 401 ? 'unauthorized' : status === 403 ? 'device_blocked' : status === 429 ? 'rate_limited' : status >= 500 ? 'internal_error' : 'bad_request'
    return reply.code(status).send({ error })
  })

  const requireAuth = async (req: FastifyRequest) => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const unauthorized = () => Object.assign(new Error('unauthorized'), { statusCode: 401 })
    if (!token) throw unauthorized()
    const session = db
      .prepare('SELECT id, device_id, last_seen_at FROM sessions WHERE token_hash = ?')
      .get(hashToken(token)) as { id: number; device_id: number; last_seen_at: number } | undefined
    if (!session) throw unauthorized()
    const t = now()
    if (t - session.last_seen_at > LAST_SEEN_GRANULARITY_MS) {
      db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(t, session.id)
    }
    const device = getDevice(db, session.device_id)
    if (device.blocked_at !== null) {
      throw Object.assign(new Error('device_blocked'), { statusCode: 403 })
    }
    req.auth = { sessionId: session.id, device }
  }

  app.get('/health', async () => ({ ok: true, time: now() }))

  app.post(
    '/v1/activate',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = activateBody.parse(req.body)
      const code = normalizeCode(body.code)
      const row = code
        ? (db.prepare('SELECT * FROM devices WHERE activation_code = ?').get(code) as unknown as
            | DeviceRow
            | undefined)
        : undefined
      if (!row) return reply.code(404).send({ error: 'invalid_code' })
      if (row.blocked_at !== null) return reply.code(403).send({ error: 'device_blocked' })

      const t = now()
      const { token, hash } = newToken()
      tx(db, () => {
        if (row.activated_at === null) {
          // Cihaz ilk kez aktive ediliyor: garanti ve ilk kartuş bu andan itibaren
          db.prepare('UPDATE devices SET activated_at = ?, filter_installed_at = ? WHERE id = ?').run(t, t, row.id)
        }
        db.prepare(
          'INSERT INTO sessions (device_id, token_hash, created_at, last_seen_at, platform) VALUES (?, ?, ?, ?, ?)',
        ).run(row.id, hash, t, t, body.platform ?? null)
        db.prepare(
          `DELETE FROM sessions WHERE device_id = ? AND id NOT IN (
             SELECT id FROM sessions WHERE device_id = ? ORDER BY last_seen_at DESC, id DESC LIMIT ?)`,
        ).run(row.id, row.id, MAX_SESSIONS_PER_DEVICE)
      })
      return { token, state: toState(getDevice(db, row.id), t) }
    },
  )

  app.get('/v1/me', { preHandler: requireAuth }, async (req) => toState(req.auth!.device, now()))

  app.put('/v1/profile', { preHandler: requireAuth }, async (req) => {
    const body = profileBody.parse(req.body)
    const id = req.auth!.device.id
    tx(db, () => {
      if (body.household) {
        db.prepare('UPDATE devices SET household = ? WHERE id = ?').run(JSON.stringify(body.household), id)
      }
      if (body.notif) {
        db.prepare('UPDATE devices SET notif = ? WHERE id = ?').run(JSON.stringify(body.notif), id)
      }
    })
    return toState(getDevice(db, id), now())
  })

  app.post('/v1/onboarding', { preHandler: requireAuth }, async (req) => {
    const body = onboardingBody.parse(req.body)
    const id = req.auth!.device.id
    db.prepare(
      'UPDATE devices SET household = ?, notif = ?, onboarded_at = COALESCE(onboarded_at, ?) WHERE id = ?',
    ).run(JSON.stringify(body.household), JSON.stringify(body.notif), now(), id)
    return toState(getDevice(db, id), now())
  })

  app.post('/v1/filter/replace', { preHandler: requireAuth }, async (req) => {
    const body = filterReplaceBody.parse(req.body ?? {})
    const device = req.auth!.device
    const t = now()
    // Gelecek tarih olamaz (küçük saat sapması now'a sıkıştırılır)
    const replacedAt = Math.min(body.replacedAt ?? t, t)
    const current = device.filter_installed_at ?? device.activated_at ?? 0
    // Aynı/eski değişim tekrar gelirse (offline kuyruk yeniden denemesi) idempotent: değişiklik yok
    if (replacedAt > current) {
      db.prepare('UPDATE devices SET filter_installed_at = ? WHERE id = ?').run(replacedAt, device.id)
    }
    return toState(getDevice(db, device.id), t)
  })

  app.put('/v1/push-token', { preHandler: requireAuth }, async (req, reply) => {
    const body = pushTokenBody.parse(req.body)
    const auth = req.auth!
    tx(db, () => {
      // Aynı telefon yeniden oturum açtıysa token eski oturumdan taşınır
      db.prepare('UPDATE sessions SET push_token = NULL WHERE push_token = ?').run(body.token)
      db.prepare('UPDATE sessions SET push_token = ?, platform = COALESCE(?, platform) WHERE id = ?').run(
        body.token,
        body.platform ?? null,
        auth.sessionId,
      )
    })
    return reply.code(204).send()
  })

  app.delete('/v1/push-token', { preHandler: requireAuth }, async (req, reply) => {
    db.prepare('UPDATE sessions SET push_token = NULL WHERE id = ?').run(req.auth!.sessionId)
    return reply.code(204).send()
  })

  app.delete('/v1/session', { preHandler: requireAuth }, async (req, reply) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.auth!.sessionId)
    return reply.code(204).send()
  })

  app.post('/v1/service-requests', { preHandler: requireAuth }, async (req, reply) => {
    const body = serviceRequestBody.parse(req.body)
    const device = req.auth!.device
    const t = now()
    const res = db
      .prepare(
        `INSERT INTO service_requests (device_id, category, description, contact_name, contact_phone, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      )
      .run(device.id, body.category, body.description, body.contactName ?? null, body.contactPhone, t, t)
    const row = db
      .prepare('SELECT * FROM service_requests WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as unknown as ServiceRequestRow
    return reply.code(201).send(toServiceRequestDTO(row))
  })

  app.get('/v1/service-requests', { preHandler: requireAuth }, async (req) => {
    const rows = db
      .prepare('SELECT * FROM service_requests WHERE device_id = ? ORDER BY created_at DESC')
      .all(req.auth!.device.id) as unknown as ServiceRequestRow[]
    return { items: rows.map(toServiceRequestDTO) }
  })

  return app
}
