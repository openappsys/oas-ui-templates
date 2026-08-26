import { message } from '@oas-ui/ui/feedback/message'
import { listNotifications, markAllRead, markRead, unreadCount } from '../data/notifications'
import { matchRoute, parseHash, resolve } from '../router/router'
import { routes, type RouteGroup } from '../router/routes'
import { session } from '../store/session'
import { currentLocale, onLocaleChange, setLocale, t } from '../i18n'

const GROUP_ORDER: RouteGroup[] = ['nav.output', 'nav.business', 'nav.system', 'nav.demo']
const GROUP_KEYS: Record<RouteGroup, string> = {
  'nav.output': 'nav.group.overview',
  'nav.business': 'nav.group.business',
  'nav.system': 'nav.group.system',
  'nav.demo': 'nav.group.demo',
}

function groupLabel(group: RouteGroup | undefined): string {
  if (group && (GROUP_ORDER as string[]).includes(group)) return t(GROUP_KEYS[group])
  return t('nav.group.overview')
}

function groupOrder(group: RouteGroup | undefined): number {
  return group ? GROUP_ORDER.indexOf(group) : GROUP_ORDER.length
}

function sidebarItems(): string {
  const items = routes
    .filter((r) => !r.meta.hidden)
    .slice()
    .sort((a, b) => groupOrder(a.meta.group) - groupOrder(b.meta.group))
    .map((r) => ({
      label: t(r.meta.titleKey),
      value: r.path,
      icon: r.meta.icon,
      group: groupLabel(r.meta.group),
    }))
  return JSON.stringify(items)
}

function userMenuItems(): string {
  return JSON.stringify([
    { label: t('header.profile'), value: '/profile' },
    { label: t('header.logout'), value: 'logout' },
  ])
}

const LANG_ITEMS = '[{"label":"简体中文","value":"zh-CN"},{"label":"English","value":"en"}]'

const LOGO = `
  <span class="oas-logo">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin</span>
  </span>`

