import { currentLocale, setLocale, t } from './i18n.js'
import { clearSession, readSession } from './session.js'
import { listNotifications, markAllRead, markRead, unreadCount } from './notifications.js'
import { progress } from './progress.js'

// 导航表：对齐 vanilla routes.ts 的非隐藏路由（分组顺序 总览→业务→系统→示例）
// 差异说明：vanilla 隐藏路由（profile/order-detail/result/product-edit）不进侧栏；
// 创建订单向导页（form.html）不上侧栏，保留可直达（vanilla /form 有菜单项，mpa 暂不收录）；
// 「基础表单」入口对齐 vanilla /basic-form（nav.basicForm），避免与向导页路径撞车
const NAV = [
  // 总览
  {
    href: './dashboard.html',
    icon: 'star',
    color: 'var(--oas-color-primary)',
    key: 'nav.dashboard',
    group: 'nav.group.overview',
  },
  {
    href: './data-board.html',
    icon: 'eye',
    color: 'var(--oas-color-primary)',
    key: 'nav.dataBoard',
    group: 'nav.group.overview',
  },
  // 业务
  {
    href: './orders.html',
    icon: 'calendar',
    color: 'var(--oas-tint-cyan)',
    key: 'nav.orders',
    group: 'nav.group.business',
  },
  {
    href: './products.html',
    icon: 'edit',
    color: 'var(--oas-tint-violet)',
    key: 'nav.products',
    group: 'nav.group.business',
  },
  {
    href: './users.html',
    icon: 'user',
    color: 'var(--oas-color-success)',
    key: 'nav.users',
    group: 'nav.group.business',
  },
  // 系统
  {
    href: './roles.html',
    icon: 'star-filled',
    color: 'var(--oas-tint-violet)',
    key: 'nav.roles',
    group: 'nav.group.system',
  },
  {
    href: './menus.html',
    icon: 'lock',
    color: 'var(--oas-color-primary)',
    key: 'nav.menus',
    group: 'nav.group.system',
  },
  {
    href: './dept.html',
    icon: 'organization',
    color: 'var(--oas-tint-cyan)',
    key: 'nav.dept',
    group: 'nav.group.system',
  },
  {
    href: './category.html',
    icon: 'tree',
    color: 'var(--oas-tint-violet)',
    key: 'nav.category',
    group: 'nav.group.system',
  },
  {
    href: './dict.html',
    icon: 'search',
    color: 'var(--oas-color-success)',
    key: 'nav.dict',
    group: 'nav.group.system',
  },
  {
    href: './logs.html',
    icon: 'clock',
    color: 'var(--oas-color-warning)',
    key: 'nav.logs',
    group: 'nav.group.system',
  },
  {
    href: './settings.html',
    icon: 'filter',
    color: 'var(--oas-tint-violet)',
    key: 'nav.settings',
    group: 'nav.group.system',
  },
  // 示例
  {
    href: './forbidden.html',
    icon: 'warning',
    color: 'var(--oas-color-danger)',
    key: 'nav.forbidden',
    group: 'nav.group.demo',
  },
  {
    href: './not-found.html',
    icon: 'search',
    color: 'var(--oas-color-primary)',
    key: 'nav.notFound',
    group: 'nav.group.demo',
  },
  {
    href: './500.html',
    icon: 'error',
    color: 'var(--oas-color-warning)',
    key: 'nav.serverError',
    group: 'nav.group.demo',
  },
  {
    href: './basic-form.html',
    icon: 'form',
    color: 'var(--oas-color-success)',
    key: 'nav.basicForm',
    group: 'nav.group.demo',
  },
  {
    href: './advanced-form.html',
    icon: 'menu',
    color: 'var(--oas-tint-cyan)',
    key: 'nav.advancedForm',
    group: 'nav.group.demo',
  },
]

// 接线壳层行为：侧栏 items 按 locale 重灌 + 语言切换 + 登出 + 导航
// 壳的静态结构在各页面 HTML 里（MPA 原始做法），此处只做 HTML 做不到的事
// active：当前页路径（如 './users.html'），须与 NAV href 逐字节全等（组件全等匹配）
// 每页启动偏好恢复：皮肤 / 玻璃 / 页签栏（settings.js 仅设置页加载；键名与其保持同步）
// tabs-bar 关闭时 html[data-tabs-bar="off"] 门控隐藏（vanilla 同语义）
function applyBootSettings() {
  try {
    const skin = localStorage.getItem('oas-admin-cdn-mpa.settings.skin') ?? ''
    if (skin) document.documentElement.setAttribute('data-skin', skin)
    if (localStorage.getItem('oas-admin-cdn-mpa.settings.glass') === 'on')
      document.documentElement.setAttribute('data-glass', '')
  } catch {
    /* 隐私模式 */
  }
  document.documentElement.dataset.tabsBar =
    localStorage.getItem('oas-admin-cdn-mpa.settings.tabs-bar') === 'false' ? 'off' : 'on'
}

