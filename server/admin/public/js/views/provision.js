import { get, post } from '../api.js'
import { h } from '../dom.js'
import { num } from '../fmt.js'
import { icon } from '../icons.js'
import { copyText, toast } from '../ui.js'

function codesGrid(items) {
  const fmt = (c) => c.replace(/(.{4})/g, '$1 ').trim()
  return h(
    'div',
    { class: 'codes-grid' },
    items.map((i) => h('div', { class: 'c' }, h('div', {}, h('b', {}, fmt(i.code)), h('small', {}, i.serialNo)), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Kopyala', onClick: () => copyText(i.code) }, icon('copy')))),
  )
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = h('a', { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function provisionView(root, ctx) {
  const [config, ov] = await Promise.all([get('/api/config'), get('/api/overview')])
  const modelOpts = (sel) => config.models.map((m) => h('option', { value: m.id, selected: m.id === sel }, m.name))

  const resultHost = h('div', {})
  const model = h('select', { class: 'input', 'aria-label': 'Model' }, modelOpts('pro'))
  const count = h('input', { class: 'input', type: 'number', min: '1', max: '500', value: '10', 'aria-label': 'Adet' })

  const generate = async (e) => {
    const btn = e.currentTarget
    btn.disabled = true
    try {
      const r = await post('/api/provision', { model: model.value, count: Number(count.value) })
      toast(`${r.items.length} kod üretildi`)
      const csv = 'kod,seri_no,model\n' + r.items.map((i) => `${i.code},${i.serialNo},${r.model}`).join('\n') + '\n'
      resultHost.replaceChildren(
        h(
          'div',
          { class: 'card mt', style: { borderColor: 'var(--line-strong)' } },
          h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, `Yeni kodlar · ${r.items.length}`), h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onClick: () => copyText(r.items.map((i) => i.code).join('\n'), 'Tüm kodlar kopyalandı') }, icon('copy'), 'Hepsini kopyala'), h('button', { class: 'btn sm primary', type: 'button', onClick: () => download(`mukansa-kodlar-${new Date().toISOString().slice(0, 10)}.csv`, csv) }, icon('download'), 'CSV indir'))),
          h('div', { class: 'notice', style: { marginBottom: '14px' } }, 'Aktivasyon kodları kimlik bilgisidir. Etiket basımı için CSV’yi indirin ve güvenli saklayın.'),
          codesGrid(r.items),
        ),
      )
    } catch (err) {
      toast(err.message, 'err')
    } finally {
      btn.disabled = false
    }
  }

  const importModel = h('select', { class: 'input', 'aria-label': 'Varsayılan model' }, modelOpts('pro'))
  const importText = h('textarea', { class: 'input mono', rows: '6', placeholder: 'ABCD1234EFGH\nWXYZ98765432,standard', 'aria-label': 'Kodlar' })
  const importResult = h('div', {})
  const doImport = async (e) => {
    const btn = e.currentTarget
    btn.disabled = true
    try {
      const r = await post('/api/provision/import', { text: importText.value, model: importModel.value })
      importResult.replaceChildren(
        h('div', { class: 'row', style: { marginTop: '12px' } }, h('span', { class: 'chip ok' }, `${r.added} eklendi`), r.duplicates ? h('span', { class: 'chip warn' }, `${r.duplicates} zaten vardı`) : null, r.invalid.length ? h('span', { class: 'chip danger' }, `${r.invalid.length} geçersiz`) : null),
        r.invalid.length ? h('div', { class: 'hint mono', style: { marginTop: '8px' } }, `Geçersiz satırlar: ${r.invalid.slice(0, 5).join(' | ')}`) : null,
      )
      if (r.added) toast(`${r.added} kod içe aktarıldı`)
    } catch (err) {
      toast(err.message, 'err')
    } finally {
      btn.disabled = false
    }
  }

  root.replaceChildren(
    h(
      'div',
      { class: 'reveal' },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Üretim'), h('h1', { class: 'page-title' }, 'Aktivasyon ', h('em', {}, 'kodları')), h('div', { class: 'page-sub' }, 'Her cihaz kutusuna basılan 12 haneli kod, kullanıcının uygulamada cihazı bağlamasını sağlar.'))),
      h(
        'div',
        { class: 'grid g-3' },
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Kod üret')), h('div', { class: 'field' }, h('label', {}, 'Model'), model), h('div', { class: 'field' }, h('label', {}, 'Adet (1–500)'), count), h('button', { class: 'btn primary block', type: 'button', onClick: generate }, icon('plus'), 'Kodları üret')),
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Listeden içe aktar')), h('div', { class: 'field' }, h('label', {}, 'Kodlar (her satıra bir kod)'), importText), h('div', { class: 'field' }, h('label', {}, 'Model belirtilmeyenler için'), importModel), h('button', { class: 'btn block', type: 'button', onClick: doImport }, icon('download'), 'İçe aktar'), importResult),
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Dışa aktar')),
          h('div', { class: 'kpi', style: { padding: 0 } }, h('div', { class: 'label' }, 'Bekleyen kod'), h('div', { class: 'value' }, num(ov.totals.pending))),
          h('p', { class: 'hint' }, 'Henüz aktive edilmemiş ve engellenmemiş kodların CSV listesi. İndirme işlemi denetim günlüğüne yazılır.'),
          h('a', { class: 'btn block', href: '/api/provision/export?scope=pending', download: '' }, icon('download'), 'Bekleyenleri indir'),
          h('a', { class: 'btn block', style: { marginTop: '10px' }, href: '/api/provision/export?scope=all', download: '' }, icon('download'), 'Tümünü indir'),
        ),
      ),
      resultHost,
    ),
  )
}