const EXPAND_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5"/><path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5"/><path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11"/></svg>`
const COMPRESS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h3V2"/><path d="M14 5h-3V2"/><path d="M14 11h-3v3"/><path d="M2 11h3v3"/></svg>`
const BELL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z"/><path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0"/></svg>`
const LANG_ICON = `<svg viewBox="0 0 18 16" fill="currentColor" stroke="none" aria-hidden="true"><text x="0" y="11" font-size="9" font-family="'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif">文</text><text x="8" y="12.5" font-size="10" font-family="Arial, Helvetica, sans-serif">A</text></svg>`

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
      label: t(r.meta.titleKey),
      value: r.path,
      group: groupLabel(r.meta.group),
      keywords: [t(r.meta.titleKey), r.path],
    }))
  const actionItems: CommandEntry[] = [
    {
      label: t('cmd.switchTheme'),
      value: 'action:theme',
      group: t('cmd.action'),
      keywords: [t('cmd.switchTheme'), 'theme'],
    },
    {
      label: t('cmd.refresh'),
      value: 'action:refresh',
      group: t('cmd.action'),
      keywords: ['refresh', 'reload'],
    },
    {
      label: t('cmd.logout'),
      value: 'action:logout',
      group: t('cmd.action'),
      keywords: ['logout'],
    },
    {
      label: currentLocale() === 'en' ? t('cmd.switchToZh') : t('cmd.switchToEn'),
      value: 'action:locale',
      group: t('cmd.action'),
      keywords: ['locale', 'language', '语言', '中文', 'english'],
    },
  ]
  const themeItems: CommandEntry[] = [
    {
      label: t('cmd.light'),
      value: 'theme:light',
      group: t('cmd.themeGroup'),
      keywords: ['light'],
    },
    { label: t('cmd.dark'), value: 'theme:dark', group: t('cmd.themeGroup'), keywords: ['dark'] },
    {
      label: t('cmd.system'),
      value: 'theme:system',
      group: t('cmd.themeGroup'),
      keywords: ['system', 'auto'],
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
    <oas-layout class="app" viewport>
      <header class="app-header" slot="header">
        <oas-button id="nav-toggle" class="nav-toggle" type="text" icon="menu" aria-label="${t('header.openMenu')}"></oas-button>
        ${LOGO}
        <span class="spacer"></span>
        <div class="global-search">
          <oas-input id="global-search" placeholder="${t('header.search')}" prefix-icon="search" readonly></oas-input>
          <span class="kbd-hint">/</span>
        </div>
        <span class="spacer"></span>
        <button id="fullscreen-toggle" class="icon-btn fullscreen-btn" type="button" title="${t('header.fullscreen')}" aria-label="${t('header.fullscreen')}" aria-pressed="false">
          <oas-icon size="18" class="fs-expand">${EXPAND_ICON}</oas-icon>
          <oas-icon size="18" class="fs-compress">${COMPRESS_ICON}</oas-icon>
        </button>
        <button id="theme-toggle" class="theme-dot" type="button" title="${t('header.theme')}" aria-label="${t('header.theme')}"></button>
        <oas-dropdown id="lang-menu" placement="bottom" arrow-point-at-center value="${currentLocale()}" items='${LANG_ITEMS}'>
          <oas-button id="lang-toggle" class="icon-btn" type="text" title="${t('cmd.locale')}" aria-label="${t('cmd.locale')}">
            <oas-icon size="18">${LANG_ICON}</oas-icon>
          </oas-button>
        </oas-dropdown>
        <oas-badge id="notif-badge" value="0" size="small" offset="-2,2">
          <oas-button id="notif-toggle" class="icon-btn" type="text" title="${t('header.notification')}" aria-label="${t('header.notification')}">
            <oas-icon size="18">${BELL_ICON}</oas-icon>
          </oas-button>
        </oas-badge>
        <oas-dropdown id="user-menu" placement="bottom" arrow-point-at-center items='${userMenuItems()}'>
          <oas-avatar id="user-avatar" size="28"></oas-avatar>
        </oas-dropdown>
      </header>
      <oas-sider slot="sider">
        <oas-sidebar id="nav" items='${sidebarItems()}'></oas-sidebar>
      </oas-sider>
      <div slot="content" class="content-col">
        <div class="crumbs-bar"><oas-breadcrumb id="crumbs"></oas-breadcrumb></div>
        <main id="view"></main>
        <footer class="app-foot">${t('app.footer')}</footer>
      </div>
    </oas-layout>
    <oas-command id="command" hotkey="false"></oas-command>
    <oas-drawer id="notif-drawer" title="${t('header.notification')}" placement="right" size="medium" no-footer>
      <div class="notif-content">
        <div id="notif-list" class="notif-list"></div>
        <div class="notif-foot">
          <button id="notif-readall" class="link-btn" type="button">${t('header.allRead')}</button>
        </div>
      </div>
    </oas-drawer>`
  const sidebar = root.querySelector<HTMLElement>('#nav')!
  const command = root.querySelector<HTMLElement>('#command')!
  const crumbs = root.querySelector<HTMLElement>('#crumbs')!
  const navToggle = root.querySelector<HTMLElement>('#nav-toggle')!
  const search = root.querySelector<HTMLElement>('#global-search')!
  const fsToggle = root.querySelector<HTMLElement>('#fullscreen-toggle')!
  const themeToggle = root.querySelector<HTMLElement>('#theme-toggle')!
  const langMenu = root.querySelector<HTMLElement>('#lang-menu')!
  const langToggle = root.querySelector<HTMLElement>('#lang-toggle')!
  const userMenu = root.querySelector<HTMLElement>('#user-menu')!
  const footer = root.querySelector<HTMLElement>('.app-foot')!
  const drawer = root.querySelector<HTMLElement>('#notif-drawer')!
  const badge = root.querySelector<HTMLElement>('#notif-badge')!
  const notifToggle = root.querySelector<HTMLElement>('#notif-toggle')!
  const notifList = root.querySelector<HTMLElement>('#notif-list')!
  const notifReadall = root.querySelector<HTMLButtonElement>('#notif-readall')!

  navToggle.addEventListener('click', () => {
    if (sidebar.hasAttribute('drawer-open')) (sidebar as any).closeDrawer()
    else (sidebar as any).openDrawer()
  })

  sidebar.addEventListener('oas-select', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (location.hash === `#${value}`) void resolve()
    else location.hash = value
  })

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
  })

  langMenu.addEventListener('oas-select', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value === 'zh-CN' || value === 'en') setLocale(value)
  })

  userMenu.addEventListener('oas-select', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value === 'logout') {
      session.logout()
      message.info(t('header.loggedOut'))
      location.hash = routes[0].path
      void resolve()
    } else if (value === '/profile') {
      location.hash = value
    }
  })

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
      message.info(t('header.loggedOut'))
      location.hash = routes[0].path
      void resolve()
    } else if (value === 'action:locale') {
      setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
    } else if (value.startsWith('theme:')) {
      setTheme(value)
    }
  }

  command.addEventListener('oas-select', (e) => {
    execCommand((e as CustomEvent<{ value: string }>).detail.value)
  })

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
    notifReadall.textContent = allRead ? t('header.allReadDone') : t('header.allRead')
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

  function syncNav(): void {
    const path = parseHash(location.hash)
    const route = matchRoute(path)
    const home = routes[0]
    const rootLabel = t('nav.root')
    let items: Array<{ label: string; href?: string }>
    if (route === undefined || route.path === home.path) {
      items = [{ label: rootLabel }, { label: t(home.meta.titleKey) }]
    } else {
      items = [{ label: rootLabel, href: `#${home.path}` }]
      const parentPath = route.meta.parent
      const parent = parentPath ? matchRoute(parentPath) : undefined
      if (parent) {
        items.push({ label: t(parent.meta.titleKey), href: `#${parentPath}` })
      }
      items.push({ label: t(route.meta.titleKey) })
    }
    crumbs.setAttribute('items', JSON.stringify(items))
    const activePath = route === undefined ? '' : (route.meta.parent ?? route.path)
    sidebar.setAttribute('active', activePath)
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

  function refreshLocale(): void {
    navToggle.setAttribute('aria-label', t('header.openMenu'))
    search.setAttribute('placeholder', t('header.search'))
    fsToggle.setAttribute('title', t('header.fullscreen'))
    fsToggle.setAttribute('aria-label', t('header.fullscreen'))
    themeToggle.setAttribute('title', t('header.theme'))
    themeToggle.setAttribute('aria-label', t('header.theme'))
    langToggle.setAttribute('title', t('cmd.locale'))
    langToggle.setAttribute('aria-label', t('cmd.locale'))
    langMenu.setAttribute('value', currentLocale())
    userMenu.setAttribute('items', userMenuItems())
    drawer.setAttribute('title', t('header.notification'))
    notifToggle.setAttribute('title', t('header.notification'))
    notifToggle.setAttribute('aria-label', t('header.notification'))
    footer.textContent = t('app.footer')
    sidebar.setAttribute('items', sidebarItems())
    command.setAttribute('items', JSON.stringify(buildCommandItems()))
    renderNotifications()
    syncNav()
    const route = matchRoute(parseHash(location.hash))
    document.title = route ? `${t(route.meta.titleKey)} · ${t('app.fullname')}` : t('app.fullname')
  }
  refreshLocale()
  onLocaleChange(refreshLocale)
}
