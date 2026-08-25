import { message } from '@oas-ui/ui/feedback/message'
import { listNotifications, markAllRead, markRead, unreadCount } from '../data/notifications'
import { matchRoute, parseHash, resolve } from '../router/router'
import { routes, type RouteGroup } from '../router/routes'
import { session } from '../store/session'

const GROUP_ORDER: RouteGroup[] = ['总览', '业务', '系统']

function sidebarItems(): string {
  const items = routes
    .filter((r) => !r.meta.hidden)
    .map((r) => ({ label: r.meta.title, value: r.path, icon: r.meta.icon, group: r.meta.group }))
    .sort((a, b) => {
      const ai = a.group ? GROUP_ORDER.indexOf(a.group) : GROUP_ORDER.length
      const bi = b.group ? GROUP_ORDER.indexOf(b.group) : GROUP_ORDER.length
      return ai - bi
    })
  return JSON.stringify(items)
}

const LOGO = `
  <span class="oas-logo">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin</span>
  </span>`

const EXPAND_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5"/><path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5"/><path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11"/></svg>`
const COMPRESS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h3V2"/><path d="M14 5h-3V2"/><path d="M14 11h-3v3"/><path d="M2 11h3v3"/></svg>`
const BELL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z"/><path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0"/></svg>`

interface CommandEntry {
  label: string
  value: string
  group?: string
  keywords?: string[]
  separator?: boolean
}

function buildCommandItems(): CommandEntry[] {
  const pageItems = routes
    .filter((r) => !r.meta.hidden)
    .map((r) => ({
      label: r.meta.title,
      value: r.path,
      group: r.meta.group ?? '页面',
      keywords: [r.meta.title, r.path],
    }))
  const actionItems: CommandEntry[] = [
    {
      label: '切换主题',
      value: 'action:theme',
      group: '操作',
      keywords: ['切换主题', '主题', 'theme'],
    },
    {
      label: '刷新页面',
      value: 'action:refresh',
      group: '操作',
      keywords: ['刷新', 'refresh', 'reload'],
    },
    {
      label: '退出登录',
      value: 'action:logout',
      group: '操作',
      keywords: ['退出', '登出', 'logout'],
    },
  ]
  const themeItems: CommandEntry[] = [
    { label: '浅色', value: 'theme:light', group: '主题', keywords: ['浅色', 'light', '明亮'] },
    { label: '深色', value: 'theme:dark', group: '主题', keywords: ['深色', 'dark', '暗色'] },
    {
      label: '跟随系统',
      value: 'theme:system',
      group: '主题',
      keywords: ['跟随系统', '系统', 'system', 'auto'],
    },
  ]
  const separator: CommandEntry = { label: ' ', value: 'sep', separator: true }
  return [...pageItems, separator, ...actionItems, separator, ...themeItems]
}

function applyTheme(next: string): void {
  document.documentElement.dataset.theme = next
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
}

function setTheme(mode: string): void {
  if (mode === 'theme:system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(dark ? 'dark' : 'light')
  } else {
    applyTheme(mode === 'theme:dark' ? 'dark' : 'light')
  }
}

function safeFullscreen(p: Promise<void> | undefined): void {
  if (p && typeof (p as Promise<void>).catch === 'function') {
    ;(p as Promise<void>).catch(() => {})
  }
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <oas-layout class="app">
      <header class="app-header" slot="header">
        <oas-button id="nav-toggle" class="nav-toggle" type="text" icon="menu" aria-label="打开菜单"></oas-button>
        ${LOGO}
        <span class="spacer"></span>
        <div class="global-search">
          <oas-input id="global-search" placeholder="搜索页面…" prefix-icon="search" readonly></oas-input>
          <span class="kbd-hint">/</span>
        </div>
        <span class="spacer"></span>
        <button id="fullscreen-toggle" class="icon-btn fullscreen-btn" type="button" title="全屏" aria-label="全屏" aria-pressed="false">
          <oas-icon size="18" class="fs-expand">${EXPAND_ICON}</oas-icon>
          <oas-icon size="18" class="fs-compress">${COMPRESS_ICON}</oas-icon>
        </button>
        <button id="theme-toggle" class="theme-dot" type="button" title="切换主题" aria-label="切换主题"></button>
        <oas-badge id="notif-badge" value="0" size="small" offset="-2,2">
          <oas-button id="notif-toggle" class="icon-btn" type="text" title="通知" aria-label="通知">
            <oas-icon size="18">${BELL_ICON}</oas-icon>
          </oas-button>
        </oas-badge>
        <oas-dropdown id="user-menu" placement="bottom" items='[{"label":"个人中心","value":"/profile"},{"label":"退出登录","value":"logout"}]'>
          <oas-avatar id="user-avatar" size="28"></oas-avatar>
        </oas-dropdown>
      </header>
      <oas-sider slot="sider">
        <oas-sidebar id="nav" items='${sidebarItems()}'></oas-sidebar>
      </oas-sider>
      <div slot="content" class="content-col">
        <div class="crumbs-bar"><oas-breadcrumb id="crumbs"></oas-breadcrumb></div>
        <main id="view"></main>
        <footer class="app-foot">© 2026 OAS Admin · Web Components 驱动 · 零框架运行时</footer>
      </div>
    </oas-layout>
    <oas-command id="command" hotkey="false"></oas-command>
    <oas-drawer id="notif-drawer" title="通知" placement="right" size="medium" no-footer>
      <div class="notif-content">
        <div id="notif-list" class="notif-list"></div>
        <div class="notif-foot">
          <button id="notif-readall" class="link-btn" type="button">全部已读</button>
        </div>
      </div>
    </oas-drawer>`
  const sidebar = root.querySelector<HTMLElement>('#nav')!

  root.querySelector<HTMLElement>('#nav-toggle')!.addEventListener('click', () => {
    if (sidebar.hasAttribute('drawer-open')) (sidebar as any).closeDrawer()
    else (sidebar as any).openDrawer()
  })

  sidebar.addEventListener('oas-select', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (location.hash === `#${value}`) void resolve()
    else location.hash = value
  })

  root.querySelector<HTMLElement>('#theme-toggle')!.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
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

  const command = root.querySelector<HTMLElement>('#command')!
  command.setAttribute('items', JSON.stringify(buildCommandItems()))

  function openCommand(): void {
    if (!session.user) return
    if (!command.hasAttribute('open')) command.setAttribute('open', '')
  }
  function toggleCommand(): void {
    if (!session.user) return
    if (command.hasAttribute('open')) command.removeAttribute('open')
    else command.setAttribute('open', '')
  }

  function execCommand(value: string): void {
    if (value.startsWith('/')) {
      if (location.hash === `#${value}`) void resolve()
      else location.hash = value
      return
    }
    if (value === 'action:theme') {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
    } else if (value === 'action:refresh') {
      location.reload()
    } else if (value === 'action:logout') {
      session.logout()
      message.info('已退出登录')
      location.hash = routes[0].path
      void resolve()
    } else if (value.startsWith('theme:')) {
      setTheme(value)
    }
  }

  command.addEventListener('oas-select', (e) => {
    execCommand((e as CustomEvent<{ value: string }>).detail.value)
  })

  const search = root.querySelector<HTMLElement>('#global-search')!
  search.addEventListener('pointerdown', (e) => e.preventDefault())
  search.addEventListener('click', openCommand)

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      toggleCommand()
      return
    }
    if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"], oas-input, oas-select'))
      return
    e.preventDefault()
    openCommand()
  })

  const fsToggle = root.querySelector<HTMLElement>('#fullscreen-toggle')!
  if (!document.fullscreenEnabled) fsToggle.hidden = true
  fsToggle.addEventListener('click', () => {
    if (document.fullscreenElement) safeFullscreen(document.exitFullscreen())
    else safeFullscreen(document.documentElement.requestFullscreen())
  })
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement != null
    fsToggle.setAttribute('aria-pressed', String(active))
    fsToggle.classList.toggle('is-fullscreen', active)
  })

  const drawer = root.querySelector<HTMLElement>('#notif-drawer')!
  const badge = root.querySelector<HTMLElement>('#notif-badge')!
  const notifToggle = root.querySelector<HTMLElement>('#notif-toggle')!
  const notifList = root.querySelector<HTMLElement>('#notif-list')!
  const notifReadall = root.querySelector<HTMLButtonElement>('#notif-readall')!

  function syncBadge(): void {
    badge.setAttribute('value', String(unreadCount()))
  }

  function renderNotifications(): void {
    const notifications = listNotifications()
    const html = notifications
      .map(
        (n) =>
          `<oas-list-item class="notif-item${n.read ? '' : ' is-unread'}" title="${n.title}" data-id="${n.id}"><span slot="description" class="notif-desc">${n.desc}</span><span slot="extra" class="notif-meta"><span class="notif-time">${n.time}</span></span></oas-list-item>`,
      )
      .join('')
    notifList.innerHTML = `<oas-list split>${html}</oas-list>`
    const allRead = unreadCount() === 0
    notifReadall.disabled = allRead
    notifReadall.textContent = allRead ? '已全部已读' : '全部已读'
    syncBadge()
  }

  notifToggle.addEventListener('click', () => {
    if (drawer.hasAttribute('visible')) drawer.removeAttribute('visible')
    else drawer.setAttribute('visible', '')
  })
  notifReadall.addEventListener('click', () => {
    markAllRead()
    renderNotifications()
    syncBadge()
  })
  notifList.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('oas-list-item')
    const id = item?.getAttribute('data-id')
    if (!id) return
    markRead(id)
    renderNotifications()
    syncBadge()
  })
  renderNotifications()

  const crumbs = root.querySelector<HTMLElement>('#crumbs')!

  function syncNav(): void {
    const path = parseHash(location.hash)
    const route = matchRoute(path)
    const home = routes[0]
    const rootLabel = '应用'
    const items =
      route === undefined || route.path === home.path
        ? [{ label: rootLabel }, { label: home.meta.title }]
        : [{ label: rootLabel, href: `#${home.path}` }, { label: route.meta.title }]
    crumbs.setAttribute('items', JSON.stringify(items))
    sidebar.setAttribute('active', route === undefined ? '' : route.path)
  }

  window.addEventListener('hashchange', syncNav)
  syncNav()

  function syncUser(): void {
    const avatar = root.querySelector<HTMLElement>('#user-avatar')
    if (avatar) avatar.textContent = (session.user?.name ?? '').charAt(0)
    root.classList.toggle('no-chrome', session.user === null)
  }

  syncUser()
  session.subscribe(syncUser)
}
