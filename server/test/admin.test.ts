import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CODE, DAY, activate, bearer } from './helpers.ts'
import { P, PW, onboardedDevice, setupAdmin } from './admin-helpers.ts'

test('giriş: yanlış parola 401, doğru parola HttpOnly+SameSite çerez verir, oturumsuz API 401', async () => {
  const ctx = await setupAdmin({ secureCookies: true })
  assert.equal((await ctx.admin.inject({ method: 'GET', url: '/api/overview' })).statusCode, 401)
  const bad = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'tuna', password: 'yanlis' } })
  assert.equal(bad.statusCode, 401)
  assert.equal(bad.json().error, 'invalid_credentials')
  const nouser = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'yok', password: PW } })
  assert.equal(nouser.statusCode, 401)

  const login = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'TUNA ', password: PW } })
  assert.equal(login.statusCode, 200)
  const setCookie = String(login.headers['set-cookie'])
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Strict/)
  assert.match(setCookie, /Secure/)
  assert.equal((await ctx.api('GET', '/api/session')).json().admin.username, 'tuna')
  // çerez düz metin saklanmıyor
  const stored = ctx.db.prepare('SELECT token_hash FROM admin_sessions').all() as { token_hash: string }[]
  assert.ok(stored.every((r) => !setCookie.includes(r.token_hash)))
})

test('CSRF: özel başlık olmadan veya yabancı Origin ile durum değiştirilemez', async () => {
  const ctx = await setupAdmin()
  const noHeader = await ctx.admin.inject({ method: 'POST', url: '/api/logout', headers: { cookie: ctx.cookie } })
  assert.equal(noHeader.statusCode, 403)
  const evil = await ctx.api('POST', '/api/logout', undefined, { origin: 'https://evil.example', host: 'panel.example' })
  assert.equal(evil.statusCode, 403)
  const sameOrigin = await ctx.api('POST', '/api/system/tick', undefined, { origin: 'https://panel.example', host: 'panel.example' })
  assert.equal(sameOrigin.statusCode, 200)
})

test('5 başarısız denemeden sonra hesap kilitlenir (doğru parola da reddedilir)', async () => {
  const ctx = await setupAdmin()
  for (let i = 0; i < 5; i++) {
    const r = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'tuna', password: 'x' + i }, remoteAddress: `10.1.0.${i}` })
    assert.equal(r.statusCode, 401)
  }
  const locked = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'tuna', password: PW }, remoteAddress: '10.1.0.99' })
  assert.equal(locked.statusCode, 429)
  ctx.clock.t += 16 * 60 * 1000
  const again = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'tuna', password: PW }, remoteAddress: '10.1.0.98' })
  assert.equal(again.statusCode, 200)
})

test('güvenlik başlıkları ve API önbelleğe alınmaz', async () => {
  const ctx = await setupAdmin()
  const r = await ctx.api('GET', '/api/overview')
  assert.match(String(r.headers['content-security-policy']), /script-src 'self'/)
  assert.equal(r.headers['x-frame-options'], 'DENY')
  assert.equal(r.headers['cache-control'], 'no-store')
})

test('genel bakış: sayılar ve filtre sağlığı', async () => {
  const ctx = await setupAdmin()
  await onboardedDevice(ctx)
  ctx.db.prepare("INSERT INTO devices (activation_code, serial_no, model_id, created_at) VALUES ('BBBB22223333','MKP-BBBB-2222','standard',1)").run()
  ctx.clock.t += 150 * DAY // filtre %16 → uyarı
  await ctx.relogin()
  const o = (await ctx.api('GET', '/api/overview')).json()
  assert.equal(o.totals.devices, 2)
  assert.equal(o.totals.ready, 1)
  assert.equal(o.totals.pending, 1)
  assert.equal(o.totals.pushDevices, 1)
  assert.equal(o.health.warning, 1)
  assert.equal(o.attention.length, 1)
  assert.equal(o.activationsByDay.length, 30)
  assert.ok(o.fleet.totalLiters > 0)
  assert.equal(o.buckets.reduce((a: number, b: number) => a + b, 0), 1)
})

