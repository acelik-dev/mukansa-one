import { h, s } from './dom.js'
import { icon } from './icons.js'
import { STATUS, TONE, num } from './fmt.js'

// ---------------------------------------------------------------- toast
let toastHost
export function toast(message, type = 'ok') {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' })
    document.body.appendChild(toastHost)
  }
  const el = h('div', { class: `toast ${type}` }, icon(type === 'ok' ? 'check' : 'alert'), h('div', {}, message))
  toastHost.appendChild(el)
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s'
    el.style.opacity = '0'
    el.style.transform = 'translateX(20px)'
    setTimeout(() => el.remove(), 320)
  }, type === 'ok' ? 3200 : 5200)
}

// ---------------------------------------------------------------- modal
/**
 * @param {{title: string, body?: Node|string|Node[], actions: {label: string, value?: any, kind?: string, onClick?: () => Promise<any>|any}[]}} opts
 * Promise<any>: tıklanan eylemin değeri (Vazgeç → undefined). onClick verilirse dönüş değeri kullanılır; hata fırlatırsa modal açık kalır.
 */
export function modal({ title, body, actions }) {
  return new Promise((resolve) => {
    const close = (v) => {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      resolve(v)
    }
    const onKey = (e) => e.key === 'Escape' && close(undefined)
    const buttons = actions.map((a) => {
      const b = h(
        'button',
        {
          class: `btn ${a.kind ?? ''}`,
          type: 'button',
          onClick: async () => {
            if (!a.onClick) return close(a.value)
            b.disabled = true
            const label = b.textContent
            b.replaceChildren(h('span', { class: 'spin' }))
            try {
              close(await a.onClick())
            } catch (err) {
              b.disabled = false
              b.textContent = label
              toast(err.message || 'İşlem başarısız', 'err')
            }
          },
        },
        a.label,
      )
      return b
    })
    const overlay = h(
      'div',
      { class: 'overlay', onClick: (e) => e.target === overlay && close(undefined) },
      h(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h3', {}, title),
        body,
        h('div', { class: 'actions' }, buttons),
      ),
    )
    document.body.appendChild(overlay)
    document.addEventListener('keydown', onKey)
    overlay.querySelector('input, textarea, select, .btn.primary, .btn.danger')?.focus()
  })
}

export async function confirmDialog({ title, text, confirmLabel = 'Onayla', danger = false, onConfirm }) {
  const r = await modal({
    title,
    body: h('p', {}, text),
    actions: [
      { label: 'Vazgeç', value: undefined },
      { label: confirmLabel, kind: danger ? 'danger' : 'primary', value: true, onClick: async () => (onConfirm ? (await onConfirm(), true) : true) },
    ],
  })
  return r === true
}

export function copyText(text, label = 'Kopyalandı') {
  const done = () => toast(label)
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => toast('Kopyalanamadı', 'err'))
  else {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } })
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    done()
  }
}

// ---------------------------------------------------------------- küçük parçalar
export const statusChip = (status) => h('span', { class: `chip ${STATUS[status]?.cls ?? 'mute'}` }, STATUS[status]?.label ?? status)
export const toneChip = (tone) => h('span', { class: `chip ${TONE[tone]?.cls ?? 'mute'}` }, TONE[tone]?.label ?? tone)

export function meter(percent, tone, cap) {
  return h(
    'div',
    { class: `meter ${TONE[tone]?.meter ?? ''}` },
    h('div', { class: 'bar' }, h('i', { style: { width: `${Math.max(2, Math.min(100, percent))}%` } })),
    cap ? h('div', { class: 'cap' }, cap) : null,
  )
}

export function skeleton(height = 120, extra = {}) {
  return h('div', { class: 'skeleton', style: { height: `${height}px`, ...extra } })
}

export function empty(title, text) {
  return h('div', { class: 'empty' }, h('div', { class: 'big' }, title), text ? h('div', {}, text) : null)
}

export function tabsSeg(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' })
  const paint = (v) => {
    wrap.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          { type: 'button', class: o.value === v ? 'on' : '', onClick: () => (paint(o.value), onChange(o.value)) },
          o.label,
          o.count !== undefined ? h('span', { class: 'n' }, num(o.count)) : null,
        ),
      ),
    )
  }
  paint(value)
  wrap.update = paint
  return wrap
}

// ---------------------------------------------------------------- sıvı gösterge (filtre ömrü)
const TONE_COLORS = {
  ok: ['#7fd4e4', '#2a8ea6', '#0f4a58'],
  warning: ['#f0b95e', '#c98424', '#6b4310'],
  danger: ['#ff8a78', '#d24a38', '#6b1f16'],
}
let gaugeSeq = 0

