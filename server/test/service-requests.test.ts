import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activate, bearer, setup } from './helpers.ts'

const VALID = { category: 'ariza', description: 'Cihaz su vermiyor', contactPhone: '05551234567' }

test('servis talebi oluştur: doğrulanmamış giriş 400, geçerli giriş 201 döner', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const h = bearer(body.token)

  const bad1 = await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: h, payload: { ...VALID, category: 'bilinmeyen' } })
  assert.equal(bad1.statusCode, 400)
  const bad2 = await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: h, payload: { ...VALID, contactPhone: 'abc' } })
  assert.equal(bad2.statusCode, 400)
  const bad3 = await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: h, payload: { ...VALID, description: '' } })
  assert.equal(bad3.statusCode, 400)

  const res = await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: h, payload: VALID })
  assert.equal(res.statusCode, 201)
  const dto = res.json()
  assert.equal(dto.status, 'open')
  assert.equal(dto.category, 'ariza')
  assert.equal(dto.contactPhone, '05551234567')
  assert.equal(dto.contactName, null)
  assert.equal(dto.adminNote, null)
})

test('servis talebi: oturumsuz istek 401', async () => {
  const ctx = await setup()
  const res = await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', payload: VALID })
  assert.equal(res.statusCode, 401)
})

test('kendi taleplerimi listele: en yeni önce, başka cihazın talebi görünmez', async () => {
  const ctx = await setup()
  const a = await activate(ctx)
  const ha = bearer(a.body.token)
  await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: ha, payload: { ...VALID, description: 'İlk talep' } })
  ctx.clock.t += 1000
  await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: ha, payload: { ...VALID, category: 'filtre', description: 'İkinci talep' } })

  const list = await ctx.app.inject({ method: 'GET', url: '/v1/service-requests', headers: ha })
  const items = list.json().items
  assert.equal(items.length, 2)
  assert.equal(items[0].description, 'İkinci talep') // en yeni ilk sırada

  // ikinci bir cihaz için ayrı bir kod ekleyip birbirine karışmadığını doğrula
  ctx.db.prepare("INSERT INTO devices (activation_code, serial_no, model_id, created_at) VALUES ('ZZZZ99998888','MKP-ZZZZ-9999','pro',1)").run()
  const b = await activate(ctx, 'ZZZZ99998888')
  const hb = bearer(b.body.token)
  const listB = await ctx.app.inject({ method: 'GET', url: '/v1/service-requests', headers: hb })
  assert.equal(listB.json().items.length, 0)
})

test('engelli cihaz servis talebi oluşturamaz', async () => {
  const ctx = await setup()
  const { body } = await activate(ctx)
  const h = bearer(body.token)
  ctx.db.prepare('UPDATE devices SET blocked_at = ? WHERE id = 1').run(Date.now())
  const res = await ctx.app.inject({ method: 'POST', url: '/v1/service-requests', headers: h, payload: VALID })
  assert.equal(res.statusCode, 403)
})
