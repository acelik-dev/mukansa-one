import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onboardedDevice, setupAdmin } from './admin-helpers.ts'

async function makeRequest(ctx: Awaited<ReturnType<typeof setupAdmin>>, overrides: Record<string, unknown> = {}) {
  const { h } = await onboardedDevice(ctx)
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/service-requests',
    headers: h,
    payload: { category: 'ariza', description: 'Cihaz çalışmıyor', contactPhone: '05551234567', ...overrides },
  })
  return res.json()
}

test('panel: servis talepleri listesi cihaz bilgisiyle birlikte döner, en yeni önce', async () => {
  const ctx = await setupAdmin()
  const first = await makeRequest(ctx, { description: 'İlk talep' })
  ctx.clock.t += 1000
  await makeRequest(ctx, { category: 'filtre', description: 'İkinci talep' })

  const list = (await ctx.api('GET', '/api/service-requests')).json()
  assert.equal(list.total, 2)
  assert.equal(list.items[0].description, 'İkinci talep')
  assert.equal(list.items[0].category, 'filtre')
  assert.ok(list.items[0].serialNo.startsWith('MKP-'))
  assert.equal(list.items[1].id, first.id)
})

test('panel: duruma göre filtreleme çalışır', async () => {
  const ctx = await setupAdmin()
  const r1 = await makeRequest(ctx)
  await makeRequest(ctx)
  await ctx.api('POST', `/api/service-requests/${r1.id}/action`, { status: 'done' })

  const open = (await ctx.api('GET', '/api/service-requests?status=open')).json()
  assert.equal(open.total, 1)
  const done = (await ctx.api('GET', '/api/service-requests?status=done')).json()
  assert.equal(done.total, 1)
  assert.equal(done.items[0].id, r1.id)
})

test('panel: durum güncelleme ve not ekleme denetim günlüğüne yazılır', async () => {
  const ctx = await setupAdmin()
  const r = await makeRequest(ctx)

  const updated = await ctx.api('POST', `/api/service-requests/${r.id}/action`, { status: 'in_progress', adminNote: 'Teknisyen yönlendirildi' })
  assert.equal(updated.statusCode, 200)
  const dto = updated.json()
  assert.equal(dto.status, 'in_progress')
  assert.equal(dto.adminNote, 'Teknisyen yönlendirildi')
  assert.ok(dto.updatedAt >= dto.createdAt)

  const audit = (await ctx.api('GET', '/api/audit')).json().items
  assert.ok(audit.some((a: { action: string }) => a.action === 'service_request_update'))
})

test('panel: geçersiz durum 400, olmayan talep 404, boş gövde 400', async () => {
  const ctx = await setupAdmin()
  const r = await makeRequest(ctx)
  assert.equal((await ctx.api('POST', `/api/service-requests/${r.id}/action`, { status: 'yok_boyle_durum' })).statusCode, 400)
  assert.equal((await ctx.api('POST', '/api/service-requests/999999/action', { status: 'done' })).statusCode, 404)
  assert.equal((await ctx.api('POST', `/api/service-requests/${r.id}/action`, {})).statusCode, 400)
})

test('panel: cihaz detayında o cihazın servis talepleri görünür', async () => {
  const ctx = await setupAdmin()
  await makeRequest(ctx, { description: 'Cihaz detay testi' })
  const detail = (await ctx.api('GET', '/api/devices/1')).json()
  assert.equal(detail.serviceRequests.length, 1)
  assert.equal(detail.serviceRequests[0].description, 'Cihaz detay testi')
})

test('panel: genel bakışta açık servis talebi sayısı doğru', async () => {
  const ctx = await setupAdmin()
  const r1 = await makeRequest(ctx)
  await makeRequest(ctx)
  await ctx.api('POST', `/api/service-requests/${r1.id}/action`, { status: 'cancelled' })
  const ov = (await ctx.api('GET', '/api/overview')).json()
  assert.equal(ov.openServiceRequests, 1)
})

test('mobil taraf: giriş yapmamış panel isteği 401', async () => {
  const ctx = await setupAdmin()
  const res = await ctx.admin.inject({ method: 'GET', url: '/api/service-requests' })
  assert.equal(res.statusCode, 401)
})

test('durum değişince cihaza push bildirimi gider', async () => {
  const ctx = await setupAdmin()
  const r = await makeRequest(ctx)

  await ctx.api('POST', `/api/service-requests/${r.id}/action`, { status: 'in_progress' })
  assert.equal(ctx.sent.length, 1)
  assert.equal(ctx.sent[0]!.to, 'ExponentPushToken[panel-test]')
  assert.match(ctx.sent[0]!.body, /İşlemde/)

  const list = (await ctx.api('GET', '/api/notifications')).json().items
  assert.ok(list.some((n: { kind: string }) => n.kind === 'service'))
})

test('sadece not güncellenince (durum aynı kalınca) bildirim gitmez', async () => {
  const ctx = await setupAdmin()
  const r = await makeRequest(ctx)

  await ctx.api('POST', `/api/service-requests/${r.id}/action`, { adminNote: 'sadece not' })
  assert.equal(ctx.sent.length, 0)

  await ctx.api('POST', `/api/service-requests/${r.id}/action`, { status: 'open' })
  assert.equal(ctx.sent.length, 0, 'aynı duruma tekrar set etmek bildirim tetiklememeli')
})
