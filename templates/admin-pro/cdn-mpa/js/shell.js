import { currentLocale, setLocale, t } from './i18n.js'
import { clearSession } from './session.js'

// 导航表：对齐 vanilla routes.ts 的非隐藏路由（分组顺序 总览→业务→系统→示例）
// 差异说明：vanilla 隐藏路由（profile/order-detail/result/product-edit）不进侧栏；
// 创建订单向导页尚未落地，不设菜单项（旧占位页 form.html 保留可直达但不上侧栏）；
// 「基础表单」入口对齐 vanilla /basic-form（nav.basicForm），避免与占位页标题撞文案
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
export function initShell({ active }) {
  const nav = document.querySelector('#nav')
  nav.setAttribute(
    'items',
    JSON.stringify(
      NAV.map((n) => ({
        label: t(n.key),
        value: n.href,
        icon: n.icon,
        iconColor: n.color,
        group: t(n.group),
      })),
    ),
  )
  nav.setAttribute('active', active)
  nav.addEventListener('oas-select', (e) => {
    const value = e.detail?.value
    if (value && value !== active) location.href = value
  })

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
}

// ── 公开 helper：面包屑注入（Task 4+ 页面使用） ───────────────────────────
// 用法：OASShell.setBreadcrumb([
//   { label: 'nav.orders', href: './orders.html' }, // label 传 i18n key，渲染时经 t() 换文
//   { label: 'order.detail' },                      // 末项不传 href = 当前页（aria-current）
// ])
// - 渲染进页面 .crumbs-bar（#view 首位），无该容器则动态创建
// - 纯原生 DOM 操作（ol/li/a），无组件依赖
// - 中英支持：items 注册在本模块内，语言切换 = setLocale + reload（MPA 约定），
//   页面初始化时重新调用 setBreadcrumb 即以新 locale 的 t() 重新渲染
let registeredCrumbs = []

function renderCrumbs() {
  const view = document.querySelector('#view')
  if (!view || registeredCrumbs.length === 0) return
  let bar = view.querySelector('.crumbs-bar')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'crumbs-bar'
    view.prepend(bar)
  }
  const ol = document.createElement('ol')
  ol.className = 'crumbs'
  for (const item of registeredCrumbs) {
    const li = document.createElement('li')
    if (item.href) {
      const a = document.createElement('a')
      a.href = item.href
      a.textContent = t(item.label)
      li.appendChild(a)
    } else {
      li.setAttribute('aria-current', 'page')
      li.textContent = t(item.label)
    }
    ol.appendChild(li)
  }
  bar.replaceChildren(ol)
}

window.OASShell = window.OASShell || {}
window.OASShell.setBreadcrumb = function (items) {
  registeredCrumbs = Array.isArray(items) ? items.slice() : []
  renderCrumbs()
}
