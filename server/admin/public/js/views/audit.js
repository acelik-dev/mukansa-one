import { get } from '../api.js'
import { h } from '../dom.js'
import { ago, AUDIT, dateTime } from '../fmt.js'
import { empty } from '../ui.js'

const tone = (a) => (a === 'login_failed' || a === 'block' || a === 'delete_device' || a === 'reset_activation' ? 'danger' : a.startsWith('reveal') || a.startsWith('export') ? 'warn' : 'mute')

export async function auditView(root, ctx) {
  const { items } = await get('/api/audit?limit=200')
  root.replaceChildren(
    h(
      'div',
      { class: 'reveal' },
      h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Güvenlik'), h('h1', { class: 'page-title' }, 'Denetim ', h('em', {}, 'günlüğü')), h('div', { class: 'page-sub' }, 'Panelde yapılan her giriş ve değişiklik. Kayıtlar silinemez.'))),
      h(
        'div',
        { class: 'card' },
        items.length
          ? h(
              'div',
              { class: 'table-wrap' },
              h(
                'table',
                { class: 't' },
                h('thead', {}, h('tr', {}, ['Zaman', 'Yönetici', 'İşlem', 'Cihaz', 'Ayrıntı'].map((c) => h('th', {}, c)))),
                h(
                  'tbody',
                  {},
                  items.map((a) =>
                    h(
                      'tr',
                      { class: a.deviceId ? 'click' : '', onClick: a.deviceId ? () => ctx.navigate(`/devices/${a.deviceId}`) : null },
                      h('td', { style: { whiteSpace: 'nowrap' } }, dateTime(a.at), h('div', { class: 'sub' }, ago(a.at))),
                      h('td', {}, a.admin ?? '—'),
                      h('td', {}, h('span', { class: `chip ${tone(a.action)}` }, AUDIT[a.action] ?? a.action)),
                      h('td', { class: 'serial' }, a.serialNo ?? ''),
                      h('td', { class: 'sub' }, a.detail ?? ''),
                    ),
                  ),
                ),
              ),
            )
          : empty('Kayıt yok'),
      ),
    ),
  )
}