test('cihaz listesi: arama, durum/model filtresi, sıralama, sayfalama', async () => {
  const ctx = await setupAdmin()
  await onboardedDevice(ctx)
  for (let i = 0; i < 30; i++) {
    ctx.db
      .prepare('INSERT INTO devices (activation_code, serial_no, model_id, created_at) VALUES (?, ?, ?, ?)')
      .run(`Z${String(i).padStart(3, '0')}00000000`.slice(0, 12), `MKP-Z${String(i).padStart(3, '0')}-0000`, i % 2 ? 'standard' : 'pro', 100 + i)
  }
  const all = (await ctx.api('GET', '/api/devices?pageSize=10')).json()
  assert.equal(all.total, 31)
  assert.equal(all.pages, 4)
  assert.equal(all.items.length, 10)

  const pending = (await ctx.api('GET', '/api/devices?status=pending&pageSize=100')).json()
  assert.equal(pending.total, 30)
  const ready = (await ctx.api('GET', '/api/devices?status=ready')).json()
  assert.equal(ready.total, 1)
  assert.equal(ready.items[0].region, 'İstanbul / Beşiktaş')
  const search = (await ctx.api('GET', '/api/devices?q=beşiktaş')).json()
  assert.equal(search.total, 1)
  const bySerial = (await ctx.api('GET', '/api/devices?q=MKP-Z005')).json()
  assert.equal(bySerial.total, 1)
  const byModel = (await ctx.api('GET', '/api/devices?model=standard&status=pending&pageSize=100')).json()
  assert.equal(byModel.total, 15)
  const sorted = (await ctx.api('GET', '/api/devices?sort=serial&dir=asc&status=pending&pageSize=5')).json()
  assert.equal(sorted.items[0].serialNo, 'MKP-Z000-0000')
})

test('cihaz detayı: profil, metrikler, oturumlar (token maskeli), kod gösterimi denetlenir', async () => {
  const ctx = await setupAdmin()
  await onboardedDevice(ctx)
  const d = (await ctx.api('GET', '/api/devices/1')).json()
  assert.equal(d.summary.status, 'ready')
  assert.equal(d.profile.household.people, 4)
  assert.ok(d.metrics.dailyL > 0)
  assert.equal(d.sessions.length, 1)
  assert.match(d.sessions[0].push, /^ExponentPushToken\[pane….*\]$/)
  assert.ok(!JSON.stringify(d).includes('panel-test'), 'push token açık dönmemeli')
  assert.ok(!JSON.stringify(d).includes(CODE), 'aktivasyon kodu detayda açık dönmemeli')

  const code = (await ctx.api('GET', '/api/devices/1/code')).json()
  assert.equal(code.code, CODE)
  const audit = (await ctx.api('GET', '/api/audit')).json().items
  assert.ok(audit.some((a: { action: string }) => a.action === 'reveal_code'))
  assert.equal((await ctx.api('GET', '/api/devices/999')).statusCode, 404)
})

test('eylem: engelle → API oturumu ve aktivasyon reddedilir; engeli kaldır → tekrar girilir', async () => {
  const ctx = await setupAdmin()
  const { h } = await onboardedDevice(ctx)
  const r = await ctx.api('POST', '/api/devices/1/action', { type: 'block', reason: 'çalıntı' })
  assert.equal(r.statusCode, 200)
  assert.equal(r.json().detail.summary.status, 'blocked')
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: h })).statusCode, 401, 'oturumlar silindi')
  const act = await activate(ctx)
  assert.equal(act.res.statusCode, 403)
  assert.equal(act.res.json().error, 'device_blocked')
  await ctx.api('POST', '/api/devices/1/action', { type: 'unblock' })
  assert.equal((await activate(ctx)).res.statusCode, 200)
})

