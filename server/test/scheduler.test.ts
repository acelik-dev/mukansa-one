import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PushMessage, PushSender } from '../src/push.ts'
import { runNotificationPass } from '../src/scheduler.ts'
import { DAY, HOUSEHOLD, NOTIF, activate, bearer, setup, type Ctx } from './helpers.ts'

const TOKEN = 'ExponentPushToken[test-device]'

function recorder(ok = true): { send: PushSender; sent: PushMessage[] } {
  const sent: PushMessage[] = []
  return {
    sent,
    send: async (msgs) => {
      sent.push(...msgs)
      return msgs.map(() => ({ ok }))
    },
  }
}

async function onboarded(ctx: Ctx, notif = NOTIF) {
  const { body } = await activate(ctx)
  const h = bearer(body.token)
  await ctx.app.inject({ method: 'POST', url: '/v1/onboarding', headers: h, payload: { household: HOUSEHOLD, notif } })
  await ctx.app.inject({ method: 'PUT', url: '/v1/push-token', headers: h, payload: { token: TOKEN, platform: 'ios' } })
  return h
}

// Varsayılan hane: 4 kişi × 4.5 L = 18 L/gün, kapasite 5000 L → ~277 gün, ama 180 gün zaman tavanı
// Zaman tavanı belirleyici → yüzde = kalan gün / 180

test('filtre uyarıları: %25 ve %10 eşiklerinde birer kez, tekrar gönderilmez', async () => {
  const ctx = await setup()
  await onboarded(ctx)
  const { send, sent } = recorder()
  const t0 = ctx.clock.t

  await runNotificationPass(ctx.db, t0 + 100 * DAY, send)
  assert.equal(sent.filter((m) => m.data?.type === 'filter').length, 0)

  // gün 140 → kalan 40 gün = %22
  await runNotificationPass(ctx.db, t0 + 140 * DAY, send)
  const warn = sent.filter((m) => m.data?.type === 'filter')
  assert.equal(warn.length, 1)
  assert.match(warn[0]!.title, /yaklaşıyor/)

  await runNotificationPass(ctx.db, t0 + 141 * DAY, send)
  assert.equal(sent.filter((m) => m.data?.type === 'filter').length, 1, 'aynı eşik tekrar gitmemeli')

  // gün 165 → kalan 15 gün = %8
  await runNotificationPass(ctx.db, t0 + 165 * DAY, send)
  const filterMsgs = sent.filter((m) => m.data?.type === 'filter')
  assert.equal(filterMsgs.length, 2)
  assert.match(filterMsgs[1]!.title, /değiştirme zamanı/)
})

test('filtre değişince uyarılar yeni kartuş için yeniden çalışır', async () => {
  const ctx = await setup()
  const h = await onboarded(ctx)
  const { send, sent } = recorder()
  const t0 = ctx.clock.t

  await runNotificationPass(ctx.db, t0 + 150 * DAY, send)
  assert.equal(sent.filter((m) => m.data?.type === 'filter').length, 1)

  ctx.clock.t = t0 + 151 * DAY
  await ctx.app.inject({ method: 'POST', url: '/v1/filter/replace', headers: h, payload: {} })
  await runNotificationPass(ctx.db, t0 + 152 * DAY, send)
  assert.equal(sent.filter((m) => m.data?.type === 'filter').length, 1)

  await runNotificationPass(ctx.db, t0 + 151 * DAY + 150 * DAY, send)
  assert.equal(sent.filter((m) => m.data?.type === 'filter').length, 2)
})

test('geç kalınmış turda en ağır seviye gider (uyarı+kritik birlikte gönderilmez)', async () => {
  const ctx = await setup()
  await onboarded(ctx)
  const { send, sent } = recorder()
  await runNotificationPass(ctx.db, ctx.clock.t + 175 * DAY, send)
  const f = sent.filter((m) => m.data?.type === 'filter')
  assert.equal(f.length, 1)
  assert.match(f[0]!.title, /değiştirme zamanı/)
  await runNotificationPass(ctx.db, ctx.clock.t + 176 * DAY, send)
  assert.equal(sent.filter((m) => m.data?.type === 'filter').length, 1)
})

test('bildirim tercihleri kapalıysa gönderilmez', async () => {
  const ctx = await setup()
  await onboarded(ctx, { weeklySummary: false, filterAlerts: false, milestones: false, marketing: false })
  const { send, sent } = recorder()
  await runNotificationPass(ctx.db, ctx.clock.t + 170 * DAY, send)
  assert.equal(sent.length, 0)
})

