import { currentLocale, onLocaleChange, setLocale, t } from './i18n.js'
import { applySettings, readMenuPosition, readMenuStyle } from './js/settings.js'
import { progress } from './js/progress.js'
import { listNotifications, markAllRead, markRead, unreadCount } from './js/notifications.js'
import { HOME_PATH, closeKeys, closeTab, visit } from './js/tabs.js'
import { matchRoute, routes } from './routes.js'

const SESSION_KEY = 'oas-admin-cdn.session'

// 头部图标（vanilla app-shell 同款内联 SVG）
const EXPAND_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5"/><path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5"/><path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11"/></svg>`
const COMPRESS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h3V2"/><path d="M14 5h-3V2"/><path d="M14 11h-3v3"/><path d="M2 11h3v3"/></svg>`
const BELL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z"/><path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0"/></svg>`

// 侧栏分组：与 vanilla app-shell 的 GROUP_ORDER / GROUP_KEYS 逐字对齐
const GROUP_ORDER = ['nav.output', 'nav.business', 'nav.system', 'nav.demo']
const GROUP_KEYS = {
  'nav.output': 'nav.group.overview',
  'nav.business': 'nav.group.business',
  'nav.system': 'nav.group.system',
  'nav.demo': 'nav.group.demo',
}

const HOME = '/dashboard'
function parseHash() {
  return location.hash.replace(/^#/, '') || HOME
}

const app = document.querySelector('#app')
let disposePage = null

function session() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

function renderLogin() {
  document.title = `${t('login.title')} · ${t('app.title')}`
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <h1>${t('login.title')}</h1>
        <p class="sub">${t('login.subtitle')}</p>
        <oas-input data-testid="login-name" placeholder="${t('login.namePh')}"></oas-input>
        <oas-select data-testid="login-role" value="admin" options='${JSON.stringify([
          { label: t('users.role.admin'), value: 'admin' },
          { label: t('profile.roleViewer'), value: 'viewer' },
        ])}'></oas-select>
        <oas-button data-testid="login-submit" type="primary">${t('login.submit')}</oas-button>
        <p class="login-tip">${t('login.tip')}</p>
      </div>
    </div>`
  const input = app.querySelector('[data-testid="login-name"]')
  const roleSelect = app.querySelector('[data-testid="login-role"]')
  const submit = () => {
    const name = (input.shadowRoot?.querySelector('input')?.value ?? '').trim()
    if (!name) return
    try {
      // loginAt 供个人中心「登录时间」展示；role 供仪表盘快捷操作 / 用户页只读判断（对齐 vanilla session 语义）
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          name,
          role: roleSelect.getAttribute('value') === 'viewer' ? 'viewer' : 'admin',
          loginAt: Date.now(),
        }),
      )
    } catch {
      /* 隐私模式 */
    }
    location.hash = `#${HOME}`
  }
  app.querySelector('[data-testid="login-submit"]').addEventListener('click', submit)
  input.addEventListener('oas-enter', submit)
}

// 导航形态配置（菜单形态 × 位置，设置中心矩阵消费；applyNavConfig 存储后由壳层重渲）
let menuCfg = { style: 'sidebar', position: 'left' }
function readNavConfig() {
  return { style: readMenuStyle(), position: readMenuPosition() }
}

