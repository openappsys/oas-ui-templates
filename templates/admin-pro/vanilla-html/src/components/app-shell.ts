import { message } from '@oas-ui/ui/feedback/message'
import { resolve } from '../router/router'
import { routes } from '../router/routes'
import { session } from '../store/session'

function sidebarItems(): string {
  return JSON.stringify(
    routes.map((r) => ({ label: r.meta.title, value: r.path, icon: r.meta.icon })),
  )
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <oas-layout class="app">
      <header class="app-header" slot="header">
        <span class="brand">OAS Admin</span>
        <span class="spacer"></span>
        <oas-button id="theme-toggle" size="small" title="切换主题">🌙</oas-button>
        <oas-dropdown id="user-menu" placement="bottom" items='[{"label":"个人中心","value":"/profile"},{"label":"退出登录","value":"logout"}]'>
          <oas-button size="small">${session.user?.name ?? ''}</oas-button>
        </oas-dropdown>
      </header>
      <div slot="sider" class="sider-wrap">
        <oas-sidebar id="nav" items='${sidebarItems()}'></oas-sidebar>
      </div>
      <main id="view" slot="content"></main>
    </oas-layout>`

  const sidebar = root.querySelector<HTMLElement>('#nav')!
  sidebar.addEventListener('oas-select', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (location.hash === `#${value}`) void resolve()
    else location.hash = value
  })

  root.querySelector<HTMLElement>('#theme-toggle')!.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
  })

  root.querySelector<HTMLElement>('#user-menu')!.addEventListener('oas-select', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value === 'logout') {
      session.logout()
      message.info('已退出登录')
      location.hash = routes[0].path
      void resolve()
    } else if (value === '/profile') {
      location.hash = value
    }
  })
}
