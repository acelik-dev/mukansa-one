import { get, post } from './api.js'
import { h } from './dom.js'
import { brandMark, icon } from './icons.js'
import { empty } from './ui.js'
import { auditView } from './views/audit.js'
import { deviceView } from './views/device.js'
import { devicesView, setListFilter } from './views/devices.js'
import { loginView } from './views/login.js'
import { notificationsView } from './views/notifications.js'
import { overviewView } from './views/overview.js'
import { provisionView } from './views/provision.js'
import { serviceRequestsView } from './views/service-requests.js'
import { systemView } from './views/system.js'

const app = document.getElementById('app')

const NAV = [
  { path: '/overview', label: 'Genel bakış', icon: 'layout' },
  { path: '/devices', label: 'Cihazlar', icon: 'droplet', badge: true },
  { path: '/provision', label: 'Aktivasyon kodları', icon: 'key' },
  { path: '/service-requests', label: 'Servis talepleri', icon: 'wrench' },
  { path: '/notifications', label: 'Bildirimler', icon: 'bell' },
  { path: '/audit', label: 'Denetim günlüğü', icon: 'shield' },
  { path: '/system', label: 'Sistem & ayarlar', icon: 'sliders' },
]

const state = { me: null, attention: 0, seq: 0, refreshTimer: null }
let shell = null

function showLogin() {
  clearInterval(state.refreshTimer)
  state.me = null
  shell = null
  loginView(app, () => boot())
}

async function boot() {
  try {
    const s = await get('/api/session')
    state.me = s.admin
    buildShell()
    route()
    get('/api/overview').then((o) => setAttention(o.health.warning + o.health.danger)).catch(() => {})
  } catch {
    showLogin()
  }
}

function setAttention(n) {
  state.attention = n
  const el = document.querySelector('.nav .badge')
  if (el) {
    el.textContent = String(n)
    el.hidden = n === 0
  }
}

function navigate(path) {
  if (location.hash === `#${path}`) route()
  else location.hash = path
}

function buildShell() {
  const sidebar = h(
    'aside',
    { class: 'sidebar', id: 'sidebar' },
    h('div', { class: 'brand' }, h('div', { class: 'brand-mark' }, brandMark()), h('div', {}, h('div', { class: 'brand-name' }, 'Mukansa ', h('b', {}, 'One')), h('div', { class: 'brand-sub' }, 'Yönetim'))),
    h(
      'nav',
      { class: 'nav', 'aria-label': 'Ana menü' },
      NAV.map((n) => h('a', { href: `#${n.path}`, 'data-path': n.path, onClick: () => sidebar.classList.remove('open') }, icon(n.icon), n.label, n.badge ? h('span', { class: 'badge', hidden: true, title: 'Filtre değişimi gereken cihaz' }, '0') : null)),
    ),
    h(
      'div',
      { class: 'side-foot' },
      h('div', { class: 'avatar' }, state.me.username[0]),
      h('div', { class: 'who' }, h('b', {}, state.me.username), h('span', {}, 'Yönetici')),
      h('button', { class: 'btn-icon', type: 'button', title: 'Çıkış yap', 'aria-label': 'Çıkış yap', onClick: logout }, icon('logout')),
    ),
  )
  const main = h('main', { class: 'main', id: 'view' })
  shell = { sidebar, main }
  app.replaceChildren(
    h(
      'div',
      { class: 'shell' },
      sidebar,
      h(
        'div',
        {},
        h('div', { class: 'mobile-bar' }, h('div', { class: 'brand' }, h('div', { class: 'brand-mark', style: { width: '34px', height: '34px' } }, brandMark()), h('div', { class: 'brand-name' }, 'Mukansa ', h('b', {}, 'One'))), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Menü', onClick: () => sidebar.classList.toggle('open') }, icon('menu'))),
        main,
      ),
    ),
  )
}

async function logout() {
  try {
    await post('/api/logout')
  } catch {
    // zaten kapalı
  }
  showLogin()
}

async function route() {
  if (!shell) return
  const raw = location.hash.replace(/^#/, '') || '/overview'
  const [pathPart, query = ''] = raw.split('?')
  const parts = pathPart.split('/').filter(Boolean)
  const section = parts[0] ?? 'overview'
  const seq = ++state.seq
  clearInterval(state.refreshTimer)

  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === `/${section}`))
  window.scrollTo({ top: 0 })

  const ctx = { navigate, reload: () => route(), me: state.me, setAttention }
  const view = shell.main

  try {
    if (section === 'overview') {
      await overviewView(view, ctx)
      state.refreshTimer = setInterval(() => seq === state.seq && overviewView(view, ctx).catch(() => {}), 60_000)
    } else if (section === 'devices' && parts[1]) {
      await deviceView(view, ctx, Number(parts[1]))
    } else if (section === 'devices') {
      const q = Object.fromEntries(new URLSearchParams(query))
      if (q.tone || q.status) setListFilter({ tone: q.tone ?? 'all', status: q.status ?? 'all' })
      await devicesView(view, ctx)
    } else if (section === 'provision') await provisionView(view, ctx)
    else if (section === 'service-requests') await serviceRequestsView(view, ctx)
    else if (section === 'notifications') await notificationsView(view, ctx)
    else if (section === 'audit') await auditView(view, ctx)
    else if (section === 'system') await systemView(view, ctx)
    else view.replaceChildren(empty('Sayfa bulunamadı', 'Soldaki menüden devam edin.'))
    document.title = `${NAV.find((n) => n.path === `/${section}`)?.label ?? 'Yönetim'} · Mukansa One`
  } catch (err) {
    if (seq !== state.seq || err.status === 401) return
    view.replaceChildren(
      h('div', { class: 'card' }, empty(err.code === 'not_found' ? 'Kayıt bulunamadı' : 'Yüklenemedi', err.message), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn', type: 'button', onClick: () => route() }, icon('refresh'), 'Tekrar dene'))),
    )
  }
}

window.addEventListener('hashchange', route)
window.addEventListener('panel:unauthorized', () => state.me && showLogin())
boot()
