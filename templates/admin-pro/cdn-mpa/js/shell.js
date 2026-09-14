import { currentLocale, setLocale, t } from './i18n.js'
import { clearSession } from './session.js'

// 导航表：对齐 vanilla routes.ts 的非隐藏路由（分组顺序 总览→业务→系统→示例）
// 差异说明：vanilla 隐藏路由（profile/order-detail/result/product-edit）不进侧栏；
// 创建订单向导页尚未落地，暂不设菜单项——既有 form.html（基础表单）占位 示例 组的
// nav.basicForm 对应位，避免出现两个「基础表单」标签破坏 e2e 的 getByText 唯一性
const NAV = [
  // 总览
  { href: './dashboard.html', icon: 'star', color: 'var(--oas-color-primary)', key: 'nav.dashboard', group: 'nav.group.overview' },
  { href: './data-board.html', icon: 'eye', color: 'var(--oas-color-primary)', key: 'nav.dataBoard', group: 'nav.group.overview' },
  // 业务
  { href: './orders.html', icon: 'calendar', color: 'var(--oas-tint-cyan)', key: 'nav.orders', group: 'nav.group.business' },
  { href: './products.html', icon: 'edit', color: 'var(--oas-tint-violet)', key: 'nav.products', group: 'nav.group.business' },
  { href: './users.html', icon: 'user', color: 'var(--oas-color-success)', key: 'nav.users', group: 'nav.group.business' },
  // 系统
  { href: './roles.html', icon: 'star-filled', color: 'var(--oas-tint-violet)', key: 'nav.roles', group: 'nav.group.system' },
  { href: './menus.html', icon: 'lock', color: 'var(--oas-color-primary)', key: 'nav.menus', group: 'nav.group.system' },
  { href: './dept.html', icon: 'organization', color: 'var(--oas-tint-cyan)', key: 'nav.dept', group: 'nav.group.system' },
  { href: './category.html', icon: 'tree', color: 'var(--oas-tint-violet)', key: 'nav.category', group: 'nav.group.system' },
  { href: './dict.html', icon: 'search', color: 'var(--oas-color-success)', key: 'nav.dict', group: 'nav.group.system' },
  { href: './logs.html', icon: 'clock', color: 'var(--oas-color-warning)', key: 'nav.logs', group: 'nav.group.system' },
  { href: './settings.html', icon: 'filter', color: 'var(--oas-tint-violet)', key: 'nav.settings', group: 'nav.group.system' },
  // 示例
  { href: './forbidden.html', icon: 'warning', color: 'var(--oas-color-danger)', key: 'nav.forbidden', group: 'nav.group.demo' },
  { href: './not-found.html', icon: 'search', color: 'var(--oas-color-primary)', key: 'nav.notFound', group: 'nav.group.demo' },
  { href: './500.html', icon: 'error', color: 'var(--oas-color-warning)', key: 'nav.serverError', group: 'nav.group.demo' },
  { href: './form.html', icon: 'form', color: 'var(--oas-color-success)', key: 'nav.form', group: 'nav.group.demo' },
  { href: './advanced-form.html', icon: 'menu', color: 'var(--oas-tint-cyan)', key: 'nav.advancedForm', group: 'nav.group.demo' },
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