function renderShell() {
  menuCfg = readNavConfig()
  const side = menuCfg.position === 'top-head' ? 'top' : menuCfg.position
  app.innerHTML = `
    <oas-layout class="app" viewport side="${side}" data-menu-style="${menuCfg.style}">
      <header class="app-header" slot="header">
        <button id="nav-toggle" class="nav-toggle" type="button" aria-label="打开菜单">☰</button>
        <!-- logo：OAS 徽标 + 站名，点击回站点首页（门户 /） -->
        <a class="oas-logo" href="/" style="text-decoration: none; color: inherit; cursor: pointer">
          <span class="oas-logo-badge">OAS</span>
          <span class="oas-logo-word">${t('app.title')}</span>
        </a>
        ${menuCfg.position === 'top-head' ? `<div class="header-nav-menubar">${menuHTML(false)}</div>` : ''}
        <span class="spacer"></span>
        <button id="fullscreen-toggle" class="icon-btn fullscreen-btn" type="button" title="${t('header.fullscreen')}" aria-label="${t('header.fullscreen')}" aria-pressed="false">
          <span class="fs-expand">${EXPAND_ICON}</span>
          <span class="fs-compress">${COMPRESS_ICON}</span>
        </button>
        <oas-badge id="notif-badge" value="0" size="small" offset="-2,2">
          <button id="notif-toggle" class="icon-btn" type="button" title="${t('header.notification')}" aria-label="${t('header.notificationCount', { count: unreadCount() })}">
            <span class="bell-icon">${BELL_ICON}</span>
          </button>
        </oas-badge>
        <a class="icon-btn profile-entry" href="#/profile" title="${t('nav.profile')}" aria-label="${t('nav.profile')}">${(session()?.name ?? '?').charAt(0).toUpperCase()}</a>
        <button id="lang-toggle" data-testid="lang-toggle" class="icon-btn" type="button">${t('header.lang')}</button>
        <button id="logout" class="icon-btn" type="button">${t('header.logout')}</button>
      </header>
      ${menuCfg.position === 'top' ? `<div class="top-nav-bar" slot="sider">${menuHTML(false)}</div>` : ''}
      ${menuCfg.position !== 'top' && menuCfg.position !== 'top-head' ? (menuCfg.style === 'sidebar' ? `<oas-sider slot="sider">${menuHTML(true)}</oas-sider>` : `<div slot="sider" class="nav-sider">${menuHTML(true)}</div>`) : ''}
      <div slot="content" class="content-col">
        <div class="tabs-bar">
          <oas-tabs id="page-tabs" data-testid="page-tabs" type="card" hide-content context-menu></oas-tabs>
        </div>
        <div class="crumbs-bar" hidden>
          <oas-breadcrumb id="crumbs" data-testid="crumbs"></oas-breadcrumb>
        </div>
        <div id="view"></div>
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
    </oas-drawer>
    <div id="menu-popover" class="menu-popover" hidden></div>`
  app.querySelector('#lang-toggle').addEventListener('click', () => {
    setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
  })
  // 全屏切换（vanilla safeFullscreen 同款；不支持全屏的浏览器隐藏按钮）
  const fsToggle = app.querySelector('#fullscreen-toggle')
  if (!document.fullscreenEnabled) fsToggle.hidden = true
  const safeFullscreen = (p) => {
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }
  fsToggle.addEventListener('click', () => {
    if (document.fullscreenElement) safeFullscreen(document.exitFullscreen())
    else safeFullscreen(document.documentElement.requestFullscreen())
  })
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement != null
    fsToggle.setAttribute('aria-pressed', String(active))
    fsToggle.classList.toggle('is-fullscreen', active)
  })
  app.querySelector('#logout').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY)
    location.hash = '#/login'
  })
  app.querySelector('#nav-toggle').addEventListener('click', () => {
    const nav = app.querySelector('#nav')
    // sidebar 走自身抽屉；menubar/navigation 走 ☰ 悬浮菜单（vanilla 同语义）
    if (nav.tagName === 'OAS-SIDEBAR') {
      if (nav.hasAttribute('drawer-open')) nav.closeDrawer()
      else nav.openDrawer()
    } else {
      toggleMenuPopover()
    }
  })
  app.querySelector('#nav').addEventListener('oas-select', (e) => {
    const value = e.detail?.value
    if (value && location.hash !== `#${value}`) location.hash = value
  })
  wireTabs()
  syncNav()
}

// ── 导航渲染（形态：sidebar / menubar / navigation-menu；位置：left/right/top/top-head） ──
const GROUP_ICONS = {
  'nav.output': 'eye',
  'nav.business': 'organization',
  'nav.system': 'gear',
  'nav.demo': 'menu',
}

