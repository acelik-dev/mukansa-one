import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.ts'
import { openDb, type DB } from '../src/db.ts'
import { serialFromCode } from '../src/codes.ts'

export const CODE = 'ABCD1234EFGH'
export const DAY = 86400000

export const HOUSEHOLD = {
  people: 4,
  uses: ['drinking', 'tea', 'cooking'],
  presence: 'home',
  source: 'damacana',
  region: 'İstanbul / Beşiktaş',
}
export const NOTIF = { weeklySummary: true, filterAlerts: true, milestones: true, marketing: false }

export interface Ctx {
  db: DB
  app: FastifyInstance
  clock: { t: number }
}

export async function setup(): Promise<Ctx> {
  const db = openDb(':memory:')
  // 2026-09-14 Pazartesi 12:00 (TR)
  const clock = { t: Date.parse('2026-09-14T12:00:00+03:00') }
  addDevice(db, CODE, 'pro', clock.t)
  const app = await buildApp({ db, now: () => clock.t })
  return { db, app, clock }
}

export function addDevice(db: DB, code: string, model: string, t: number) {
  db.prepare(
    'INSERT INTO devices (activation_code, serial_no, model_id, created_at) VALUES (?, ?, ?, ?)',
  ).run(code, serialFromCode(code), model, t)
}

export async function activate(ctx: Ctx, code = CODE, remoteAddress?: string) {
  const res = await ctx.app.inject({ method: 'POST', url: '/v1/activate', payload: { code }, remoteAddress })
  return { res, body: res.json() as { token: string; state: Record<string, any> } }
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` }
}
