import { message } from '@oas-ui/ui/feedback/message'
import { routes } from '../router/routes'
import { resolve } from '../router/router'
import { session } from '../store/session'

function formatLoginAt(n: number | null): string {
  if (!n) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
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
  const roleLabel = user.role === 'admin' ? '管理员' : '访客（只读）'

  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">个人中心</h1>
      <div class="profile-layout">
        <oas-card class="profile-left">
          <div class="profile-avatar-wrap">
            <oas-avatar id="profile-avatar" size="64"><span slot="fallback" id="profile-avatar-text" class="profile-avatar-fallback"></span></oas-avatar>
            <div id="profile-name" class="profile-name"></div>
            <oas-tag id="profile-role-tag" type="primary">${roleLabel}</oas-tag>
          </div>
          <oas-divider></oas-divider>
          <div class="profile-logout-wrap">
            <oas-button id="profile-logout" type="danger" variant="text">退出登录</oas-button>
          </div>
        </oas-card>
        <oas-card class="profile-right" title="账户信息">
          <oas-descriptions column="2">
            <oas-descriptions-item label="用户名"><span id="profile-name2"></span></oas-descriptions-item>
            <oas-descriptions-item label="角色"><span id="profile-role2"></span></oas-descriptions-item>
            <oas-descriptions-item label="登录时间"><span id="profile-login-at"></span></oas-descriptions-item>
            <oas-descriptions-item label="数据版本"><span>演示数据 v1</span></oas-descriptions-item>
          </oas-descriptions>
        </oas-card>
      </div>
      <oas-card class="profile-theme" title="外观">
        <div class="theme-previews">
          <button class="theme-preview is-light" data-theme="light" aria-label="浅色主题">
            <span class="preview-mini light-mini"></span>
            <span class="preview-label">浅色</span>
          </button>
          <button class="theme-preview is-dark" data-theme="dark" aria-label="深色主题">
            <span class="preview-mini dark-mini"></span>
            <span class="preview-label">深色</span>
          </button>
          <button class="theme-preview is-system" data-theme="system" aria-label="跟随系统">
            <span class="preview-mini system-mini"></span>
            <span class="preview-label">跟随系统</span>
          </button>
        </div>
      </oas-card>
    </div>`

  const avatar = el.querySelector<HTMLElement>('#profile-avatar')!
  el.querySelector<HTMLElement>('#profile-avatar-text')!.textContent = user.name.charAt(0)
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
      message.info('跟随系统已开启（演示）')
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
    message.info('已退出登录')
    location.hash = routes[0].path
    void resolve()
  })

  return () => {}
}