/** 可见路由 → 分组树 items；navigation 形态追加 href（真实 <a> 片段）并可标 active */
function navItemsJson(activePath) {
  const groups = new Map()
  for (const r of routes) {
    if (r.hidden || r.navHidden || !r.group) continue
    const child = {
      label: t(r.navKey ?? r.titleKey),
      value: r.path,
      icon: r.icon,
      iconColor: r.iconColor,
    }
    if (menuCfg.style === 'navigation') {
      child.href = `#${r.path}`
      if (activePath && r.path === activePath) child.active = ''
    }
    const list = groups.get(r.group) ?? []
    list.push(child)
    groups.set(r.group, list)
  }
  return JSON.stringify(
    GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      label: t(GROUP_KEYS[g]),
      value: g,
      icon: GROUP_ICONS[g],
      children: groups.get(g),
    })),
  )
}

/** 按当前形态渲染导航组件（sider 槽 / 顶部条 / 头部内嵌） */
function menuHTML(vertical) {
  const items = navItemsJson()
  if (menuCfg.style === 'menubar')
    return `<oas-menubar id="nav" orientation="${vertical ? 'vertical' : 'horizontal'}" items='${items}'></oas-menubar>`
  if (menuCfg.style === 'navigation')
    return `<oas-navigation-menu id="nav" orientation="${vertical ? 'vertical' : 'horizontal'}" items='${items}'></oas-navigation-menu>`
  return `<oas-sidebar id="nav" accordion></oas-sidebar>`
}

/** ☰ 悬浮菜单面板：menubar/navigation 形态窄屏兜底（vanilla toggleMenuPopover 同语义） */
function toggleMenuPopover() {
  const popover = app.querySelector('#menu-popover')
  if (!popover) return
  if (!popover.hidden) {
    popover.hidden = true
    return
  }
  popover.hidden = false
  const isMenuBar = menuCfg.style === 'menubar'
  const items = navItemsJson()
  popover.innerHTML = isMenuBar
    ? `<oas-menubar id="nav-popover" orientation="vertical" trigger="click" items='${items}'></oas-menubar>`
    : `<oas-navigation-menu id="nav-popover" orientation="vertical" items='${items}'></oas-navigation-menu>`
  const nav = popover.firstElementChild
  nav.addEventListener('oas-select', (e) => {
    const value = e.detail?.value
    if (!value) return
    if (location.hash !== `#${value}`) location.hash = `#${value}`
    popover.hidden = true
  })
}
document.addEventListener('pointerdown', (e) => {
  const popover = document.querySelector('#menu-popover')
  if (!popover || popover.hidden) return
  const target = e.target
  if (target.closest?.('#menu-popover') || target.closest?.('#nav-toggle')) return
  popover.hidden = true
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const popover = document.querySelector('#menu-popover')
    if (popover && !popover.hidden) popover.hidden = true
  }
})
// 设置中心菜单矩阵变更 → 壳层重渲（live 切换，无需 reload）
document.addEventListener('nav-config-change', () => {
  if (!app.querySelector('#view')) return
  renderShell()
  resolve()
})

// ── 多页签栏（vanilla TabsView 语义移植，键为路由 path） ──────────────────
let tabsView = { keys: [], active: null }
const closeBatch = new Set()
let closeBatchFlush

function tabPanelHtml(key) {
  const route = matchRoute(key)
  const label = route ? t(route.titleKey) : key
  const close =
    key === HOME_PATH
      ? ''
      : `<span class="ptab-close" role="button" tabindex="-1" title="${t('tabs.closeTab')}" aria-label="${t('tabs.closeTab')}" data-ptab-close><oas-icon name="close" size="12"></oas-icon></span>`
  return `<oas-tab-panel value="${key}"><span slot="label" class="ptab">${label}${close}</span></oas-tab-panel>`
}

let renderedTabsHtml = ''

function renderTabs() {
  const pageTabs = app.querySelector('#page-tabs')
  if (!pageTabs) return
  const html = tabsView.keys.map(tabPanelHtml).join('')
  if (html !== renderedTabsHtml) {
    renderedTabsHtml = html
    pageTabs.innerHTML = html
  }
  pageTabs.setAttribute('active', tabsView.active ?? '')
}

function syncTabs() {
  tabsView = visit(tabsView, parseHash())
  renderTabs()
}

function closeTabAt(key) {
  const res = closeTab(tabsView, key)
  tabsView = res.view
  renderTabs()
  if (res.navigateTo) location.hash = `#${res.navigateTo}`
}

