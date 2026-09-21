// Küçük DOM yardımcısı. Metinler her zaman text node olarak eklenir (innerHTML kullanılmaz → XSS yok).
const SVG_NS = 'http://www.w3.org/2000/svg'

function create(ns, tag, props, kids) {
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag)
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'class') el.setAttribute('class', v)
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
    else if (k === 'dataset') Object.assign(el.dataset, v)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'value' && !ns) el.value = v
    else if (k === 'checked' && !ns) el.checked = !!v
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  append(el, kids)
  return el
}

function append(el, kids) {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue
    if (Array.isArray(kid)) append(el, kid)
    else if (kid instanceof Node) el.appendChild(kid)
    else el.appendChild(document.createTextNode(String(kid)))
  }
}

export const h = (tag, props, ...kids) => create(null, tag, props, kids)
export const s = (tag, props, ...kids) => create(SVG_NS, tag, props, kids)

export function clear(el) {
  el.replaceChildren()
  return el
}

/** Sayıyı 0'dan hedefe kaydırır (KPI kartları için) */
export function countUp(el, target, format = (n) => String(Math.round(n)), ms = 900) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || !Number.isFinite(target) || target === 0) {
    el.textContent = format(target)
    return
  }
  const t0 = performance.now()
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / ms)
    const eased = 1 - Math.pow(1 - p, 3)
    el.textContent = format(target * eased)
    if (p < 1 && el.isConnected) requestAnimationFrame(tick)
    else el.textContent = format(target)
  }
  requestAnimationFrame(tick)
}

export function debounce(fn, ms) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