test('sessiz saatlerde (21:00-09:00 TR) hiçbir şey gitmez, sabah gider', async () => {
  const ctx = await setup()
  await onboarded(ctx)
  const { send, sent } = recorder()
  const night = Date.parse('2027-02-01T23:30:00+03:00') // ~140+ gün sonra, gece
  const r = await runNotificationPass(ctx.db, night, send)
  assert.equal(r.skippedQuietHours, true)
  assert.equal(sent.length, 0)
  await runNotificationPass(ctx.db, Date.parse('2027-02-02T09:30:00+03:00'), send)
  assert.ok(sent.length > 0)
})

test('haftalık özet: pazar 10:00 sonrası, haftada bir kez', async () => {
  const ctx = await setup() // aktivasyon Pzt 14 Eyl 2026
  await onboarded(ctx)
  const { send, sent } = recorder()
  const weekly = () => sent.filter((m) => m.data?.type === 'weekly')

  await runNotificationPass(ctx.db, Date.parse('2026-09-20T11:00:00+03:00'), send) // ilk pazar, <7 gün
  assert.equal(weekly().length, 0)

  await runNotificationPass(ctx.db, Date.parse('2026-09-27T09:30:00+03:00'), send) // 10:00'dan önce
  assert.equal(weekly().length, 0)

  await runNotificationPass(ctx.db, Date.parse('2026-09-27T11:00:00+03:00'), send)
  assert.equal(weekly().length, 1)
  assert.match(weekly()[0]!.body, /126 L/) // 18 L × 7

  await runNotificationPass(ctx.db, Date.parse('2026-09-27T15:00:00+03:00'), send)
  assert.equal(weekly().length, 1)

  await runNotificationPass(ctx.db, Date.parse('2026-09-29T11:00:00+03:00'), send) // salı
  assert.equal(weekly().length, 1)

  await runNotificationPass(ctx.db, Date.parse('2026-10-04T11:00:00+03:00'), send) // sonraki pazar
  assert.equal(weekly().length, 2)
})

test('kilometre taşı: yeni geçilen gider (bir kez); çok sonra ilk değerlendirilen sessiz kalır', async () => {
  // Varsayılan hane ≈ 155 TL/gün tasarruf → 500 TL eşiği ~3. günde geçilir
  const fresh = await setup()
  await onboarded(fresh)
  const a = recorder()
  const milestones = (r: ReturnType<typeof recorder>) => r.sent.filter((m) => m.data?.type === 'milestone')
  await runNotificationPass(fresh.db, fresh.clock.t + 5 * DAY, a.send)
  assert.equal(milestones(a).length, 1)
  assert.match(milestones(a)[0]!.body, /500/)
  await runNotificationPass(fresh.db, fresh.clock.t + 5 * DAY + 3600_000, a.send)
  assert.equal(milestones(a).length, 1, 'aynı eşik tekrar gitmemeli')

  // Sunucu ilk kez 200. günde değerlendiriyorsa eski eşikler için bildirim atılmaz
  const late = await setup()
  await onboarded(late)
  const b = recorder()
  await runNotificationPass(late.db, late.clock.t + 200 * DAY, b.send)
  assert.equal(milestones(b).length, 0)
  const silent = late.db.prepare("SELECT COUNT(*) AS n FROM notification_log WHERE key LIKE 'milestone-%'").get() as { n: number }
  assert.ok(silent.n > 0)
})

test('gönderim başarısızsa loglanmaz (yeniden denenir); geçersiz token temizlenir', async () => {
  const ctx = await setup()
  await onboarded(ctx)
  const t = ctx.clock.t + 150 * DAY

  const failing = recorder(false)
  await runNotificationPass(ctx.db, t, failing.send)
  assert.equal(
    (ctx.db.prepare("SELECT COUNT(*) AS n FROM notification_log WHERE key LIKE 'filter-warning:%'").get() as { n: number }).n,
    0,
  )

  const ok = recorder()
  await runNotificationPass(ctx.db, t, ok.send)
  assert.equal(ok.sent.filter((m) => m.data?.type === 'filter').length, 1)

  // DeviceNotRegistered → token temizlenir
  const ctx2 = await setup()
  await onboarded(ctx2)
  await runNotificationPass(ctx2.db, ctx2.clock.t + 150 * DAY, async (msgs) => msgs.map(() => ({ ok: false, invalidToken: true })))
  assert.equal(ctx2.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE push_token IS NOT NULL').get()!.n, 0)
})