function wireTabs() {
  const pageTabs = app.querySelector('#page-tabs')
  if (!pageTabs) return
  pageTabs.addEventListener('oas-change', (e) => {
    const value = e.detail?.value
    if (value && parseHash() !== value) location.hash = `#${value}`
  })
  pageTabs.addEventListener('oas-close', (e) => {
    const key = e.detail?.key
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
      if (res.navigateTo) location.hash = `#${res.navigateTo}`
    })
  })
  pageTabs.addEventListener('oas-add', () => {
    location.hash = `#${HOME_PATH}`
  })
  const closeFrom = (e) => {
    const path = e.composedPath()
    if (!path.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close'))) return
    e.preventDefault()
    e.stopPropagation()
    const tabNode = path.find((n) => n instanceof Element && n.getAttribute('role') === 'tab')
    const key = tabNode?.getAttribute('data-value')
    if (key) closeTabAt(key)
  }
  pageTabs.addEventListener('click', closeFrom, true)
  pageTabs.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      closeFrom(e)
    },
    true,
  )
  wireNotifs()
  wireCommand()
}

// ── 通知中心抽屉（vanilla notif-drawer 同语义：徽标 + 列表 + 单条已读 + 全部已读） ──
let lastNotifCount = -1

function renderNotifs() {
  const list = app.querySelector('#notif-list')
  if (!list) return
  list.innerHTML = listNotifications()
    .map(
      (n) =>
        `<oas-list-item class="notif-item${n.read ? '' : ' is-unread'}" title="${n.title}" data-id="${n.id}"><span slot="description" class="notif-desc">${n.desc}</span><span slot="extra" class="notif-meta"><span class="notif-time">${n.time}</span></span></oas-list-item>`,
    )
    .join('')
}

function syncBadge() {
  const badge = app.querySelector('#notif-badge')
  const toggle = app.querySelector('#notif-toggle')
  if (!badge || !toggle) return
  const count = unreadCount()
  badge.setAttribute('value', String(count))
  toggle.setAttribute('aria-label', t('header.notificationCount', { count }))
  if (count === lastNotifCount) return
  lastNotifCount = count
  badge.classList.remove('is-pop')
  void badge.offsetWidth
  badge.classList.add('is-pop')
}

function wireNotifs() {
  const drawer = app.querySelector('#notif-drawer')
  const badge = app.querySelector('#notif-badge')
  const toggle = app.querySelector('#notif-toggle')
  if (!drawer || !badge || !toggle) return
  renderNotifs()
  syncBadge()
  toggle.addEventListener('click', () => {
    // oas-drawer 开关属性是 visible（非 open）
    if (drawer.hasAttribute('visible')) drawer.removeAttribute('visible')
    else drawer.setAttribute('visible', '')
  })
  app.querySelector('#notif-list').addEventListener('click', (e) => {
    const item = e.target.closest('oas-list-item')
    const id = item?.getAttribute('data-id')
    if (!id) return
    markRead(id)
    renderNotifs()
    syncBadge()
  })
  app.querySelector('#notif-readall').addEventListener('click', () => {
    markAllRead()
    renderNotifs()
    syncBadge()
  })
}

// ── 命令面板（vanilla oas-command 同语义：页面导航 + 主题/刷新/语言/退出动作，Ctrl+K 或 / 唤起） ──
function groupLabel(group) {
  return t(GROUP_KEYS[group] ?? group)
}

function buildCommandItems() {
  const pageItems = routes
    .filter((r) => !r.hidden)
    .map((r) => ({
      label: t(r.titleKey),
      value: r.path,
      group: groupLabel(r.group),
      keywords: [t(r.titleKey), r.path],
    }))
  const actionItems = [
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
      keywords: [t('cmd.locale'), 'i18n', 'locale'],
    },
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
  return [...pageItems, ...actionItems]
}

