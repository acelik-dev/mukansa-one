import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { buildAdminApp } from '../src/admin/app.ts'
import { hashPassword } from '../src/admin/password.ts'
import type { PushMessage, PushSender } from '../src/push.ts'
import { newSchedulerStatus } from '../src/status.ts'
import { HOUSEHOLD, NOTIF, activate, bearer, setup, type Ctx } from './helpers.ts'

export const PW = 'correct-horse-battery'
export const P = { 'x-panel': '1' }

export interface AdminCtx extends Ctx {
  admin: FastifyInstance
  sent: PushMessage[]
  cookie: string
  api: (method: string, url: string, payload?: unknown, headers?: Record<string, string>) => Promise<LightMyRequestResponse>
  /** Saat ilerletildikten sonra (admin oturumu 12 saat) yeniden giriş */
  relogin: () => Promise<void>
}

export async function setupAdmin(opts: { secureCookies?: boolean } = {}): Promise<AdminCtx> {
  const ctx = await setup()
  ctx.db
    .prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run('tuna', await hashPassword(PW), ctx.clock.t)
  const sent: PushMessage[] = []
  const send: PushSender = async (msgs) => {
    sent.push(...msgs)
    return msgs.map(() => ({ ok: true }))
  }
  const admin = await buildAdminApp({
    db: ctx.db,
    now: () => ctx.clock.t,
    send,
    status: newSchedulerStatus(15, true),
    tick: async () => ({ devices: 0, sent: 0, skippedQuietHours: false }),
    secureCookies: opts.secureCookies,
  })
  const out = { ...ctx, admin, sent, cookie: '' } as AdminCtx
  out.relogin = async () => {
    const login = await admin.inject({
      method: 'POST',
      url: '/api/login',
      headers: P,
      payload: { username: 'tuna', password: PW },
      remoteAddress: `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    })
    out.cookie = String(login.headers['set-cookie']).split(';')[0]!
  }
  out.api = (method, url, payload, headers = {}) =>
    admin.inject({ method: method as 'GET', url, payload: payload as object, headers: { ...P, cookie: out.cookie, ...headers } })
  await out.relogin()
  return out
}

export async function onboardedDevice(ctx: Ctx) {
  const { body } = await activate(ctx)
  const h = bearer(body.token)
  await ctx.app.inject({ method: 'POST', url: '/v1/onboarding', headers: h, payload: { household: HOUSEHOLD, notif: NOTIF } })
  await ctx.app.inject({ method: 'PUT', url: '/v1/push-token', headers: h, payload: { token: 'ExponentPushToken[panel-test]', platform: 'ios' } })
  return { token: body.token, h }
}
