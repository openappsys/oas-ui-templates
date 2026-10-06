// 个人中心页（对齐 cdn pages-profile.js / vanilla src/pages/profile.ts：账户信息 + 外观预览切换 + 退出登录）
import { currentLocale, t } from './i18n.js'
import { clearSession, guard, readSession } from './session.js'
import { initShell } from './shell.js'

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

function boot() {
  document.title = `${t('nav.profile')} · ${t('app.title')}`
  // 隐藏路由：不进侧栏，无高亮项（vanilla /profile 同口径）
  initShell({ active: '' })
  window.OASShell.setBreadcrumb([{ label: 'nav.profile' }])
  render()
}

function render() {
  const user = readSession() ?? { name: '' }
  const roleLabel = user.role === 'viewer' ? t('profile.roleViewer') : t('users.role.admin')
  const el = document.querySelector('#view')
  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">${t('nav.profile')}</h1>
      <div class="profile-layout">
        <oas-card class="profile-left">
          <div class="body">
            <div class="profile-avatar-wrap">
              <oas-avatar size="64"><span slot="fallback" class="profile-avatar-fallback">${(user.name || '?').charAt(0).toUpperCase()}</span></oas-avatar>
              <div class="profile-name">${user.name}</div>
              <oas-tag type="primary">${roleLabel}</oas-tag>
            </div>
            <oas-divider></oas-divider>
            <div class="profile-logout-wrap">
              <oas-button id="profile-logout" type="danger" variant="text">${t('header.logout')}</oas-button>
            </div>
          </div>
        </oas-card>
        <oas-card class="profile-right" title="${t('profile.accountInfo')}">
          <oas-descriptions column="2">
            <oas-descriptions-item label="${t('profile.username')}">${user.name}</oas-descriptions-item>
            <oas-descriptions-item label="${t('profile.role')}">${roleLabel}</oas-descriptions-item>
            <oas-descriptions-item label="${t('profile.loginAt')}">${formatLoginAt(user.loginAt)}</oas-descriptions-item>
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

  el.querySelectorAll('.theme-preview').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.theme
      if (next === 'system') {
        delete document.documentElement.dataset.theme
        window.OASUI?.message.info(t('profile.systemThemeMsg'))
      } else {
        document.documentElement.dataset.theme = next
      }
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
      syncPreviewSelection(el)
    })
  })
  el.querySelector('#profile-logout').addEventListener('click', () => {
    clearSession()
    location.href = './index.html'
  })
  syncPreviewSelection(el)
}

if (guard()) boot()