test('eylem: sıfırla → bekliyor; oturumlar silinir; filtre değiştir; not; model', async () => {
  const ctx = await setupAdmin()
  await onboardedDevice(ctx)
  ctx.clock.t += 40 * DAY
  await ctx.relogin()
  const rep = await ctx.api('POST', '/api/devices/1/action', { type: 'replace_filter' })
  assert.equal(rep.json().detail.filterInstallMs, ctx.clock.t)
  await ctx.api('POST', '/api/devices/1/action', { type: 'set_note', note: 'Beşiktaş bayisi' })
  await ctx.api('POST', '/api/devices/1/action', { type: 'set_model', modelId: 'standard' })
  const d = (await ctx.api('GET', '/api/devices/1')).json()
  assert.equal(d.summary.note, 'Beşiktaş bayisi')
  assert.equal(d.summary.modelId, 'standard')
  assert.equal((await ctx.api('POST', '/api/devices/1/action', { type: 'set_model', modelId: 'yok' })).statusCode, 400)

  const reset = await ctx.api('POST', '/api/devices/1/action', { type: 'reset_activation' })
  assert.equal(reset.json().detail.summary.status, 'pending')
  assert.equal(reset.json().detail.sessions.length, 0)
  assert.equal((await ctx.api('POST', '/api/devices/1/action', { type: 'replace_filter' })).statusCode, 409)
})

test('eylem: test push gider, günlüğe yazılır; token yoksa 409', async () => {
  const ctx = await setupAdmin()
  await onboardedDevice(ctx)
  const r = await ctx.api('POST', '/api/devices/1/action', { type: 'send_push', title: 'Merhaba', body: 'Deneme' })
  assert.equal(r.statusCode, 200)
  assert.equal(r.json().sent, 1)
  assert.equal(ctx.sent.length, 1)
  assert.equal(ctx.sent[0]!.title, 'Merhaba')
  const feed = (await ctx.api('GET', '/api/notifications?kind=manual')).json().items
  assert.equal(feed.length, 1)
  assert.equal(feed[0].title, 'Merhaba')
  assert.equal(feed[0].delivered, true)

  await ctx.api('POST', '/api/devices/1/action', { type: 'revoke_sessions' })
  const none = await ctx.api('POST', '/api/devices/1/action', { type: 'send_push', title: 'x', body: 'y' })
  assert.equal(none.statusCode, 409)
  assert.equal((await ctx.api('POST', '/api/devices/1/action', { type: 'send_push', title: '', body: 'y' })).statusCode, 400)
})

test('cihaz silme: seri numarası onayı gerekir', async () => {
  const ctx = await setupAdmin()
  assert.equal((await ctx.api('DELETE', '/api/devices/1?confirm=yanlis')).statusCode, 400)
  assert.equal((await ctx.api('DELETE', '/api/devices/1?confirm=MKP-ABCD-1234')).statusCode, 204)
  assert.equal((await ctx.api('GET', '/api/devices/1')).statusCode, 404)
})

test('aktivasyon kodları: üret, içe aktar, dışa aktar (yalnız giriş yapmış)', async () => {
  const ctx = await setupAdmin()
  const gen = (await ctx.api('POST', '/api/provision', { model: 'pro', count: 5 })).json()
  assert.equal(gen.items.length, 5)
  assert.match(gen.items[0].code, /^[0-9A-Z]{12}$/)
  assert.equal(new Set(gen.items.map((i: { code: string }) => i.code)).size, 5)
  assert.equal((await ctx.api('POST', '/api/provision', { model: 'yok', count: 1 })).statusCode, 400)
  assert.equal((await ctx.api('POST', '/api/provision', { model: 'pro', count: 0 })).statusCode, 400)

  const imp = (await ctx.api('POST', '/api/provision/import', { model: 'standard', text: 'QWER12345678\nQWER12345678\nkisa\nASDF87654321,pro\n\nZXCV00001111,yokmodel' })).json()
  assert.equal(imp.added, 2)
  assert.equal(imp.duplicates, 1)
  assert.equal(imp.invalid.length, 2)

  const csv = await ctx.api('GET', '/api/provision/export?scope=pending')
  assert.match(String(csv.headers['content-type']), /text\/csv/)
  assert.match(csv.body, /^kod,seri_no,model,durum\n/)
  assert.ok(csv.body.includes(gen.items[0].code))
  const anon = await ctx.admin.inject({ method: 'GET', url: '/api/provision/export' })
  assert.equal(anon.statusCode, 401)
})

