import { message } from '@oas-ui/ui/feedback/message'
import { t, currentLocale, onLocaleChange } from '../i18n'
import { routes } from '../router/routes'
import { resolve } from '../router/router'
import { navigate } from '../router/mode'
import { session } from '../store/session'

function formatLoginAt(n: number | null): string {
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

function currentTheme(): string {
  if (document.documentElement.dataset.theme === 'dark') return 'dark'
  if (document.documentElement.dataset.theme === 'light') return 'light'
  return 'system'
}

function syncPreviewSelection(el: HTMLElement): void {
  el.querySelectorAll<HTMLElement>('.theme-preview').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.theme === currentTheme())
  })
}

export function render(el: HTMLElement): () => void {
  const user = session.user!
  const roleLabel = user.role === 'admin' ? t('users.role.admin') : t('profile.roleViewer')

  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">${t('nav.profile')}</h1>
      <div class="profile-layout">
        <oas-card class="profile-left">
          <div class="profile-avatar-wrap">
            <oas-avatar id="profile-avatar" size="64"><span slot="fallback" id="profile-avatar-text" class="profile-avatar-fallback"></span></oas-avatar>
            <div id="profile-name" class="profile-name"></div>
            <oas-tag id="profile-role-tag" type="primary">${roleLabel}</oas-tag>
          </div>
          <oas-divider></oas-divider>
          <div class="profile-logout-wrap">
            <oas-button id="profile-logout" type="danger" variant="text">${t('header.logout')}</oas-button>
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

  const avatar = el.querySelector<HTMLElement>('#profile-avatar')!
  el.querySelector<HTMLElement>('#profile-avatar-text')!.textContent = user.name
    .charAt(0)
    .toUpperCase()
  if (user.role === 'admin') {
    avatar.style.setProperty('--oas-color-primary', 'var(--oas-color-primary)')
  }

  el.querySelector<HTMLElement>('#profile-name')!.textContent = user.name
  el.querySelector<HTMLElement>('#profile-name2')!.textContent = user.name
  el.querySelector<HTMLElement>('#profile-role2')!.textContent = roleLabel
  el.querySelector<HTMLElement>('#profile-login-at')!.textContent = formatLoginAt(session.loginAt)

  function applyTheme(next: string): void {
    if (next === 'system') {
      delete document.documentElement.dataset.theme
      message.info(t('profile.systemThemeMsg'))
    } else {
      document.documentElement.dataset.theme = next
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
    syncPreviewSelection(el)
  }

  el.querySelectorAll<HTMLElement>('.theme-preview').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme || 'system'))
  })
  syncPreviewSelection(el)

  document.addEventListener('themechange', () => syncPreviewSelection(el))

  el.querySelector('#profile-logout')!.addEventListener('click', () => {
    session.logout()
    message.info(t('header.loggedOut'))
    navigate(routes[0].path)
    void resolve()
  })

  function refreshText(): void {
    const role = user.role === 'admin' ? t('users.role.admin') : t('profile.roleViewer')
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('nav.profile')
    el.querySelector<HTMLElement>('#profile-role-tag')!.textContent = role
    el.querySelector<HTMLElement>('#profile-role2')!.textContent = role
    el.querySelector<HTMLElement>('#profile-login-at')!.textContent = formatLoginAt(session.loginAt)
    el.querySelector<HTMLElement>('.profile-right')!.setAttribute('title', t('profile.accountInfo'))
    const DESC_KEYS = ['profile.username', 'profile.role', 'profile.loginAt', 'profile.dataVersion']
    el.querySelectorAll<HTMLElement>('.profile-right oas-descriptions-item').forEach((n, i) => {
      const k = DESC_KEYS[i]
      if (k) n.setAttribute('label', t(k))
    })
    el.querySelector<HTMLElement>(
      '.profile-right oas-descriptions-item:last-child span',
    )!.textContent = t('profile.demoData')
    el.querySelector<HTMLElement>('.profile-theme')!.setAttribute('title', t('profile.appearance'))
    const THEME_KEYS: Array<[string, string, string]> = [
      ['light', 'profile.theme.light', 'cmd.light'],
      ['dark', 'profile.theme.dark', 'cmd.dark'],
      ['system', 'profile.theme.system', 'cmd.system'],
    ]
    for (const [theme, ariaKey, labelKey] of THEME_KEYS) {
      const btn = el.querySelector<HTMLElement>(`.theme-preview[data-theme="${theme}"]`)!
      btn.setAttribute('aria-label', t(ariaKey))
      btn.querySelector<HTMLElement>('.preview-label')!.textContent = t(labelKey)
    }
    el.querySelector<HTMLElement>('#profile-logout')!.textContent = t('header.logout')
  }

  return onLocaleChange(refreshText)
}