// 头部图标（vanilla app-shell 同款内联 SVG）
const EXPAND_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5"/><path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5"/><path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11"/></svg>`
const COMPRESS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h3V2"/><path d="M14 5h-3V2"/><path d="M14 11h-3v3"/><path d="M2 11h3v3"/></svg>`
const BELL_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z"/><path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0"/></svg>`

// 菜单形态 × 位置（键名与 settings.js 矩阵一致；sidebar 仅 left，对齐 vanilla layout-config.ts）
const MENU_STYLE_KEY = 'oas-admin-cdn-mpa.menu-style'
const MENU_POSITION_KEY = 'oas-admin-cdn-mpa.menu-position'
const MENU_STYLES = ['sidebar', 'menubar', 'navigation']
const MENU_POSITIONS = ['left', 'right', 'top', 'top-head']

function readMenuCfg() {
  const readSafe = (key, values, fallback) => {
    const v = localStorage.getItem(key)
    return values.includes(v) ? v : fallback
  }
  const style = readSafe(MENU_STYLE_KEY, MENU_STYLES, 'sidebar')
  let position = readSafe(MENU_POSITION_KEY, MENU_POSITIONS, 'left')
  if (style === 'sidebar' && (position === 'top' || position === 'top-head')) position = 'left'
  return { style, position }
}

/** menubar/navigation 形态：静态侧栏替换为对应组件（位置 → sider 竖排 / 顶部条 / 头部内嵌） */
function applyNavMenu({ menuCfg, active, buildItems }) {
  const layout = document.querySelector('oas-layout')
  const horizontal = menuCfg.position === 'top' || menuCfg.position === 'top-head'
  if (layout) {
    layout.setAttribute('side', menuCfg.position === 'top-head' ? 'top' : menuCfg.position)
    layout.setAttribute('data-menu-style', menuCfg.style)
  }
  let nav
  if (menuCfg.style === 'menubar') {
    nav = document.createElement('oas-menubar')
    nav.setAttribute('items', buildItems('menubar'))
    nav.setAttribute('value', active)
  } else {
    nav = document.createElement('oas-navigation-menu')
    nav.setAttribute('items', buildItems('navigation', active))
  }
  nav.setAttribute('orientation', horizontal ? 'horizontal' : 'vertical')
  nav.addEventListener('oas-select', (e) => {
    const value = e.detail?.value
    if (value && value !== currentActive) location.href = value
  })
  const sider = document.querySelector('oas-sider')
  if (menuCfg.position === 'top-head') {
    const header = document.querySelector('.app-header') ?? document.querySelector('header')
    const slot = document.createElement('div')
    slot.className = 'header-nav-menubar'
    slot.appendChild(nav)
    const spacer = header?.querySelector('.spacer')
    if (spacer) spacer.before(slot)
    else header?.appendChild(slot)
    sider?.remove()
  } else if (menuCfg.position === 'top') {
    const bar = document.createElement('div')
    bar.className = 'top-nav-bar'
    bar.setAttribute('slot', 'sider')
    bar.appendChild(nav)
    if (sider) sider.replaceWith(bar)
    else layout?.prepend(bar)
  } else {
    const wrap = document.createElement('div')
    wrap.className = 'nav-sider'
    wrap.setAttribute('slot', 'sider')
    wrap.appendChild(nav)
    if (sider) sider.replaceWith(wrap)
    else layout?.prepend(wrap)
  }
  // ☰ 开关为 sidebar 抽屉专用：非 sidebar 形态隐藏（MPA 无 SPA 级浮层菜单）
  const navToggle = document.querySelector('#nav-toggle')
  if (navToggle) navToggle.hidden = true
}

// 头部增强按钮注入（各页 header 为静态 HTML，壳层统一注入全屏/通知/个人中心，免逐页改 HTML）
function injectHeaderButtons() {
  const header = document.querySelector('.app-header') ?? document.querySelector('header')
  if (!header || header.querySelector('#fullscreen-toggle')) return
  // 个人中心入口（隐藏路由，vanilla 头像菜单同职责的极简版：首字符按钮）
  const profileBtn = document.createElement('a')
  profileBtn.className = 'icon-btn profile-entry'
  profileBtn.href = './profile.html'
  profileBtn.title = t('nav.profile')
  profileBtn.setAttribute('aria-label', t('nav.profile'))
  profileBtn.textContent = (readSession()?.name ?? '?').charAt(0).toUpperCase()
  const langBtn = header.querySelector('#lang-toggle')
  if (langBtn) langBtn.before(profileBtn)
  else header.appendChild(profileBtn)
  // 通知铃铛（badge 徽标包一层，vanilla 同结构）
  const badge = document.createElement('oas-badge')
  badge.id = 'notif-badge'
  badge.setAttribute('value', '0')
  badge.setAttribute('size', 'small')
  badge.setAttribute('offset', '-2,2')
  const bell = document.createElement('button')
  bell.id = 'notif-toggle'
  bell.className = 'icon-btn'
  bell.type = 'button'
  bell.title = t('header.notification')
  bell.setAttribute('aria-label', t('header.notificationCount', { count: unreadCount() }))
  bell.innerHTML = `<span class="bell-icon">${BELL_ICON}</span>`
  badge.appendChild(bell)
  profileBtn.before(badge)
  const btn = document.createElement('button')
  btn.id = 'fullscreen-toggle'
  btn.className = 'icon-btn fullscreen-btn'
  btn.type = 'button'
  btn.title = t('header.fullscreen')
  btn.setAttribute('aria-label', t('header.fullscreen'))
  btn.setAttribute('aria-pressed', 'false')
  btn.innerHTML = `<span class="fs-expand">${EXPAND_ICON}</span><span class="fs-compress">${COMPRESS_ICON}</span>`
  const lang = header.querySelector('#lang-toggle')
  const logout = header.querySelector('#logout')
  if (lang) lang.before(btn)
  else if (logout) logout.before(btn)
  else header.appendChild(btn)
  if (!document.fullscreenEnabled) btn.hidden = true
  const safeFullscreen = (p) => {
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }
  btn.addEventListener('click', () => {
    if (document.fullscreenElement) safeFullscreen(document.exitFullscreen())
    else safeFullscreen(document.documentElement.requestFullscreen())
  })
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement != null
    btn.setAttribute('aria-pressed', String(active))
    btn.classList.toggle('is-fullscreen', active)
  })
}

export function initShell({ active }) {
  currentActive = active
  applyBootSettings()
  injectHeaderButtons()
  // 顶部页面加载条：MPA 模块求值即起条，load 事件收条
  progress.start()
  window.addEventListener('load', () => progress.done(), { once: true })
  const nav = document.querySelector('#nav')
  // 树形导航：分组父节点 + children（对齐 vanilla sidebarTreeItems），accordion 同组互斥；
  // 含 active 子项的组由组件 autoExpand 自动展开，当前项高亮走 sidebar 的 active 属性
  const GROUP_ICONS = {
    'nav.group.overview': 'eye',
    'nav.group.business': 'organization',
    'nav.group.system': 'gear',
    'nav.group.demo': 'menu',
  }
  const groups = new Map()
  for (const n of NAV) {
    const list = groups.get(n.group) ?? []
    list.push({ label: t(n.key), value: n.href, icon: n.icon, iconColor: n.color })
    groups.set(n.group, list)
  }
  const GROUP_ORDER = [
    'nav.group.overview',
    'nav.group.business',
    'nav.group.system',
    'nav.group.demo',
  ]
  /** 形态化 items：navigation 追加真实 href + active 标记（aria-current），其余形态同 sidebar 树 */
  const buildItems = (style, activePath) =>
    JSON.stringify(
      GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
        label: t(g),
        value: g,
        icon: GROUP_ICONS[g],
        children: groups
          .get(g)
          .map((c) =>
            style === 'navigation'
              ? { ...c, href: c.value, ...(c.value === activePath ? { active: '' } : {}) }
              : c,
          ),
      })),
    )
  const menuCfg = readMenuCfg()
  if (menuCfg.style === 'sidebar') {
    nav.setAttribute('items', buildItems('sidebar'))
    nav.setAttribute('accordion', '')
    nav.setAttribute('active', active)
    nav.addEventListener('oas-select', (e) => {
      const value = e.detail?.value
      if (value && value !== active) location.href = value
    })
  } else {
    applyNavMenu({ menuCfg, active, buildItems, groups, GROUP_ORDER, GROUP_ICONS })
  }

  document.querySelector('#lang-toggle').addEventListener('click', () => {
    setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
    location.reload()
  })
  document.querySelector('#nav-toggle').addEventListener('click', () => {
    const nav = document.querySelector('#nav')
    if (nav.hasAttribute('drawer-open')) nav.closeDrawer()
    else nav.openDrawer()
  })
  document.querySelector('#logout').addEventListener('click', () => {
    clearSession()
    location.href = './index.html'
  })
  // 页签栏：visit 当前页 + 会话内持久化 + 渲染 + 事件（面包屑随后插入其下）
  const tabsView = visit(loadTabs(), active)
  saveTabs(tabsView)
  const shellView = document.querySelector('#view')
  if (shellView) {
    ensureBars(shellView)
    renderTabs(tabsView)
    wireTabs()
  }
  injectBodyExtras()
  renderCrumbs()
}

// 通知抽屉 + 命令面板挂载（body 末尾一次性注入，各页壳层共用）
function injectBodyExtras() {
  if (document.querySelector('#notif-drawer')) return
  const drawer = document.createElement('oas-drawer')
  drawer.id = 'notif-drawer'
  drawer.setAttribute('title', t('header.notification'))
  drawer.setAttribute('placement', 'right')
  drawer.setAttribute('size', 'medium')
  drawer.setAttribute('no-footer', '')
  drawer.innerHTML = `
    <div class="notif-content">
      <div id="notif-list" class="notif-list"></div>
      <div class="notif-foot">
        <button id="notif-readall" class="link-btn" type="button">${t('header.allRead')}</button>
      </div>
    </div>`
  const command = document.createElement('oas-command')
  command.id = 'command'
  command.setAttribute('hotkey', 'false')
  document.body.append(drawer, command)
  wireNotifs(drawer)
  wireCommand(command)
}

// ── 通知中心抽屉（vanilla notif-drawer 同语义；MPA 每页内存态，等价 vanilla 刷新重置） ──
function renderNotifs() {
  const list = document.querySelector('#notif-list')
  if (!list) return
  list.innerHTML = listNotifications()
    .map(
      (n) =>
        `<oas-list-item class="notif-item${n.read ? '' : ' is-unread'}" title="${n.title}" data-id="${n.id}"><span slot="description" class="notif-desc">${n.desc}</span><span slot="extra" class="notif-meta"><span class="notif-time">${n.time}</span></span></oas-list-item>`,
    )
    .join('')
}

function syncBadge() {
  const badge = document.querySelector('#notif-badge')
  const toggle = document.querySelector('#notif-toggle')
  if (!badge || !toggle) return
  badge.setAttribute('value', String(unreadCount()))
  toggle.setAttribute('aria-label', t('header.notificationCount', { count: unreadCount() }))
}

function wireNotifs(drawer) {
  const badge = document.querySelector('#notif-badge')
  const toggle = document.querySelector('#notif-toggle')
  renderNotifs()
  syncBadge()
  if (!badge || !toggle) return
  toggle.addEventListener('click', () => {
    // oas-drawer 开关属性是 visible（非 open）
    if (drawer.hasAttribute('visible')) drawer.removeAttribute('visible')
    else drawer.setAttribute('visible', '')
  })
  drawer.querySelector('#notif-list').addEventListener('click', (e) => {
    const item = e.target.closest('oas-list-item')
    const id = item?.getAttribute('data-id')
    if (!id) return
    markRead(id)
    renderNotifs()
    syncBadge()
  })
  drawer.querySelector('#notif-readall').addEventListener('click', () => {
    markAllRead()
    renderNotifs()
    syncBadge()
  })
}

// ── 命令面板（vanilla oas-command 同语义；页面项为侧栏可见页，MPA 动作为真实跳转/reload） ──
function buildCommandItems() {
  const pageItems = NAV.map((n) => ({
    label: t(n.key),
    value: n.href,
    group: t(n.group),
    keywords: [t(n.key), n.href],
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
  if (value.startsWith('./')) {
    if (value !== currentActive) location.href = value
    return
  }
  if (value === 'action:theme') {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
  } else if (value === 'action:refresh') {
    location.reload()
  } else if (value === 'action:logout') {
    clearSession()
    location.href = './index.html'
  } else if (value === 'action:locale') {
    setLocale(currentLocale() === 'en' ? 'zh-CN' : 'en')
    location.reload()
  } else if (value.startsWith('theme:')) {
    const v = value.slice(6)
    if (v === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = v
  }
}

function wireCommand(command) {
  command.setAttribute('items', JSON.stringify(buildCommandItems()))
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
    if (!command.hasAttribute('open')) command.setAttribute('open', '')
  })
}

// ── 公开 helper：面包屑注入 ──────────────────────────────────────────────
// 用法：OASShell.setBreadcrumb([
//   { label: 'nav.orders', href: './orders.html' }, // label 传 i18n key，渲染时经 t() 换文
//   { label: 'order.detail' },                      // 末项不传 href = 当前页（aria-current）
// ])
// - 渲染进页面 .crumbs-bar（#view 首位），无该容器则动态创建
// - 纯原生 DOM 操作（ol/li/a），无组件依赖
// - 页面未调用 setBreadcrumb 时，initShell 按 NAV（active → 分组+页面）自动兜底，
//   使全站页面（含 dashboard/orders/users 等未显式接入页）均有面包屑
// - 中英支持：items 注册在本模块内，语言切换 = setLocale + reload（MPA 约定），
//   页面初始化时重新调用 setBreadcrumb 即以新 locale 的 t() 重新渲染
let registeredCrumbs = []
let currentActive = ''

// ── 多页签栏（vanilla TabsView 语义移植；MPA 键为页面 href，sessionStorage 持久化：
// 同一浏览器标签页的浏览会话内跨页面留存，关浏览器标签即复位，等价 vanilla 内存态生命周期） ──
const HOME_HREF = './dashboard.html'
const PAGE_TABS_KEY = 'oas-admin-cdn-mpa.page-tabs'
// 不在侧栏的页面归并到父页签（对齐 vanilla hidden→parent）；错误页不入页签
const HIDDEN_TAB_PARENTS = {
  './order-detail.html': './orders.html',
  './product-edit.html': './products.html',
  './result.html': './form.html',
}
const ERROR_HREFS = new Set(['./forbidden.html', './not-found.html', './500.html'])

function tabKeyOf(href) {
  if (HIDDEN_TAB_PARENTS[href]) return HIDDEN_TAB_PARENTS[href]
  if (ERROR_HREFS.has(href)) return null
  return href
}

function ensureHome(keys) {
  return keys.includes(HOME_HREF) ? keys : [HOME_HREF, ...keys]
}

function visit(prev, href) {
  const key = tabKeyOf(href)
  const keys = ensureHome(prev.keys)
  if (key === null || key === prev.active) {
    return { keys, active: prev.active ?? HOME_HREF }
  }
  return { keys: keys.includes(key) ? keys : [...keys, key], active: key }
}

function closeTabAt(view, closed) {
  if (closed === HOME_HREF) return { view, navigateTo: null }
  const idx = view.keys.indexOf(closed)
  if (idx === -1) return { view, navigateTo: null }
  const keys = view.keys.filter((k) => k !== closed)
  if (view.active !== closed) return { view: { keys, active: view.active }, navigateTo: null }
  const next = view.keys[idx + 1] ?? view.keys[idx - 1] ?? HOME_HREF
  return { view: { keys, active: next }, navigateTo: next }
}

function closeKeysBatch(view, closed) {
  const set = new Set(closed.filter((k) => k !== HOME_HREF))
  if (set.size === 0) return { view, navigateTo: null }
  const keys = view.keys.filter((k) => !set.has(k))
  if (!set.has(view.active ?? '')) return { view: { keys, active: view.active }, navigateTo: null }
  const next = view.keys.find((k) => k !== HOME_HREF && !set.has(k)) ?? HOME_HREF
  return { view: { keys, active: next }, navigateTo: next }
}

function loadTabs() {
  try {
    return JSON.parse(sessionStorage.getItem(PAGE_TABS_KEY) ?? 'null') ?? { keys: [], active: null }
  } catch {
    return { keys: [], active: null }
  }
}

function saveTabs(view) {
  try {
    sessionStorage.setItem(PAGE_TABS_KEY, JSON.stringify(view))
  } catch {
    /* 隐私模式 */
  }
}

function tabLabelOf(key) {
  const nav = NAV.find((n) => n.href === key)
  if (nav) return t(nav.key)
  if (key === './form.html') return t('nav.createOrder')
  return key
}

function tabPanelHtml(key) {
  const label = tabLabelOf(key)
  const close =
    key === HOME_HREF
      ? ''
      : `<span class="ptab-close" role="button" tabindex="-1" title="${t('tabs.closeTab')}" aria-label="${t('tabs.closeTab')}" data-ptab-close><oas-icon name="close" size="12"></oas-icon></span>`
  return `<oas-tab-panel value="${key}"><span slot="label" class="ptab">${label}${close}</span></oas-tab-panel>`
}

function ensureBars(view) {
  let tabsBar = view.querySelector('.tabs-bar')
  if (!tabsBar) {
    tabsBar = document.createElement('div')
    tabsBar.className = 'tabs-bar'
    tabsBar.innerHTML =
      '<oas-tabs id="page-tabs" data-testid="page-tabs" type="card" hide-content context-menu></oas-tabs>'
    view.prepend(tabsBar)
  }
  let bar = view.querySelector('.crumbs-bar')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'crumbs-bar'
    bar.innerHTML = '<oas-breadcrumb id="crumbs" data-testid="crumbs"></oas-breadcrumb>'
    tabsBar.after(bar)
  }
  return { tabsBar, bar }
}

function renderTabs(tabsView) {
  const pageTabs = document.querySelector('#page-tabs')
  if (!pageTabs) return
  const html = tabsView.keys.map(tabPanelHtml).join('')
  if (pageTabs.dataset.rendered !== html) {
    pageTabs.dataset.rendered = html
    pageTabs.innerHTML = html
  }
  pageTabs.setAttribute('active', tabsView.active ?? '')
}

function wireTabs() {
  const pageTabs = document.querySelector('#page-tabs')
  if (!pageTabs) return
  const apply = (res) => {
    saveTabs(res.view)
    renderTabs(res.view)
    if (res.navigateTo) {
      // active 页签被关闭：导航到存活页签（MPA 真实跳转，目标页 initShell 会再 visit）
      location.href = res.navigateTo
    }
  }
  let closeBatch = new Set()
  let closeBatchFlush
  pageTabs.addEventListener('oas-change', (e) => {
    const value = e.detail?.value
    if (value && value !== currentActive) location.href = value
  })
  pageTabs.addEventListener('oas-close', (e) => {
    const key = e.detail?.key
    if (!key) return
    closeBatch.add(key)
    if (closeBatchFlush !== undefined) return
    closeBatchFlush = queueMicrotask(() => {
      closeBatchFlush = undefined
      const keys = [...closeBatch]
      closeBatch = new Set()
      apply(closeKeysBatch(loadTabs(), keys))
    })
  })
  pageTabs.addEventListener('oas-add', () => {
    location.href = HOME_HREF
  })
  const closeFrom = (e) => {
    const path = e.composedPath()
    if (!path.some((n) => n instanceof Element && n.hasAttribute('data-ptab-close'))) return
    e.preventDefault()
    e.stopPropagation()
    const tabNode = path.find((n) => n instanceof Element && n.getAttribute('role') === 'tab')
    const key = tabNode?.getAttribute('data-value')
    if (key) apply(closeTabAt(loadTabs(), key))
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
}

function autoCrumbs() {
  const entry = NAV.find((n) => n.href === currentActive)
  if (!entry) return []
  return [{ label: entry.group }, { label: entry.key }]
}

function renderCrumbs() {
  const view = document.querySelector('#view')
  const items = registeredCrumbs.length > 0 ? registeredCrumbs : autoCrumbs()
  if (!view || items.length === 0) return
  // oas-breadcrumb 组件渲染（与 vanilla/cdn 同一消费方式）；label 传 i18n key 的契约不变，
  // 渲染前统一经 t() 换文，items 末项无 href 即当前页
  const crumbs = view.querySelector('#crumbs')
  if (!crumbs) return
  const translated = items.map((item) => ({ ...item, label: t(item.label) }))
  crumbs.setAttribute('items', JSON.stringify(translated))
}

window.OASShell = window.OASShell || {}
window.OASShell.setBreadcrumb = (items) => {
  registeredCrumbs = Array.isArray(items) ? items.slice() : []
  renderCrumbs()
}