test('parola değiştirme: kısa/yanlış reddedilir, başarılıysa yenisi geçerli olur', async () => {
  const ctx = await setupAdmin()
  assert.equal((await ctx.api('POST', '/api/password', { current: 'yanlis-parola', next: 'yeni-parola-123456' })).statusCode, 400)
  assert.equal((await ctx.api('POST', '/api/password', { current: PW, next: 'kisa' })).statusCode, 400)
  assert.equal((await ctx.api('POST', '/api/password', { current: PW, next: 'yeni-parola-123456' })).statusCode, 204)
  const old = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'tuna', password: PW }, remoteAddress: '10.2.0.1' })
  assert.equal(old.statusCode, 401)
  const fresh = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'tuna', password: 'yeni-parola-123456' }, remoteAddress: '10.2.0.2' })
  assert.equal(fresh.statusCode, 200)
})

test('yöneticiler: yeni hesap parolası bir kez döner; kendini silemez; çıkış oturumu kapatır', async () => {
  const ctx = await setupAdmin()
  const created = (await ctx.api('POST', '/api/admins', { username: 'ortak' })).json()
  assert.equal(created.username, 'ortak')
  assert.ok(created.password.length >= 12)
  assert.equal((await ctx.api('POST', '/api/admins', { username: 'ortak' })).statusCode, 409)
  assert.equal((await ctx.api('POST', '/api/admins', { username: 'a' })).statusCode, 400)
  const login = await ctx.admin.inject({ method: 'POST', url: '/api/login', headers: P, payload: { username: 'ortak', password: created.password }, remoteAddress: '10.3.0.1' })
  assert.equal(login.statusCode, 200)
  const list = (await ctx.api('GET', '/api/admins')).json().admins
  assert.equal(list.length, 2)
  assert.ok(!JSON.stringify(list).includes('scrypt'), 'hash dönmemeli')
  assert.equal((await ctx.api('DELETE', '/api/admins/1')).statusCode, 400)
  assert.equal((await ctx.api('DELETE', `/api/admins/${list.find((a: { username: string }) => a.username === 'ortak').id}`)).statusCode, 204)

  assert.equal((await ctx.api('POST', '/api/logout')).statusCode, 204)
  assert.equal((await ctx.api('GET', '/api/overview')).statusCode, 401)
})

test('oturum 12 saat sonra dolar', async () => {
  const ctx = await setupAdmin()
  assert.equal((await ctx.api('GET', '/api/session')).statusCode, 200)
  ctx.clock.t += 13 * 3600 * 1000
  assert.equal((await ctx.api('GET', '/api/session')).statusCode, 401)
})

test('sistem, yapılandırma ve zamanlayıcı ucu', async () => {
  const ctx = await setupAdmin()
  const sys = (await ctx.api('GET', '/api/system')).json()
  assert.equal(sys.scheduler.intervalMin, 15)
  assert.ok(sys.dbBytes > 0)
  const cfg = (await ctx.api('GET', '/api/config')).json()
  assert.ok(cfg.models.find((m: { id: string }) => m.id === 'pro'))
  assert.equal(cfg.timeCapDays, 180)
  const tick = (await ctx.api('POST', '/api/system/tick')).json()
  assert.equal(tick.result.sent, 0)
})
