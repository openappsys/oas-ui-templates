import { message } from '@oas-ui/ui/feedback/message'
import { iconNames } from '@oas-ui/icons'
import { matchRoute, parseHash, resolve } from '../router/router'
import { routes } from '../router/routes'
import { session } from '../store/session'

const KNOWN_ICONS = new Set<string>(iconNames)

function sidebarItems(): string {
  return JSON.stringify(
    routes.map((r) => ({ label: r.meta.title, value: r.path, icon: r.meta.icon })),
  )
}

const LOGO = `
  <span class="oas-logo">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin</span>
  </span>`

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <oas-layout class="app">
      <header class="app-header" slot="header">
        ${LOGO}
        <span class="spacer"></span>
        <div class="global-search">
          <oas-input id="global-search" placeholder="搜索页面…" prefix-icon="search"></oas-input>
          <span class="kbd-hint">/</span>
        </div>
        <span class="spacer"></span>
        <button id="theme-toggle" class="theme-dot" type="button" title="切换主题" aria-label="切换主题"></button>
        <oas-dropdown id="user-menu" placement="bottom" items='[{"label":"个人中心","value":"/profile"},{"label":"退出登录","value":"logout"}]'>
          <oas-avatar id="user-avatar" size="28"></oas-avatar>
        </oas-dropdown>
      </header>
      <div slot="sider" class="sider-wrap">
        <oas-sidebar id="nav" items='${sidebarItems()}'></oas-sidebar>
        <div class="sider-foot">
          <span class="wc-badge" title="零框架 · Web Components">⚡ WC</span>
        </div>
      </div>
      <div slot="content" class="content-col">
        <div class="crumbs-bar"><oas-breadcrumb id="crumbs"></oas-breadcrumb></div>
        <main id="view"></main>
        <footer class="app-foot">© 2026 OAS Admin · Web Components 驱动 · 零框架运行时</footer>
      </div>
    </oas-layout>`
  const sidebar = root.querySelector<HTMLElement>('#nav')!

  function patchSidebarIcons(): void {
    sidebar.shadowRoot?.querySelectorAll<HTMLElement>('.icon').forEach((span) => {
      if (span.childElementCount > 0) return
      const name = (span.textContent ?? '').trim()
      if (!name || !KNOWN_ICONS.has(name)) return
      span.textContent = ''
      const icon = document.createElement('oas-icon')
      icon.setAttribute('name', name)
      icon.setAttribute('size', '16')
      span.appendChild(icon)
    })
  }

  if (sidebar.shadowRoot) {
    new MutationObserver(patchSidebarIcons).observe(sidebar.shadowRoot, {
      childList: true,
      subtree: true,
    })
    patchSidebarIcons()
  }

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

  const search = root.querySelector<HTMLElement>('#global-search')!
  search.addEventListener('oas-enter', (e) => {
    const q = ((e as CustomEvent<{ value: string }>).detail.value ?? '').trim()
    if (!q) return
    const hit = routes.find((r) => r.meta.title.includes(q) || r.path.includes(q))
    if (!hit) return
    if (location.hash === `#${hit.path}`) void resolve()
    else location.hash = hit.path
  })
  search.addEventListener('focusout', () => search.setAttribute('value', ''))

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"], oas-input, oas-select'))
      return
    e.preventDefault()
    search.focus()
  })

  const crumbs = root.querySelector<HTMLElement>('#crumbs')!

  function syncCrumbs(): void {
    const home = routes[0]
    const route = matchRoute(parseHash(location.hash))
    const items =
      route === undefined || route.path === home.path
        ? [{ label: home.meta.title }]
        : [{ label: home.meta.title, href: `#${home.path}` }, { label: route.meta.title }]
    crumbs.setAttribute('items', JSON.stringify(items))
  }

  window.addEventListener('hashchange', syncCrumbs)
  syncCrumbs()

  function syncUser(): void {
    const avatar = root.querySelector<HTMLElement>('#user-avatar')
    if (avatar) avatar.textContent = (session.user?.name ?? '').charAt(0)
    root.classList.toggle('no-chrome', session.user === null)
  }

  syncUser()
  session.subscribe(syncUser)
}
