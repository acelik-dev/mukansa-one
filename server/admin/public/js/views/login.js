import { post } from '../api.js'
import { h } from '../dom.js'
import { brandMark } from '../icons.js'

export function loginView(root, onLoggedIn) {
  const user = h('input', { class: 'input', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Kullanıcı adı', required: true })
  const pass = h('input', { class: 'input', name: 'password', type: 'password', autocomplete: 'current-password', 'aria-label': 'Parola', required: true })
  const err = h('div', { class: 'err', role: 'alert' })
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Giriş yap')

  const submit = async (e) => {
    e.preventDefault()
    err.textContent = ''
    btn.disabled = true
    btn.replaceChildren(h('span', { class: 'spin' }))
    try {
      await post('/api/login', { username: user.value, password: pass.value })
      onLoggedIn()
    } catch (ex) {
      err.textContent = ex.message
      pass.value = ''
      pass.focus()
      btn.disabled = false
      btn.textContent = 'Giriş yap'
    }
  }

  root.replaceChildren(
    h(
      'div',
      { class: 'login' },
      h(
        'form',
        { class: 'login-card', onSubmit: submit },
        h('div', { class: 'brand-mark', style: { width: '54px', height: '54px' } }, brandMark()),
        h('h1', { class: 'login-title' }, 'Mukansa ', h('em', {}, 'One')),
        h('div', { class: 'login-sub' }, 'YÖNETİM PANELİ'),
        h('div', { class: 'field' }, h('label', {}, 'Kullanıcı adı'), user),
        h('div', { class: 'field' }, h('label', {}, 'Parola'), pass),
        err,
        btn,
      ),
    ),
  )
  user.focus()
}
