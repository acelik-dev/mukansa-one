import { get } from '../api.js'
import { countUp, h } from '../dom.js'
import { ago, date, KIND, num, tl, time } from '../fmt.js'
import { icon } from '../icons.js'
import { areaChart, bars, hbars, meter, skeleton, toneChip } from '../ui.js'

const shortDay = (iso) => {
  const [, m, d] = iso.split('-')
  return `${Number(d)}.${m}`
}

function kpi({ label, value, format = num, unit, foot, cls = '' }) {
  const n = h('span', {}, format(0))
  countUp(n, value, format)
  const v = h('div', { class: 'value' }, n, unit ? h('small', {}, unit) : null)
  return h('div', { class: `card kpi ${cls}` }, h('div', { class: 'label' }, label), v, h('div', { class: 'foot' }, foot))
}

export async function overviewView(root, ctx) {
  root.replaceChildren(
    h('div', { class: 'grid g-4' }, skeleton(150), skeleton(150), skeleton(150), skeleton(150)),
    skeleton(160, { marginTop: '18px' }),
  )
  const d = await get('/api/overview')
  ctx.setAttention(d.health.warning + d.health.danger)

  const t = d.totals
  const sch = d.scheduler
  const schedChip = sch.lastError
    ? h('span', { class: 'chip danger' }, 'Zamanlayıcı hatası')
    : sch.intervalMin === 0
      ? h('span', { class: 'chip mute' }, 'Zamanlayıcı kapalı')
      : h('span', { class: `chip ${sch.pushDryRun ? 'warn' : 'ok'}` }, sch.pushDryRun ? 'Bildirimler test modunda' : `Zamanlayıcı ${sch.intervalMin} dk`)

  const page = h(
    'div',
    { class: 'reveal' },
    h(
      'div',
      { class: 'page-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Canlı durum'), h('h1', { class: 'page-title' }, 'Genel ', h('em', {}, 'bakış')), h('div', { class: 'page-sub' }, `${date(d.serverTime)} · son güncelleme ${time(d.serverTime)}`)),
      h('div', { class: 'head-actions' }, schedChip, h('button', { class: 'btn', type: 'button', onClick: () => ctx.reload() }, icon('refresh'), 'Yenile')),
    ),

    h(
      'div',
      { class: 'grid g-4' },
      kpi({
        label: 'Toplam cihaz',
        value: t.devices,
        foot: [h('span', {}, h('b', {}, num(t.ready)), ' kurulu'), h('span', {}, h('b', {}, num(t.activated)), ' aktive'), h('span', {}, h('b', {}, num(t.pending)), ' bekliyor')],
      }),
      kpi({ label: 'Kurulu hane', value: t.ready, cls: 'gold', foot: [h('span', {}, h('b', {}, num(d.fleet.people)), ' kişi'), h('span', {}, h('b', {}, num(t.pushDevices)), ' bildirim açık')] }),
      kpi({
        label: 'Filtre dikkat',
        value: d.health.warning + d.health.danger,
        cls: d.health.danger ? 'danger' : '',
        foot: [h('span', {}, h('b', {}, num(d.health.danger)), ' kritik'), h('span', {}, h('b', {}, num(d.health.warning)), ' uyarı'), h('span', {}, h('b', {}, num(d.health.ok)), ' sağlıklı')],
      }),
      kpi({ label: 'Bildirim · 7 gün', value: d.notifications.last7d, foot: Object.entries(d.notifications.byKind).map(([k, n]) => h('span', {}, h('b', {}, num(n)), ` ${KIND[k]?.label.toLowerCase() ?? k}`)).concat(d.notifications.last7d ? [] : [h('span', {}, 'henüz gönderim yok')]) }),
    ),

    h(
      'div',
      { class: 'card hero mt' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Filo etkisi · tahmini'), h('span', { class: 'card-note' }, 'Cihazda sensör yok; tüm değerler hane bilgisinden hesaplanır')),
      h(
        'div',
        { class: 'hero-grid' },
        ...[
          [d.fleet.totalLiters, 'L', 'arıtılmış su', (n) => num(n)],
          [d.fleet.savingTL, '', 'toplam tasarruf', (n) => tl(n)],
          [d.fleet.bottles, '', 'engellenen şişe', (n) => num(n)],
          [d.fleet.co2Kg, 'kg', 'CO₂ eşdeğeri', (n) => num(n)],
        ].map(([value, unit, cap, fmt]) => {
          const n = h('span', {}, fmt(0))
          countUp(n, value, fmt, 1200)
          return h('div', {}, h('div', { class: 'num' }, n, unit ? h('small', {}, unit) : null), h('div', { class: 'cap' }, cap))
        }),
      ),
    ),

    h(
      'div',
      { class: 'grid g-21 mt' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Aktivasyonlar · son 30 gün'), h('span', { class: 'card-note' }, `${num(d.activationsByDay.reduce((a, b) => a + b.count, 0))} yeni cihaz`)), areaChart(d.activationsByDay.map((x) => ({ label: x.day, short: shortDay(x.day), value: x.count })))),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Filtre sağlığı'), h('span', { class: 'card-note' }, 'kalan ömür')),
        bars([
          { label: '0–10%', value: d.buckets[0], color: '#ea6a58' },
          { label: '10–25', value: d.buckets[1], color: '#e6a94a' },
          { label: '25–50', value: d.buckets[2], color: '#7fd4e4' },
          { label: '50–75', value: d.buckets[3], color: '#5fb9d0' },
          { label: '75–100', value: d.buckets[4], color: '#3aa1b8' },
        ]),
      ),
    ),

    h(
      'div',
      { class: 'grid g-2 mt' },
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Dikkat gerektiren filtreler'), h('a', { class: 'card-note', href: '#/devices?tone=danger' }, 'Tümü →')),
        d.attention.length
          ? h(
              'div',
              { class: 'list' },
              d.attention.map((a) =>
                h(
                  'div',
                  { class: 'it click', onClick: () => ctx.navigate(`/devices/${a.id}`) },
                  h('div', { class: 'grow' }, h('div', { class: 'ttl mono' }, a.serialNo), h('div', { class: 'meta' }, a.region ?? 'Bölge yok')),
                  h('div', { style: { width: '140px' } }, meter(a.percent, a.tone, [h('span', {}, `%${Math.round(a.percent)}`), h('span', {}, `${a.days} gün`)])),
                  toneChip(a.tone),
                ),
              ),
            )
          : h('div', { class: 'empty' }, h('div', { class: 'big' }, 'Her şey yolunda'), h('div', {}, 'Değişim zamanı yaklaşan filtre yok.')),
      ),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Son bildirimler'), h('a', { class: 'card-note', href: '#/notifications' }, 'Günlük →')),
        d.recentNotifications.length
          ? h(
              'div',
              { class: 'list' },
              d.recentNotifications.map((n) =>
                h(
                  'div',
                  { class: 'it click', onClick: () => ctx.navigate(`/devices/${n.deviceId}`) },
                  h('div', { class: 'dot' }, icon('bell')),
                  h('div', { class: 'grow' }, h('div', { class: 'ttl' }, n.title), h('div', { class: 'meta' }, `${n.serialNo} · ${ago(n.at, d.serverTime)}`)),
                  h('span', { class: `chip ${KIND[n.kind]?.cls ?? 'mute'}` }, KIND[n.kind]?.label ?? n.kind),
                ),
              ),
            )
          : h('div', { class: 'empty' }, h('div', { class: 'big' }, 'Henüz bildirim yok'), h('div', {}, 'Filtre uyarıları ve haftalık özetler burada görünür.')),
      ),
    ),

    h(
      'div',
      { class: 'grid g-2 mt' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Modeller')), hbars(d.models.map((m) => ({ label: m.name.replace('Mukansa One — ', ''), value: m.count })))),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Bölgeler')), hbars(d.regions.map((r) => ({ label: r.region, value: r.count })))),
    ),
  )
  root.replaceChildren(page)
}
