/**
 * 个人中心页（自 vanilla src/pages/profile.ts 去 TS 移植）
 * 账户信息 + 外观（浅色/深色/跟随系统）预览切换 + 退出登录
 */
import { onLocaleChange, t, currentLocale } from './i18n.js'

const SESSION_KEY = 'oas-admin-cdn.session'

function session() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

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

function syncPreviewSelection(el) {
  el.querySelectorAll('.theme-preview').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.theme === currentTheme())
  })
}

export function renderProfile(el) {
  const user = session() ?? { name: '' }
  const roleLabel = user.role === 'viewer' ? t('profile.roleViewer') : t('users.role.admin')
  let onThemeChange = null

  function draw() {
    document.title = `${t('nav.profile')} · ${t('app.title')}`
    el.innerHTML = `
    <div class="page">
      <h1 class="page-title">${t('nav.profile')}</h1>
      <div class="profile-layout">
        <oas-card class="profile-left">
          <div class="body">
            <div class="profile-avatar-wrap">
              <oas-avatar id="profile-avatar" size="64"><span slot="fallback" id="profile-avatar-text" class="profile-avatar-fallback"></span></oas-avatar>
              <div id="profile-name" class="profile-name"></div>
              <oas-tag id="profile-role-tag" type="primary">${roleLabel}</oas-tag>
            </div>
            <oas-divider></oas-divider>
            <div class="profile-logout-wrap">
              <oas-button id="profile-logout" type="danger" variant="text">${t('header.logout')}</oas-button>
            </div>
          </div>
        </oas-card>
        <oas-card class="profile-right" title="${t('profile.accountInfo')}">
          <oas-descriptions column="2">
            <oas-descriptions-item label="${t('profile.username')}"><span id="profile-name2"></span></oas-descriptions-item>
            <oas-descriptions-item label="${t('profile.role')}"><span id="profile-role2"></span></oas-descriptions-item>
            <oas-descriptions-item label="${t('profile.loginAt')}"><span id="profile-login-at"></span></oas-descriptions-item>
            <oas-descriptions-item label="${t('profile.dataVersion')}"><span>${t('profile.demoData')}</span></oas-descriptions-item>
          </oas-descriptions>
        </oas-card>
      </div>
      <oas-card class="profile-theme" title="${t('profile.appearance')}">
        <div class="theme-previews">
          <button class="theme-preview is-light" data-theme="light" aria-label="${t('profile.theme.light')}">
            <span class="preview-mini light-mini"></span>
            <span class="preview-label">${t('cmd.light')}</span>
          </button>
          <button class="theme-preview is-dark" data-theme="dark" aria-label="${t('profile.theme.dark')}">
            <span class="preview-mini dark-mini"></span>
            <span class="preview-label">${t('cmd.dark')}</span>
          </button>
          <button class="theme-preview is-system" data-theme="system" aria-label="${t('profile.theme.system')}">
            <span class="preview-mini system-mini"></span>
            <span class="preview-label">${t('cmd.system')}</span>
          </button>
        </div>
      </oas-card>
    </div>`
    bind()
  }

  const q = (sel) => el.querySelector(sel)

  function bind() {
    q('#profile-avatar-text').textContent = (user.name || '?').charAt(0).toUpperCase()
    q('#profile-name').textContent = user.name
    q('#profile-name2').textContent = user.name
    q('#profile-role2').textContent = roleLabel
    q('#profile-login-at').textContent = formatLoginAt(user.loginAt)
    syncPreviewSelection(el)

    q('.theme-preview[data-theme="light"]').addEventListener('click', () => applyTheme('light'))
    q('.theme-preview[data-theme="dark"]').addEventListener('click', () => applyTheme('dark'))
    q('.theme-preview[data-theme="system"]').addEventListener('click', () => applyTheme('system'))

    q('#profile-logout').addEventListener('click', () => {
      localStorage.removeItem(SESSION_KEY)
      OASUI.message.info(t('header.loggedOut'))
      location.hash = '#/login'
    })

    // 外部（如主题命令）改动时同步预览选中态；dispose 时随解绑一起摘除
    onThemeChange = () => syncPreviewSelection(el)
    document.addEventListener('themechange', onThemeChange)
  }

  function applyTheme(next) {
    if (next === 'system') {
      delete document.documentElement.dataset.theme
      OASUI.message.info(t('profile.systemThemeMsg'))
    } else {
      document.documentElement.dataset.theme = next
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
    syncPreviewSelection(el)
  }

  draw()
  const offLocale = onLocaleChange(draw)
  return () => {
    offLocale()
    if (onThemeChange) document.removeEventListener('themechange', onThemeChange)
  }
}
