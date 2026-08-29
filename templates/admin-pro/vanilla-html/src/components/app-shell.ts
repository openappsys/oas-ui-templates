import { message } from '@oas-ui/ui/feedback/message'
import { listNotifications, markAllRead, markRead, unreadCount } from '../data/notifications'
import { matchRoute, resolve } from '../router/router'
import { currentPath, href, navigate, onRouteChange } from '../router/mode'
import { routes, type RouteGroup } from '../router/routes'
import { HOME_PATH, closeKeys, closeTab, visit } from '../router/tabs'
import type { TabsView } from '../router/tabs'
import { session } from '../store/session'
import { currentLocale, onLocaleChange, setLocale, t } from '../i18n'
import {
  navConfig,
  readSidebarCollapsed,
  writeSidebarCollapsed,
  type MenuStyle,
} from '../layout-config'

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
      iconColor: r.meta.iconColor,
      group: groupLabel(r.meta.group),
    }))
  return JSON.stringify(items)
}

/** 顶部/竖排菜单（menubar / navigation-menu）：按分组映射成「分组 → 子菜单下拉」 */
function groupMenuItems(): string {
  const groups = new Map<string, Array<{ label: string; value: string; icon?: string }>>()
  for (const r of routes) {
    if (r.meta.hidden) continue
    const g = groupLabel(r.meta.group)
    const items = groups.get(g) ?? []
    items.push({ label: t(r.meta.titleKey), value: r.path, icon: r.meta.icon })
    groups.set(g, items)
  }
  return JSON.stringify(
    Array.from(groups.entries()).map(([label, children]) => ({
      label,
      value: '',
      children,
    })),
  )
}

/** 按「形态 × 位置」渲染菜单组件内容（不含 slot 容器，供初挂载与 reapply 复用） */
/** 生成菜单组件的纯 HTML（不带 slot 容器）：top 放 header 内、left/right 放 sider 槽 */
function menuHTML(vertical: boolean): string {
  const { style } = navConfig()
  if (style === 'menubar') {
    return `<oas-menubar id="nav" orientation="${vertical ? 'vertical' : 'horizontal'}" items='${groupMenuItems()}'></oas-menubar>`
  }
  if (style === 'navigation') {
    return `<oas-navigation-menu id="nav" orientation="${vertical ? 'vertical' : 'horizontal'}" items='${groupMenuItems()}'></oas-navigation-menu>`
  }
  return `<oas-sider id="nav-sider"><oas-sidebar id="nav" items='${sidebarItems()}'${readSidebarCollapsed() ? ' collapsed' : ''}></oas-sidebar></oas-sider>`
}

function userMenuItems(): string {
  return JSON.stringify([
    { label: t('header.profile'), value: '/profile', kind: 'action' },
    { label: t('header.logout'), value: 'logout', kind: 'action', danger: true },
  ])
}

const LANG_ITEMS = '[{"label":"简体中文","value":"zh-CN"},{"label":"English","value":"en"}]'

const LOGO = `
  <span class="oas-logo">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin Pro</span>
  </span>`

