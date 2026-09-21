import { get } from '../api.js'
import { h } from '../dom.js'
import { ago, dateTime, KIND } from '../fmt.js'
import { icon } from '../icons.js'
import { empty, skeleton, tabsSeg } from '../ui.js'

export async function notificationsView(root, ctx) {
  let kind = 'all'
  const host = h('div', {})

  const load = async () => {
    host.replaceChildren(skeleton(260))
    const { items } = await get(`/api/notifications?limit=150&kind=${kind}`)
    if (!items.length) {
      host.replaceChildren(empty('Bu türde bildirim yok', 'Filtre uyarıları, haftalık özetler ve kilometre taşları gönderildikçe burada görünür.'))
      return
    }
    host.replaceChildren(
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 't' },
          h('thead', {}, h('tr', {}, ['Zaman', 'Cihaz', 'Tür', 'Mesaj', 'Durum'].map((c) => h('th', {}, c)))),
          h(
            'tbody',
            {},
            items.map((n) =>
              h(
                'tr',
                { class: 'click', onClick: () => ctx.navigate(`/devices/${n.deviceId}`) },
                h('td', { style: { whiteSpace: 'nowrap' } }, dateTime(n.at), h('div', { class: 'sub' }, ago(n.at))),
                h('td', { class: 'serial' }, n.serialNo),
                h('td', {}, h('span', { class: `chip ${KIND[n.kind]?.cls ?? 'mute'}` }, KIND[n.kind]?.label ?? n.kind)),
                h('td', { style: { maxWidth: '420px' } }, h('b', {}, n.title), h('div', { class: 'sub' }, n.body)),
                h('td', {}, n.delivered ? h('span', { class: 'chip ok' }, 'İletildi') : h('span', { class: 'chip danger' }, 'İletilemedi')),
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
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Günlük'), h('h1', { class: 'page-title' }, 'Bildirimler'), h('div', { class: 'page-sub' }, 'Sunucunun kullanıcılara gönderdiği tüm bildirimler. Tekil test bildirimi için cihaz sayfasını kullanın.'))),
      h(
        'div',
        { class: 'card' },
        h('div', { style: { marginBottom: '18px' } }, tabsSeg([{ value: 'all', label: 'Tümü' }, { value: 'filter', label: 'Filtre' }, { value: 'weekly', label: 'Haftalık' }, { value: 'milestone', label: 'Kilometre taşı' }, { value: 'manual', label: 'Manuel' }], kind, (v) => ((kind = v), load()))),
        host,
      ),
    ),
  )
  await load()
}

export { icon }
