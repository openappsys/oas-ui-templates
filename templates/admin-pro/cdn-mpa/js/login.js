import { readSession, writeSession } from './session.js'
import { applyStaticTexts, t } from './i18n.js'

// 已登录访问登录页 → 直接进 dashboard（自动重定向 replace，防 Back 弹跳）
if (readSession()) {
  location.replace('./dashboard.html')
} else {
  document.title = `${t('login.title')} · ${t('app.title')}`
  applyStaticTexts()

  const input = document.querySelector('[data-testid="login-name"]')
  const roleSelect = document.querySelector('[data-testid="login-role"]')
  // 角色选项文案与 react 版登录页同源（users.role.admin / profile.roleViewer），默认 admin
  roleSelect.setAttribute(
    'options',
    JSON.stringify([
      { label: t('users.role.admin'), value: 'admin' },
      { label: t('profile.roleViewer'), value: 'viewer' },
    ]),
  )
  const submit = () => {
    const name = (input.shadowRoot?.querySelector('input')?.value ?? '').trim()
    if (!name) return
    const role = roleSelect.getAttribute('value') === 'viewer' ? 'viewer' : 'admin'
    writeSession(name, role)
    location.href = './dashboard.html'
  }
  document.querySelector('[data-testid="login-submit"]').addEventListener('click', submit)
  input.addEventListener('oas-enter', submit)
}