export function liquidGauge(percent, tone = 'ok', size = 168, caption = 'kalan ömür') {
  const id = `g${++gaugeSeq}`
  const [c1, c2, c3] = TONE_COLORS[tone] ?? TONE_COLORS.ok
  const r = size / 2 - 6
  const cx = size / 2
  const level = size - 6 - (Math.max(0, Math.min(100, percent)) / 100) * (size - 12)
  const amp = Math.min(7, size * 0.04)
  const wl = size // dalga boyu = gösterge genişliği → -%50 kaydırma kesintisiz döngü
  const wavePath = (phase) => {
    let d = `M0 ${level}`
    for (let x = 0; x <= wl * 2 + 4; x += 4) d += ` L${x} ${(level + Math.sin(((x + phase) / wl) * Math.PI * 2) * amp).toFixed(2)}`
    return d + ` L${wl * 2} ${size} L0 ${size} Z`
  }
  const svg = s(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': `${Math.round(percent)}% ${caption}` },
    s(
      'defs',
      {},
      s('clipPath', { id: `${id}c` }, s('circle', { cx, cy: cx, r })),
      s(
        'linearGradient',
        { id: `${id}g`, x1: '0', y1: '0', x2: '0', y2: '1' },
        s('stop', { offset: '0', 'stop-color': c1, 'stop-opacity': '.95' }),
        s('stop', { offset: '.55', 'stop-color': c2, 'stop-opacity': '.9' }),
        s('stop', { offset: '1', 'stop-color': c3, 'stop-opacity': '.95' }),
      ),
    ),
    s('circle', { cx, cy: cx, r, fill: 'rgba(3,8,10,.6)', stroke: 'rgba(200,161,90,.35)', 'stroke-width': '1.5' }),
    s(
      'g',
      { 'clip-path': `url(#${id}c)` },
      s('path', { class: 'wave2', d: wavePath(wl / 2), fill: `url(#${id}g)`, style: 'transform-box: fill-box' }),
      s('path', { class: 'wave1', d: wavePath(0), fill: `url(#${id}g)`, style: 'transform-box: fill-box' }),
    ),
    s('circle', { cx, cy: cx, r: r - 0.5, fill: 'none', stroke: 'rgba(255,255,255,.07)', 'stroke-width': '1' }),
    s('text', {
      x: cx,
      y: cx + size * 0.045,
      'text-anchor': 'middle',
      style: `font-family: var(--f-display); font-weight: 300; font-size: ${size * 0.27}px; fill: #fff; paint-order: stroke; stroke: rgba(3,8,10,.55); stroke-width: 3px;`,
    }, `${Math.round(percent)}%`),
    s('text', {
      x: cx,
      y: cx + size * 0.19,
      'text-anchor': 'middle',
      style: `font-size: ${size * 0.07}px; letter-spacing: .16em; text-transform: uppercase; fill: rgba(255,255,255,.75); font-weight: 600;`,
    }, caption),
  )
  return h('div', { class: 'gauge' }, svg)
}

// ---------------------------------------------------------------- grafikler
/** data: [{label, value}] — alan grafiği; etiketler her n'de bir */
export function areaChart(data, { height = 190, color = '#7fd4e4', labelEvery = 5, format = num } = {}) {
  const W = 640
  const H = height
  const pad = { l: 30, r: 10, t: 12, b: 24 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const max = Math.max(1, ...data.map((d) => d.value))
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4
  const x = (i) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v) => pad.t + ih - (v / niceMax) * ih
  const pts = data.map((d, i) => [x(i), y(d.value)])
  // yumuşak eğri (Catmull-Rom → Bézier)
  let line = pts.length ? `M${pts[0][0]} ${pts[0][1]}` : ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const t = 0.18
    const clampY = (v) => Math.min(pad.t + ih, Math.max(pad.t, v)) // Bézier aşımı eksenin dışına çıkmasın
    line += ` C${p1[0] + (p2[0] - p0[0]) * t} ${clampY(p1[1] + (p2[1] - p0[1]) * t)}, ${p2[0] - (p3[0] - p1[0]) * t} ${clampY(p2[1] - (p3[1] - p1[1]) * t)}, ${p2[0]} ${p2[1]}`
  }
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]} ${pad.t + ih} L${pts[0][0]} ${pad.t + ih} Z` : ''
  const id = `a${++gaugeSeq}`
  const grid = [0, 1, 2, 3, 4].map((i) => {
    const v = (niceMax / 4) * i
    return [s('line', { class: 'grid-line', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }), s('text', { x: pad.l - 6, y: y(v) + 3, 'text-anchor': 'end' }, format(v))]
  })
  return s(
    'svg',
    { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Zaman grafiği', style: 'display:block' },
    s('defs', {}, s('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' }, s('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '.38' }), s('stop', { offset: '1', 'stop-color': color, 'stop-opacity': '0' }))),
    grid,
    s('path', { d: area, fill: `url(#${id})` }),
    s('path', { d: line, fill: 'none', stroke: color, 'stroke-width': '2.2', 'stroke-linecap': 'round' }),
    data.map((d, i) => [
      d.value > 0 ? s('circle', { cx: x(i), cy: y(d.value), r: 3.4, fill: '#0f1a20', stroke: color, 'stroke-width': '2' }, s('title', {}, `${d.label}: ${format(d.value)}`)) : null,
      i % labelEvery === 0 || i === data.length - 1 ? s('text', { x: x(i), y: H - 6, 'text-anchor': i === data.length - 1 ? 'end' : i === 0 ? 'start' : 'middle' }, d.short ?? d.label) : null,
    ]),
  )
}

/** dikey sütunlar: [{label, value, color}] */
export function bars(items) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return h(
    'div',
    { class: 'bars' },
    items.map((i) =>
      h(
        'div',
        { class: 'b' },
        h('b', {}, num(i.value)),
        h('i', { style: { height: `${Math.max(2, (i.value / max) * 100)}%`, background: i.color, boxShadow: i.value ? `0 0 22px -6px ${i.color}` : 'none', opacity: i.value ? 1 : 0.25 } }),
        h('span', {}, i.label),
      ),
    ),
  )
}

export function hbars(items, format = num) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return empty('Henüz veri yok')
  return h(
    'div',
    { class: 'hbar' },
    items.map((i) =>
      h('div', { class: 'r' }, h('div', { class: 'k', title: i.label }, i.label), h('div', { class: 'tr' }, h('i', { style: { width: `${(i.value / max) * 100}%` } })), h('div', { class: 'v' }, format(i.value))),
    ),
  )
}