const EXPAND_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5"/><path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5"/><path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11"/></svg>`
const COMPRESS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h3V2"/><path d="M14 5h-3V2"/><path d="M14 11h-3v3"/><path d="M2 11h3v3"/></svg>`
const BELL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z"/><path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0"/></svg>`
const GLOBE_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M2 8h12"/><path d="M8 2c2 1.7 3 3.8 3 6s-1 4.3-3 6c-2-1.7-3-3.8-3-6s1-4.3 3-6z"/></svg>`

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
  const isTopMenu = navConfig().position === 'top'
  root.innerHTML = `
      <oas-layout class="app" viewport side="${navConfig().position}">
        <header class="app-header" slot="header">
          <oas-button id="nav-toggle" class="nav-toggle" type="text" icon="menu" aria-label="${t('header.openMenu')}"></oas-button>
          ${LOGO}
          ${isTopMenu ? `<span class="in-header-nav">${menuHTML(false)}</span>` : ''}
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
          <oas-dropdown id="lang-menu" placement="bottom" arrow-point-at-center trigger="hover click" value="${currentLocale()}" items='${LANG_ITEMS}'>
            <button id="lang-toggle" class="icon-btn" type="button" title="${t('cmd.locale')}" aria-label="${t('cmd.locale')}" aria-haspopup="menu">
              <oas-icon size="18">${GLOBE_ICON}</oas-icon>
            </button>
          </oas-dropdown>
          <oas-badge id="notif-badge" value="0" size="small" offset="-2,2">
            <button id="notif-toggle" class="icon-btn" type="button" title="${t('header.notification')}" aria-label="${t('header.notificationCount', { count: unreadCount() })}">
              <oas-icon size="18">${BELL_ICON}</oas-icon>
            </button>
          </oas-badge>
          <oas-dropdown id="user-menu" placement="bottom" arrow-point-at-center trigger="hover click" items='${userMenuItems()}'>
            <oas-avatar id="user-avatar" size="28" aria-label="${t('header.userMenu')}" aria-haspopup="menu"></oas-avatar>
          </oas-dropdown>
        </header>
        ${isTopMenu ? '' : `<div slot="sider" class="nav-sider">${menuHTML(true)}</div>`}
        <div slot="content" class="content-col">
          <div class="tabs-bar">
            <oas-tabs id="page-tabs" data-testid="page-tabs" type="card" hide-content context-menu></oas-tabs>
          </div>
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
  function navEl(): HTMLElement {
    return root.querySelector<HTMLElement>('#nav')!
  }
  const menuStyle = (): MenuStyle => navConfig().style
  /** 按形态设置菜单 items（sidebar→带分组字段；menubar/navigation→分组下拉） */
  function setNavItems(): void {
    const style = menuStyle()
    const items = style === 'sidebar' ? sidebarItems() : groupMenuItems()
    navEl().setAttribute('items', items)
  }
  /** 按形态映射当前路由高亮：sidebar→active 属性；menubar/navigation→value（组级）+ 子项 active */
  function applyNavActive(path: string): void {
    const nav = navEl()
    const style = menuStyle()
    if (style === 'sidebar') {
      nav.setAttribute('active', path)
    } else {
      nav.setAttribute('value', path)
    }
  }
  const command = root.querySelector<HTMLElement>('#command')!
  const crumbs = root.querySelector<HTMLElement>('#crumbs')!
  const navToggle = root.querySelector<HTMLElement>('#nav-toggle')!
  const search = root.querySelector<HTMLElement>('#global-search')!
  const fsToggle = root.querySelector<HTMLElement>('#fullscreen-toggle')!
  const themeToggle = root.querySelector<HTMLElement>('#theme-toggle')!
  const langMenu = root.querySelector<HTMLElement>('#lang-menu')!
  const langToggle = root.querySelector<HTMLElement>('#lang-toggle')!
  const userMenu = root.querySelector<HTMLElement>('#user-menu')!
  const userAvatar = root.querySelector<HTMLElement>('#user-avatar')!
  const footer = root.querySelector<HTMLElement>('.app-foot')!
  const drawer = root.querySelector<HTMLElement>('#notif-drawer')!
  const badge = root.querySelector<HTMLElement>('#notif-badge')!
  const notifToggle = root.querySelector<HTMLElement>('#notif-toggle')!
  const notifList = root.querySelector<HTMLElement>('#notif-list')!
  const notifReadall = root.querySelector<HTMLButtonElement>('#notif-readall')!
  const pageTabs = root.querySelector<HTMLElement>('#page-tabs')!

  navToggle.addEventListener('click', () => {
    // sidebar 专属抽屉逻辑；menubar/navigation 无 drawer（移动端自带收纳）
    const nav = navEl()
    if (nav.tagName === 'OAS-SIDEBAR') {
      if (nav.hasAttribute('drawer-open')) (nav as any).closeDrawer()
      else (nav as any).openDrawer()
    }
  })

  function bindNav(): void {
    const nav = navEl()
    nav.addEventListener('oas-select', (e) => {
      const value = (e as CustomEvent<{ value: string }>).detail.value
      if (!value) return
      if (currentPath() === value) void resolve()
      else navigate(value)
    })
    // 折叠持久化：仅 sidebar 形态有折叠（collapsed）
    if (nav.tagName === 'OAS-SIDEBAR') {
      nav.addEventListener('oas-collapse', (e) => {
        const collapsed = (e as CustomEvent<{ collapsed: boolean }>).detail?.collapsed
        if (typeof collapsed === 'boolean') writeSidebarCollapsed(collapsed)
      })
    }
  }
  bindNav()

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
      navigate(routes[0].path)
      void resolve()
    } else if (value === '/profile') {
      navigate(value)
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
      if (currentPath() === value) void resolve()
      else navigate(value)
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
      navigate(routes[0].path)
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
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    openCommand()
  })

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

  let lastNotifCount = -1
  function syncBadge(): void {
    const count = unreadCount()
    badge.setAttribute('value', String(count))
    notifToggle.setAttribute('aria-label', t('header.notificationCount', { count }))
    if (count === lastNotifCount) return
    lastNotifCount = count
    badge.classList.remove('is-pop')
    void badge.offsetWidth
    badge.classList.add('is-pop')
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
    const path = currentPath()
    const route = matchRoute(path)
    const home = routes[0]
    const rootLabel = t('nav.root')
    let items: Array<{ label: string; href?: string }>
    if (route === undefined || route.path === home.path) {
      items = [{ label: rootLabel }, { label: t(home.meta.titleKey) }]
    } else {
      items = [{ label: rootLabel, href: href(home.path) }]
      const parentPath = route.meta.parent
      const parent = parentPath ? matchRoute(parentPath) : undefined
      if (parent) {
        items.push({ label: t(parent.meta.titleKey), href: href(parentPath!) })
      }
      items.push({ label: t(route.meta.titleKey) })
    }
    crumbs.setAttribute('items', JSON.stringify(items))
    const activePath = route === undefined ? '' : (route.meta.parent ?? route.path)
    applyNavActive(activePath)
  }

  onRouteChange(syncNav)
  syncNav()

  let tabsView: TabsView = { keys: [], active: null }
  const closeBatch = new Set<string>()
  let closeBatchFlush: ReturnType<typeof queueMicrotask> | undefined

  function tabPanelHtml(key: string): string {
    const route = matchRoute(key)
    const label = route ? t(route.meta.titleKey) : key
    const close =
      key === HOME_PATH
        ? ''
        : `<span class="ptab-close" role="button" tabindex="-1" title="${t('tabs.closeTab')}" aria-label="${t('tabs.closeTab')}" data-ptab-close><oas-icon name="close" size="12"></oas-icon></span>`
    return `<oas-tab-panel value="${key}"><span slot="label" class="ptab">${label}${close}</span></oas-tab-panel>`
  }

  let renderedTabsHtml = ''

  function renderTabs(): void {
    const html = tabsView.keys.map(tabPanelHtml).join('')
    if (html !== renderedTabsHtml) {
      renderedTabsHtml = html
      pageTabs.innerHTML = html
    }
    pageTabs.setAttribute('active', tabsView.active ?? '')
  }

  function syncTabs(): void {
    if (!session.user) {
      tabsView = { keys: [], active: null }
      renderTabs()
      return
    }
    tabsView = visit(tabsView, currentPath())
    renderTabs()
  }

  function closeTabAt(key: string): void {
    const res = closeTab(tabsView, key)
    tabsView = res.view
    renderTabs()
    if (res.navigateTo) navigate(res.navigateTo)
  }

  pageTabs.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    if (value && currentPath() !== value) navigate(value)
  })

  pageTabs.addEventListener('oas-close', (e) => {
    const { key } = (e as CustomEvent<{ key: string }>).detail
    if (!key) return
    closeBatch.add(key)
    if (closeBatchFlush !== undefined) return
    closeBatchFlush = queueMicrotask(() => {
      closeBatchFlush = undefined
      const keys = [...closeBatch]
      closeBatch.clear()
      const res = closeKeys(tabsView, keys)
      tabsView = res.view
      renderTabs()
      if (res.navigateTo) navigate(res.navigateTo)
    })
  })

  pageTabs.addEventListener('oas-add', () => {
    navigate(routes[0].path)
  })

  pageTabs.addEventListener(
    'click',
    (e) => {
      const path = e.composedPath()
      if (!path.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close'))) return
      e.preventDefault()
      e.stopPropagation()
      const tabNode = path.find(
        (n): n is Element => n instanceof Element && n.getAttribute('role') === 'tab',
      )
      const key = tabNode?.getAttribute('data-value')
      if (key) closeTabAt(key)
    },
    true,
  )

  pageTabs.addEventListener(
    'keydown',
    (e) => {
      const path = e.composedPath()
      if (!path.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close'))) return
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      e.stopPropagation()
      const tabNode = path.find(
        (n): n is Element => n instanceof Element && n.getAttribute('role') === 'tab',
      )
      const key = tabNode?.getAttribute('data-value')
      if (key) closeTabAt(key)
    },
    true,
  )

  onRouteChange(syncTabs)
  syncTabs()

  function syncUser(): void {
    const avatar = root.querySelector<HTMLElement>('#user-avatar')
    // v2.2.8 契约：首字符走响应式 `text` 属性（attributeChangedCallback 触发重渲染），textContent 只是连接时快照
    if (avatar) avatar.setAttribute('text', (session.user?.name ?? '').charAt(0).toUpperCase())
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
    notifToggle.setAttribute('aria-label', t('header.notificationCount', { count: unreadCount() }))
    userAvatar.setAttribute('aria-label', t('header.userMenu'))
    footer.textContent = t('app.footer')
    setNavItems()
    command.setAttribute('items', JSON.stringify(buildCommandItems()))
    renderNotifications()
    syncNav()
    syncTabs()
    const route = matchRoute(currentPath())
    document.title = route ? `${t(route.meta.titleKey)} · ${t('app.fullname')}` : t('app.fullname')
  }
  refreshLocale()
  onLocaleChange(refreshLocale)

  // 设置中心切换菜单位置/形态：实时重建菜单（top 放 header 内，否则放 sider 槽），不全页刷新
  function reapplyNavConfig(): void {
    const isTop = navConfig().position === 'top'
    root.querySelector('.in-header-nav')?.remove()
    root.querySelector('oas-layout > [slot="sider"]')?.remove()
    if (isTop) {
      const wrap = document.createElement('span')
      wrap.className = 'in-header-nav'
      wrap.innerHTML = menuHTML(false)
      root.querySelector<HTMLElement>('.app-header .oas-logo')?.after(wrap)
    } else {
      const wrap = document.createElement('div')
      wrap.setAttribute('slot', 'sider')
      wrap.className = 'nav-sider'
      wrap.innerHTML = menuHTML(true)
      root
        .querySelector('oas-layout')
        ?.insertBefore(wrap, root.querySelector('oas-layout > [slot="content"]'))
    }
    const layout = root.querySelector<HTMLElement>('oas-layout')
    if (layout) layout.setAttribute('side', navConfig().position)
    bindNav()
    syncNav()
  }
  window.addEventListener('oas:navconfig-change', reapplyNavConfig)
}
