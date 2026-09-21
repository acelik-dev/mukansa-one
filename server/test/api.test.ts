import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeMetrics, DEFAULT_HOUSEHOLD, type Household } from '../../mobile/src/lib/calc.ts'
import { normalizeCode, serialFromCode } from '../src/codes.ts'
import { CODE, DAY, HOUSEHOLD, NOTIF, activate, addDevice, bearer, setup } from './helpers.ts'

test('normalizeCode: temizler, O/I/L düzeltir, uzunluğu doğrular', () => {
  assert.equal(normalizeCode('abcd-1234-efgh'), 'ABCD1234EFGH')
  assert.equal(normalizeCode('ABCD 1234 EFGH'), 'ABCD1234EFGH')
  assert.equal(normalizeCode('O0IL 1111 2222'), '001111112222')
  assert.equal(normalizeCode('ABC'), null)
  assert.equal(serialFromCode('ABCD1234EFGH'), 'MKP-ABCD-1234')
})

test('activate: geçersiz kod 404, geçerli kod token + state döner', async () => {
  const ctx = await setup()
  const bad = await ctx.app.inject({ method: 'POST', url: '/v1/activate', payload: { code: 'ZZZZ00000000' } })
  assert.equal(bad.statusCode, 404)
  assert.equal(bad.json().error, 'invalid_code')

  const { res, body } = await activate(ctx, 'abcd-1234-efgh')
  assert.equal(res.statusCode, 200)
  assert.match(body.token, /^mk_/)
  assert.equal(body.state.device.serialNo, 'MKP-ABCD-1234')
  assert.equal(body.state.device.modelId, 'pro')
  assert.equal(body.state.device.activationMs, ctx.clock.t)
  assert.equal(body.state.onboarded, false)
})

test('activate: token DB\'de düz metin saklanmaz', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const rows = ctx.db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[]
  assert.equal(rows.length, 1)
  assert.notEqual(rows[0]!.token_hash, body.token)
})

test('yeniden aktivasyon (ikinci telefon): aktivasyon zamanı korunur, veriler gelir', async () => {
  const ctx = await setup()
  const first = await activate(ctx)
  await ctx.app.inject({
    method: 'POST',
    url: '/v1/onboarding',
    headers: bearer(first.body.token),
    payload: { household: { ...HOUSEHOLD, people: 3 }, notif: NOTIF },
  })
  ctx.clock.t += 10 * DAY
  const second = await activate(ctx)
  assert.notEqual(second.body.token, first.body.token)
  assert.equal(second.body.state.device.activationMs, first.body.state.device.activationMs)
  assert.equal(second.body.state.onboarded, true)
  assert.equal(second.body.state.household.people, 3)
})

test('auth: token yok / yanlış → 401', async () => {
  const ctx = await setup()
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/v1/me' })).statusCode, 401)
  const wrong = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: bearer('mk_nope') })
  assert.equal(wrong.statusCode, 401)
  assert.equal(wrong.json().error, 'unauthorized')
})

test('onboarding: household+notif kaydeder, metrikler paylaşılan calc ile birebir aynı', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  ctx.clock.t += 30 * DAY
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/onboarding',
    headers: bearer(body.token),
    payload: { household: { ...HOUSEHOLD, damacanaPriceTL: 170 }, notif: NOTIF },
  })
  assert.equal(res.statusCode, 200)
  const state = res.json()
  assert.equal(state.onboarded, true)

  const expected = computeMetrics(
    {
      modelId: 'pro',
      household: { ...HOUSEHOLD, damacanaPriceTL: 170 } as Household,
      activationMs: body.state.device.activationMs,
      filterInstallMs: body.state.device.filterInstallMs,
    },
    new Date(ctx.clock.t),
  )
  assert.deepEqual(state.metrics, JSON.parse(JSON.stringify(expected)))
  assert.equal(state.metrics.daysSinceActivation, 30)
})

test('profile: kısmi güncelleme, doğrulama hataları 400', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const h = bearer(body.token)

  const ok = await ctx.app.inject({
    method: 'PUT',
    url: '/v1/profile',
    headers: h,
    payload: { notif: { ...NOTIF, marketing: true } },
  })
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.json().notif.marketing, true)
  // household dokunulmadı → varsayılan
  assert.deepEqual(ok.json().household, DEFAULT_HOUSEHOLD)

  const cases = [
    {},
    { household: { ...HOUSEHOLD, people: 0 } },
    { household: { ...HOUSEHOLD, uses: [] } },
    { household: { ...HOUSEHOLD, source: 'kuyu' } },
    { household: { ...HOUSEHOLD, damacanaPriceTL: -5 } },
  ]
  for (const payload of cases) {
    const res = await ctx.app.inject({ method: 'PUT', url: '/v1/profile', headers: h, payload })
    assert.equal(res.statusCode, 400, JSON.stringify(payload))
  }
})

test('profile: damacanaPriceTL kaldırılınca (alan yok) temizlenir', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const h = bearer(body.token)
  await ctx.app.inject({ method: 'PUT', url: '/v1/profile', headers: h, payload: { household: { ...HOUSEHOLD, damacanaPriceTL: 200 } } })
  const res = await ctx.app.inject({ method: 'PUT', url: '/v1/profile', headers: h, payload: { household: HOUSEHOLD } })
  assert.equal(res.json().household.damacanaPriceTL, undefined)
})

