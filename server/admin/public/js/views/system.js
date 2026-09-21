import { del, get, post } from '../api.js'
import { h } from '../dom.js'
import { ago, dateTime, num, num1 } from '../fmt.js'
import { icon } from '../icons.js'
import { confirmDialog, copyText, modal, toast } from '../ui.js'

const dec = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)
const kb = (b) => (b > 1048576 ? `${num1(b / 1048576)} MB` : `${num1(b / 1024)} KB`)
const upt = (s) => (s > 86400 ? `${Math.floor(s / 86400)} gün ${Math.floor((s % 86400) / 3600)} sa` : s > 3600 ? `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk` : `${Math.floor(s / 60)} dk`)

const kvRows = (rows) => h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))

export async function systemView(root, ctx) {
  const [sys, cfg, adm] = await Promise.all([get('/api/system'), get('/api/config'), get('/api/admins')])
  const sch = sys.scheduler

  const runBtn = h(
    'button',
    {
      class: 'btn sm primary',
      type: 'button',
      onClick: async (e) => {
        const b = e.currentTarget
        b.disabled = true
        try {
          const r = await post('/api/system/tick')
          toast(r.result.skippedQuietHours ? 'Sessiz saat (21:00–09:00): bildirim gönderilmedi' : `Tur tamamlandı: ${r.result.sent} bildirim gönderildi`)
          ctx.reload()
        } catch (err) {
          toast(err.message, 'err')
          b.disabled = false
        }
      },
    },
    icon('refresh'),
    'Şimdi çalıştır',
  )

  // ------------------------------------------------------------ parola
  const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', 'aria-label': 'Mevcut parola' })
  const nxt = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', 'aria-label': 'Yeni parola', placeholder: 'En az 12 karakter' })
  const changePw = async (e) => {
    e.preventDefault()
    try {
      await post('/api/password', { current: cur.value, next: nxt.value })
      cur.value = nxt.value = ''
      toast('Parola değiştirildi; diğer oturumlar kapatıldı')
    } catch (err) {
      toast(err.message, 'err')
    }
  }

  // ------------------------------------------------------------ yöneticiler
  const addAdmin = async () => {
    const name = h('input', { class: 'input', placeholder: 'kullanici.adi', autocomplete: 'off', maxlength: '32' })
    await modal({
      title: 'Yönetici ekle',
      body: h('div', {}, h('p', {}, 'Rastgele güçlü bir parola üretilir ve yalnızca bir kez gösterilir.'), h('div', { class: 'field' }, h('label', {}, 'Kullanıcı adı'), name)),
      actions: [
        { label: 'Vazgeç' },
        {
          label: 'Oluştur',
          kind: 'primary',
          onClick: async () => {
            const r = await post('/api/admins', { username: name.value })
            await modal({
              title: 'Yönetici oluşturuldu',
              body: h('div', {}, h('p', {}, 'Bu parola bir daha gösterilmeyecek. Şimdi kopyalayıp güvenli iletin.'), h('div', { class: 'code-box', style: { fontSize: '15px', letterSpacing: '.06em' } }, h('span', { class: 'grow' }, `${r.username} / ${r.password}`), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Kopyala', onClick: () => copyText(r.password, 'Parola kopyalandı') }, icon('copy')))),
              actions: [{ label: 'Kapat', kind: 'primary' }],
            })
            ctx.reload()
          },
        },
      ],
    })
  }

  root.replaceChildren(
    h(
      'div',
      { class: 'reveal' },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Yönetim'), h('h1', { class: 'page-title' }, 'Sistem & ', h('em', {}, 'ayarlar')))),
      h(
        'div',
        { class: 'grid g-3' },
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Sunucu')), kvRows([['Sürüm', sys.version], ['Node', sys.node], ['Çalışma süresi', upt(sys.uptimeSec)], ['Veritabanı', kb(sys.dbBytes)], ['Sunucu saati', dateTime(sys.serverTime)]])),
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Bildirim zamanlayıcısı'), runBtn),
          kvRows([
            ['Aralık', sch.intervalMin ? `${sch.intervalMin} dk` : 'Kapalı'],
            ['Gönderim modu', sch.pushDryRun ? h('span', { class: 'chip warn' }, 'Test (gönderilmez)') : h('span', { class: 'chip ok' }, 'Canlı')],
            ['Son çalışma', sch.lastRunAt ? `${ago(sch.lastRunAt, sys.serverTime)}` : 'henüz çalışmadı'],
            ['Son sonuç', sch.lastResult ? (sch.lastResult.skippedQuietHours ? 'Sessiz saat' : `${sch.lastResult.sent} bildirim / ${sch.lastResult.devices} cihaz`) : '—'],
            sch.lastError ? ['Hata', h('span', { style: { color: 'var(--danger)' } }, sch.lastError)] : null,
          ].filter(Boolean)),
          h('p', { class: 'hint', style: { marginTop: '14px' } }, 'Bildirimler 09:00–21:00 (TR) arasında gider; her bildirim cihaz başına bir kez.'),
        ),
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Parolamı değiştir')), h('form', { onSubmit: changePw }, h('div', { class: 'field' }, h('label', {}, 'Mevcut parola'), cur), h('div', { class: 'field' }, h('label', {}, 'Yeni parola'), nxt), h('button', { class: 'btn block', type: 'submit' }, 'Parolayı güncelle'))),
      ),

      h(
        'div',
        { class: 'card mt' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Yöneticiler'), h('button', { class: 'btn sm', type: 'button', onClick: addAdmin }, icon('plus'), 'Yönetici ekle')),
        h(
          'div',
          { class: 'list' },
          adm.admins.map((a) =>
            h(
              'div',
              { class: 'it' },
              h('div', { class: 'avatar', style: { width: '38px', height: '38px' } }, a.username[0]),
              h('div', { class: 'grow' }, h('div', { class: 'ttl' }, a.username), h('div', { class: 'meta' }, `Oluşturuldu ${dateTime(a.createdAt)} · son giriş ${a.lastLoginAt ? ago(a.lastLoginAt, sys.serverTime) : 'hiç'}`)),
              a.username === ctx.me.username
                ? h('span', { class: 'chip gold' }, 'Siz')
                : h('button', { class: 'btn sm danger', type: 'button', onClick: () => confirmDialog({ title: `${a.username} silinsin mi?`, text: 'Bu yöneticinin tüm oturumları kapanır.', confirmLabel: 'Sil', danger: true, onConfirm: async () => { await del(`/api/admins/${a.id}`); ctx.reload() } }) }, 'Sil'),
            ),
          ),
        ),
      ),

      h(
        'div',
        { class: 'card mt' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Hesaplama parametreleri'), h('span', { class: 'card-note' }, 'salt okunur · kaynak: calc.ts (mobil uygulamayla ortak)')),
        h(
          'div',
          { class: 'grid g-3' },
          h('div', {}, h('div', { class: 'label hint', style: { marginBottom: '10px' } }, 'Modeller'), kvRows(cfg.models.flatMap((m) => [[m.name.replace('Mukansa One — ', ''), `${num(m.capacityL)} L · ${num(m.cartridgePriceTL)} ₺`]]))),
          h('div', {}, h('div', { class: 'label hint', style: { marginBottom: '10px' } }, 'Kişi başı tüketim (L/gün)'), kvRows([...Object.entries(cfg.useCoeff).map(([k, v]) => [{ drinking: 'İçme suyu', tea: 'Çay & kahve', cooking: 'Yemek' }[k], dec(v)]), ['Evcil hayvan (hane)', dec(cfg.petFlatL)], ...Object.entries(cfg.presenceMult).map(([k, v]) => [{ home: 'Evde çarpanı', mixed: 'Karışık çarpanı', away: 'Dışarıda çarpanı' }[k], `×${dec(v)}`])])),
          h('div', {}, h('div', { class: 'label hint', style: { marginBottom: '10px' } }, 'Maliyet (₺/L)'), kvRows([...Object.entries(cfg.sourceCostTlPerL).map(([k, v]) => [{ damacana: 'Damacana', pet: 'Pet şişe', tap: 'Şebeke', mixed: 'Karışık' }[k], dec(v)]), ['Filtre hijyen sınırı', `${cfg.timeCapDays} gün`]])),
        ),
      ),
    ),
  )
}
