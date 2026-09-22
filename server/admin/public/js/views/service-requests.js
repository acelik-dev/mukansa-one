import { get, post } from '../api.js'
import { h } from '../dom.js'
import { ago, dateTime, SERVICE_CATEGORY, SERVICE_STATUS } from '../fmt.js'
import { empty, modal, skeleton, tabsSeg, toast } from '../ui.js'

const STATUS_ORDER = ['open', 'in_progress', 'done', 'cancelled']

async function openUpdateModal(req, onDone) {
  const statusSel = h(
    'select',
    { class: 'input' },
    STATUS_ORDER.map((s) => h('option', { value: s, selected: s === req.status }, SERVICE_STATUS[s]?.label ?? s)),
  )
  const noteInput = h('textarea', { class: 'input', rows: '4', placeholder: 'Yönetici notu (isteğe bağlı) — örn. randevu tarihi, teknisyen adı' })
  noteInput.value = req.adminNote ?? ''

  await modal({
    title: `${req.serialNo} — talep #${req.id}`,
    body: h(
      'div',
      {},
      h('p', { style: { marginBottom: '14px' } }, req.description),
      h('div', { class: 'field' }, h('label', {}, 'Durum'), statusSel),
      h('div', { class: 'field' }, h('label', {}, 'Not'), noteInput),
    ),
    actions: [
      { label: 'Vazgeç' },
      {
        label: 'Kaydet',
        kind: 'primary',
        onClick: async () => {
          await post(`/api/service-requests/${req.id}/action`, { status: statusSel.value, adminNote: noteInput.value })
          toast('Talep güncellendi')
          onDone()
        },
      },
    ],
  })
}

export async function serviceRequestsView(root, ctx) {
  let status = 'all'
  const host = h('div', {})

  const load = async () => {
    host.replaceChildren(skeleton(280))
    const qs = status === 'all' ? '' : `?status=${status}`
    const data = await get(`/api/service-requests${qs}`)
    if (!data.items.length) {
      host.replaceChildren(empty('Bu durumda talep yok', 'Kullanıcılar uygulamadan teknik servis talebi gönderdiğinde burada görünür.'))
      return
    }
    host.replaceChildren(
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 't' },
          h('thead', {}, h('tr', {}, ['Tarih', 'Cihaz', 'Kategori', 'Açıklama', 'Telefon', 'Durum'].map((c) => h('th', {}, c)))),
          h(
            'tbody',
            {},
            data.items.map((r) =>
              h(
                'tr',
                { class: 'click', onClick: () => openUpdateModal(r, load) },
                h('td', { style: { whiteSpace: 'nowrap' } }, dateTime(r.createdAt), h('div', { class: 'sub' }, ago(r.createdAt))),
                h(
                  'td',
                  { class: 'serial', onClick: (e) => (e.stopPropagation(), ctx.navigate(`/devices/${r.deviceId}`)) },
                  r.serialNo,
                ),
                h('td', {}, h('span', { class: `chip ${SERVICE_CATEGORY[r.category]?.cls ?? 'mute'}` }, SERVICE_CATEGORY[r.category]?.label ?? r.category)),
                h('td', { style: { maxWidth: '360px' } }, r.description),
                h('td', { class: 'mono' }, r.contactPhone, r.contactName ? h('div', { class: 'sub' }, r.contactName) : null),
                h('td', {}, h('span', { class: `chip ${SERVICE_STATUS[r.status]?.cls ?? 'mute'}` }, SERVICE_STATUS[r.status]?.label ?? r.status)),
              ),
            ),
          ),
        ),
      ),
    )
  }

  root.replaceChildren(
    h(
      'div',
      { class: 'reveal' },
      h(
        'div',
        { class: 'page-head' },
        h(
          'div',
          {},
          h('div', { class: 'eyebrow' }, 'Destek'),
          h('h1', { class: 'page-title' }, 'Teknik servis ', h('em', {}, 'talepleri')),
          h('div', { class: 'page-sub' }, 'Uygulamadan gelen arıza, bakım ve filtre değişimi talepleri. Satıra tıklayarak durumu güncelleyin.'),
        ),
      ),
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { style: { marginBottom: '18px' } },
          tabsSeg(
            [
              { value: 'all', label: 'Tümü' },
              { value: 'open', label: SERVICE_STATUS.open.label },
              { value: 'in_progress', label: SERVICE_STATUS.in_progress.label },
              { value: 'done', label: SERVICE_STATUS.done.label },
              { value: 'cancelled', label: SERVICE_STATUS.cancelled.label },
            ],
            status,
            (v) => ((status = v), load()),
          ),
        ),
        host,
      ),
    ),
  )
  await load()
}
