import { guard, readSession, clearSession } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, currentLocale } from './i18n.js'

function formatLoginAt(n) {
  if (!n) return '-'
  const locale = currentLocale() === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(n))
}

function currentTheme() {
  if (document.documentElement.dataset.theme === 'dark') return 'dark'
  if (document.documentElement.dataset.theme === 'light') return 'light'
  return 'system'
}

function syncPreviewSelection() {
  document.querySelectorAll('.theme-preview').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.theme === currentTheme())
  })
}

if (guard()) {
  document.title = `${t('nav.profile')} · ${t('app.title')}`
  applyStaticTexts()
  // 隐藏路由：无侧栏高亮
  initShell({ active: '' })
  renderProfile()
}

function renderProfile() {
  const user = readSession() ?? { name: '-' }
  // role 来自登录页角色选择，缺省按管理员展示
  const roleLabel = user.role === 'viewer' ? t('profile.roleViewer') : t('users.role.admin')

  document.querySelector('#profile-avatar-text').textContent = user.name.charAt(0).toUpperCase()
  document.querySelector('#profile-name').textContent = user.name
  document.querySelector('#profile-name2').textContent = user.name
  document.querySelector('#profile-role-tag').textContent = roleLabel
  document.querySelector('#profile-role2').textContent = roleLabel
  document.querySelector('#profile-login-at').textContent = formatLoginAt(user.loginAt ?? null)

  function applyTheme(next) {
    if (next === 'system') {
      delete document.documentElement.dataset.theme
      OASUI.message.info(t('profile.systemThemeMsg'))
    } else {
      document.documentElement.dataset.theme = next
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
    syncPreviewSelection()
  }

  document.querySelectorAll('.theme-preview').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme || 'system'))
  })
  syncPreviewSelection()

  document.addEventListener('themechange', () => syncPreviewSelection())

  document.querySelector('#profile-logout').addEventListener('click', () => {
    clearSession()
    location.href = './index.html'
  })
}