test('filter/replace: sayaç sıfırlanır, tekrar/eski istek idempotent, gelecek tarih sıkıştırılır', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const h = bearer(body.token)

  ctx.clock.t += 40 * DAY
  const r1 = await ctx.app.inject({ method: 'POST', url: '/v1/filter/replace', headers: h, payload: {} })
  assert.equal(r1.json().device.filterInstallMs, ctx.clock.t)
  assert.equal(r1.json().device.activationMs, body.state.device.activationMs)

  // Offline kuyruktan gelen eski bir değişim mevcut kayıttan eskiyse yok sayılır
  const stale = await ctx.app.inject({
    method: 'POST',
    url: '/v1/filter/replace',
    headers: h,
    payload: { replacedAt: ctx.clock.t - 5 * DAY },
  })
  assert.equal(stale.json().device.filterInstallMs, ctx.clock.t)

  // Gelecek tarih now'a sıkıştırılır
  ctx.clock.t += DAY
  const future = await ctx.app.inject({
    method: 'POST',
    url: '/v1/filter/replace',
    headers: h,
    payload: { replacedAt: ctx.clock.t + 30 * DAY },
  })
  assert.equal(future.json().device.filterInstallMs, ctx.clock.t)

  // Offline: 2 gün önce yapılmış değişim, öncekinden yeniyse kabul edilir
  ctx.clock.t += 10 * DAY
  const queued = await ctx.app.inject({
    method: 'POST',
    url: '/v1/filter/replace',
    headers: h,
    payload: { replacedAt: ctx.clock.t - 2 * DAY },
  })
  assert.equal(queued.json().device.filterInstallMs, ctx.clock.t - 2 * DAY)
})

test('push-token: kaydolur, başka oturuma taşınır, geçersiz format 400', async () => {
  const ctx = await setup()
  const a = await activate(ctx)
  const b = await activate(ctx)
  const token = 'ExponentPushToken[abc123]'

  const bad = await ctx.app.inject({ method: 'PUT', url: '/v1/push-token', headers: bearer(a.body.token), payload: { token: 'nope' } })
  assert.equal(bad.statusCode, 400)

  await ctx.app.inject({ method: 'PUT', url: '/v1/push-token', headers: bearer(a.body.token), payload: { token, platform: 'ios' } })
  await ctx.app.inject({ method: 'PUT', url: '/v1/push-token', headers: bearer(b.body.token), payload: { token, platform: 'ios' } })
  const rows = ctx.db.prepare('SELECT push_token FROM sessions WHERE push_token IS NOT NULL').all()
  assert.equal(rows.length, 1)

  const del = await ctx.app.inject({ method: 'DELETE', url: '/v1/push-token', headers: bearer(b.body.token) })
  assert.equal(del.statusCode, 204)
  assert.equal(ctx.db.prepare('SELECT push_token FROM sessions WHERE push_token IS NOT NULL').all().length, 0)
})

test('DELETE /v1/session: token geçersizleşir, cihaz verisi kalır', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const h = bearer(body.token)
  await ctx.app.inject({ method: 'POST', url: '/v1/onboarding', headers: h, payload: { household: HOUSEHOLD, notif: NOTIF } })
  assert.equal((await ctx.app.inject({ method: 'DELETE', url: '/v1/session', headers: h })).statusCode, 204)
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: h })).statusCode, 401)
  const again = await activate(ctx)
  assert.equal(again.body.state.onboarded, true)
})

test('oturum sayısı cihaz başına 10 ile sınırlı (en eski silinir)', async () => {
  const ctx = await setup()
  const first = await activate(ctx)
  // activate rate limit'i (10/dk) gerçek saate bağlı; 10 yeni oturum tam sınırda kalır
  for (let i = 0; i < 9; i++) {
    ctx.clock.t += 1000
    await activate(ctx)
  }
  const n = ctx.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }
  assert.equal(n.n, 10)
  ctx.clock.t += 1000
  // rate limit IP başına olduğundan 11. oturum başka IP'den açılır
  const eleventh = await activate(ctx, CODE, '10.0.0.9')
  assert.equal(eleventh.res.statusCode, 200)
  const after = ctx.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }
  assert.equal(after.n, 10)
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: bearer(first.body.token) })).statusCode, 401)
})

test('activate: dakikada 10 denemeden sonra 429', async () => {
  const ctx = await setup()
  addDevice(ctx.db, 'QQQQ11112222', 'standard', ctx.clock.t)
  let last = 0
  for (let i = 0; i < 12; i++) {
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/activate', payload: { code: `ZZZZ0000000${i % 10}` } })
    last = res.statusCode
  }
  assert.equal(last, 429)
})

test('CORS: yalnızca yapılandırılan origini kabul eder, varsayılan kapalı', async () => {
  const closed = await setup()
  const r0 = await closed.app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:8081' } })
  assert.equal(r0.headers['access-control-allow-origin'], undefined)

  const { db } = closed
  const { buildApp } = await import('../src/app.ts')
  const app = await buildApp({ db, corsOrigins: ['http://localhost:8081'] })
  const ok = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:8081' } })
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:8081')
  const other = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://evil.example' } })
  assert.equal(other.headers['access-control-allow-origin'], undefined)
  const pre = await app.inject({
    method: 'OPTIONS',
    url: '/v1/profile',
    headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'authorization,content-type' },
  })
  assert.equal(pre.statusCode, 204)
})