function execCommand(value) {
  if (value.startsWith('/')) {
    if (parseHash() !== value) location.hash = `#${value}`
    return
  }
  if (value === 'action:theme') {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
  } else if (value === 'action:refresh') {
    location.reload()
  } else if (value === 'action:logout') {
    localStorage.removeItem(SESSION_KEY)
    location.hash = '#/login'
  } else if (value === 'action:locale') {
    setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
  } else if (value.startsWith('theme:')) {
    const v = value.slice(6)
    if (v === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = v
  }
}

function wireCommand() {
  const command = app.querySelector('#command')
  if (!command) return
  command.setAttribute('items', JSON.stringify(buildCommandItems()))
  const openCommand = () => {
    if (!command.hasAttribute('open')) command.setAttribute('open', '')
  }
  const toggleCommand = () => {
    if (command.hasAttribute('open')) command.removeAttribute('open')
    else command.setAttribute('open', '')
  }
  command.addEventListener('oas-select', (e) => execCommand(e.detail?.value))
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      toggleCommand()
      return
    }
    if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    const target = e.target
    if (
      target?.closest?.('input, textarea, select, [contenteditable="true"], oas-input, oas-select')
    )
      return
    e.preventDefault()
    openCommand()
  })
}

function syncNav() {
  const nav = app.querySelector('#nav')
  if (!nav) return
  // 各形态高亮机制不同（vanilla applyNavActive 同口径）：
  // sidebar→active 属性；menubar→value 属性；navigation→items.active 字段（value 须留空）
  if (menuCfg.style === 'sidebar') {
    nav.setAttribute('items', navItemsJson())
    nav.setAttribute('active', parseHash())
  } else if (menuCfg.style === 'menubar') {
    nav.setAttribute('items', navItemsJson())
    nav.setAttribute('value', parseHash())
  } else {
    nav.setAttribute('items', navItemsJson(parseHash()))
  }
}

function syncCrumbs(route) {
  const crumbs = app.querySelector('#crumbs')
  const bar = app.querySelector('.crumbs-bar')
  if (!crumbs || !bar) return
  // 面包屑语义逐字对齐 vanilla app-shell syncNav：根项「应用」→（父路由）→ 当前页
  const home = routes[0]
  let items
  if (!route || route.path === home.path) {
    items = [{ label: t('nav.root') }, { label: t(home.titleKey) }]
  } else {
    items = [{ label: t('nav.root'), href: `#${home.path}` }]
    if (route.parent) {
      const parent = matchRoute(route.parent)
      if (parent) items.push({ label: t(parent.titleKey), href: `#${parent.path}` })
    }
    items.push({ label: t(route.titleKey) })
  }
  crumbs.setAttribute('items', JSON.stringify(items))
  bar.hidden = false
}

function resolve() {
  const hash = parseHash()
  if (!session()) {
    disposePage?.()
    disposePage = null
    tabsView = { keys: [], active: null }
    if (hash !== '/login') location.hash = '#/login'
    else renderLogin()
    return
  }
  if (hash === '/login') {
    location.hash = `#${HOME}`
    return
  }
  const route = matchRoute(hash)
  if (!route) {
    // 未知路径与 vanilla guard 语义对齐：送 /not-found（占位页）
    location.hash = '#/not-found'
    return
  }
  // 角色路由守卫：roles 白名单元数据在此执行（vanilla guard 同语义，越权 → /forbidden）；
  // 旧会话无 role 字段回退 admin（与 dashboard/profile 读取口径一致）
  const user = session()
  if (route.roles && !route.roles.includes(user.role ?? 'admin')) {
    location.hash = '#/forbidden'
    return
  }
  if (!app.querySelector('#view')) renderShell()
  syncNav()
  syncCrumbs(route)
  syncTabs()
  // 顶部进度条：路由解析后起条，页面渲染完成收条（vanilla router progress 同语义）
  progress.start()
  const view = app.querySelector('#view')
  disposePage?.()
  disposePage = route.render(view)
  progress.done()
}

// 皮肤预设启动恢复（oas-skin）：data-skin 在渲染前写 html（vanilla applySettings 同语义）
applySettings()

window.addEventListener('hashchange', resolve)
resolve()
onLocaleChange(() => {
  if (!session()) return
  resolve()
  app.querySelector('.oas-logo-word').textContent = t('app.title')
  app.querySelector('#lang-toggle').textContent = t('header.lang')
  app.querySelector('#logout').textContent = t('header.logout')
  syncNav()
})
