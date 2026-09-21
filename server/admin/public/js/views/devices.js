import { get } from '../api.js'
import { debounce, h } from '../dom.js'
import { ago, date, num, STATUS } from '../fmt.js'
import { icon } from '../icons.js'
import { empty, meter, skeleton, statusChip, tabsSeg } from '../ui.js'

// Sayfadan ayrılıp dönünce filtreler korunur
const state = { q: '', status: 'all', model: 'all', tone: 'all', sort: 'created', dir: 'desc', page: 1 }

export function setListFilter(patch) {
  Object.assign(state, { page: 1 }, patch)
}

const COLS = [
  { key: 'serial', label: 'Seri no', sort: true },
  { label: 'Model' },
  { label: 'Durum' },
  { key: 'region', label: 'Bölge · hane', sort: true },
  { key: 'filter', label: 'Filtre', sort: true },
  { key: 'activated', label: 'Aktivasyon', sort: true },
  { key: 'seen', label: 'Son görülme', sort: true },
]

export async function devicesView(root, ctx) {
  const models = await get('/api/config').then((c) => c.models)
  const modelName = Object.fromEntries(models.map((m) => [m.id, m.name.replace('Mukansa One — ', '')]))

  const tableHost = h('div', {})
  const statusHost = h('div', {})
  let counts = null

  const load = async () => {
    const qs = new URLSearchParams({ ...state, pageSize: '20' })
    for (const k of [...qs.keys()]) if (qs.get(k) === 'all' || qs.get(k) === '') qs.delete(k)
    const data = await get(`/api/devices?${qs}`)
    paint(data)
  }

  const loadCounts = async () => {
    const all = await get('/api/overview')
    counts = all.totals
    statusHost.replaceChildren(
      tabsSeg(
        [
          { value: 'all', label: 'Tümü', count: counts.devices },
          { value: 'ready', label: 'Kurulu', count: counts.ready },
          { value: 'activated', label: 'Aktive', count: counts.activated },
          { value: 'pending', label: 'Bekliyor', count: counts.pending },
          { value: 'blocked', label: 'Engelli', count: counts.blocked },
        ],
        state.status,
        (v) => ((state.status = v), (state.page = 1), load()),
      ),
    )
  }

  const paint = (data) => {
    if (!data.total) {
      tableHost.replaceChildren(empty('Eşleşen cihaz yok', 'Aramayı veya filtreleri değiştirmeyi deneyin.'))
      return
    }
    const now = Date.now()
    const head = h(
      'tr',
      {},
      COLS.map((c) =>
        h(
          'th',
          {
            class: c.sort ? 'sortable' : '',
            onClick: c.sort
              ? () => {
                  if (state.sort === c.key) state.dir = state.dir === 'asc' ? 'desc' : 'asc'
                  else Object.assign(state, { sort: c.key, dir: c.key === 'filter' || c.key === 'serial' || c.key === 'region' ? 'asc' : 'desc' })
                  load()
                }
              : null,
          },
          c.label,
          c.key === state.sort ? h('span', { class: 'arr' }, state.dir === 'asc' ? '↑' : '↓') : null,
        ),
      ),
    )
    const rows = data.items.map((d) =>
      h(
        'tr',
        { class: 'click', tabindex: '0', onClick: () => ctx.navigate(`/devices/${d.id}`), onKeydown: (e) => e.key === 'Enter' && ctx.navigate(`/devices/${d.id}`) },
        h('td', { class: 'serial' }, d.serialNo, d.note ? h('div', { class: 'sub', style: { fontFamily: 'var(--f-ui)', letterSpacing: 0 } }, d.note.length > 34 ? `${d.note.slice(0, 34)}…` : d.note) : null),
        h('td', {}, h('span', { class: 'tag' }, modelName[d.modelId] ?? d.modelId)),
        h('td', {}, statusChip(d.status)),
        h('td', {}, d.region ?? h('span', { class: 'sub' }, '—'), d.people ? h('div', { class: 'sub' }, `${d.people} kişi`) : null),
        h('td', { style: { minWidth: '150px' } }, d.filter ? meter(d.filter.percent, d.filter.tone, [h('b', {}, `%${Math.round(d.filter.percent)}`), h('span', {}, `${d.filter.days} gün`)]) : h('span', { class: 'sub' }, '—')),
        h('td', {}, d.activatedAt ? [date(d.activatedAt), h('div', { class: 'sub' }, ago(d.activatedAt, now))] : h('span', { class: 'sub' }, '—')),
        h('td', {}, d.lastSeenAt ? [ago(d.lastSeenAt, now), h('div', { class: 'sub' }, `${d.sessions} oturum${d.pushDevices ? ' · bildirim' : ''}`)] : h('span', { class: 'sub' }, '—')),
      ),
    )
    const from = (data.page - 1) * data.pageSize + 1
    const to = Math.min(data.total, data.page * data.pageSize)
    tableHost.replaceChildren(
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', {}, head), h('tbody', {}, rows))),
      h(
        'div',
        { class: 'pager' },
        h('span', {}, `${num(from)}–${num(to)} / ${num(data.total)} cihaz`),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn sm', type: 'button', disabled: data.page <= 1, onClick: () => ((state.page = data.page - 1), load()) }, icon('back'), 'Önceki'),
          h('span', {}, `${data.page} / ${data.pages}`),
          h('button', { class: 'btn sm', type: 'button', disabled: data.page >= data.pages, onClick: () => ((state.page = data.page + 1), load()) }, 'Sonraki', icon('arrow')),
        ),
      ),
    )
  }

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Seri no, aktivasyon kodu, bölge veya not ara…', value: state.q, 'aria-label': 'Ara' })
  search.addEventListener(
    'input',
    debounce(() => ((state.q = search.value), (state.page = 1), load()), 250),
  )
  const modelSel = h('select', { class: 'input', 'aria-label': 'Model', style: { width: 'auto' }, onChange: (e) => ((state.model = e.target.value), (state.page = 1), load()) }, h('option', { value: 'all' }, 'Tüm modeller'), models.map((m) => h('option', { value: m.id, selected: state.model === m.id }, m.name.replace('Mukansa One — ', ''))))
  const toneSel = h(
    'select',
    { class: 'input', 'aria-label': 'Filtre durumu', style: { width: 'auto' }, onChange: (e) => ((state.tone = e.target.value), (state.page = 1), load()) },
    [['all', 'Tüm filtreler'], ['ok', 'Sağlıklı'], ['warning', 'Uyarı'], ['danger', 'Kritik']].map(([v, l]) => h('option', { value: v, selected: state.tone === v }, l)),
  )

  root.replaceChildren(
    h(
      'div',
      { class: 'reveal' },
      h(
        'div',
        { class: 'page-head' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'Envanter'), h('h1', { class: 'page-title' }, 'Cihazlar')),
        h('div', { class: 'head-actions' }, h('a', { class: 'btn primary', href: '#/provision' }, icon('plus'), 'Kod üret')),
      ),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'row', style: { marginBottom: '16px' } }, h('div', { class: 'grow', style: { minWidth: '240px', position: 'relative' } }, search), modelSel, toneSel),
        h('div', { style: { marginBottom: '18px' } }, statusHost),
        tableHost,
      ),
    ),
  )
  tableHost.replaceChildren(skeleton(320))
  await Promise.all([loadCounts(), load()])
}

export { STATUS }
