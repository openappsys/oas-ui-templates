/**
 * 路由表（自 vanilla src/router/routes.ts 去 TS 移植，path / 顺序 / meta 逐字对齐）
 * 共 22 条 + 登录页（app.js 壳层特判）= 与 vanilla 全量对齐的 23 页。
 * 渲染函数：dashboard / users / form 三页在 pages-dashboard.js / pages-users.js /
 * pages-form.js（三步订单向导）；其余批 A / 批 B 页面在 pages-*.js 各自文件
 * （单文件 ≤400 行纪律）。
 */
import { renderDashboard } from './pages-dashboard.js'
import { renderUsers } from './pages-users.js'
import { renderForm } from './pages-form.js'
import { renderOrders } from './pages-orders.js'
import { renderOrderDetail } from './pages-order-detail.js'
import { renderProductEdit } from './pages-product-edit.js'
import { renderProducts } from './pages-products.js'
import { renderDataBoard } from './pages-data-board.js'
import { renderResult } from './pages-result.js'
import { renderProfile } from './pages-profile.js'
import { renderForbidden, renderNotFound, renderServerError } from './pages-errors.js'
import { renderRoles } from './pages-roles.js'
import { renderMenus } from './pages-menus.js'
import { renderDept } from './pages-dept.js'
import { renderCategory } from './pages-category.js'
import { renderDict } from './pages-dict.js'
import { renderLogs } from './pages-logs.js'
import { renderSettings } from './pages-settings.js'
import { renderBasicForm } from './pages-basic-form.js'
import { renderAdvancedForm } from './pages-advanced-form.js'

/**
 * @typedef {Object} CdnRoute
 * @property {string} path
 * @property {string} titleKey 页面标题 i18n 键（document.title）
 * @property {string} [navKey] 侧栏标签 i18n 键（缺省用 titleKey）
 * @property {string} icon
 * @property {string} [iconColor]
 * @property {string[]} [roles] 角色白名单（逐字保留 vanilla 元数据；cdn 会话无角色概念，暂不启用守卫）
 * @property {boolean} [hidden] vanilla 侧隐藏路由（详情 / 结果 / 编辑页）
 * @property {boolean} [navHidden] cdn 过渡期侧栏隐藏（不影响哈希直访）
 * @property {'nav.output' | 'nav.business' | 'nav.system' | 'nav.demo'} [group]
 * @property {string} [parent] 面包屑父级路由
 * @property {(el: HTMLElement) => () => void} render
 */

/** @type {CdnRoute[]} */
export const routes = [
  {
    path: '/dashboard',
    titleKey: 'nav.dashboard',
    icon: 'star',
    iconColor: 'var(--oas-color-primary)',
    group: 'nav.output',
    render: renderDashboard,
  },
  {
    path: '/orders',
    titleKey: 'nav.orders',
    icon: 'calendar',
    iconColor: 'var(--oas-tint-cyan)',
    group: 'nav.business',
    render: renderOrders,
  },
  {
    path: '/products',
    titleKey: 'nav.products',
    icon: 'edit',
    iconColor: 'var(--oas-tint-violet)',
    roles: ['admin'],
    group: 'nav.business',
    render: renderProducts,
  },
  {
    path: '/users',
    titleKey: 'nav.users',
    icon: 'user',
    iconColor: 'var(--oas-color-success)',
    roles: ['admin', 'viewer'],
    group: 'nav.business',
    render: renderUsers,
  },
  {
    path: '/data-board',
    titleKey: 'nav.dataBoard',
    icon: 'eye',
    iconColor: 'var(--oas-color-primary)',
    group: 'nav.output',
    render: renderDataBoard,
  },
  {
    path: '/profile',
    titleKey: 'nav.profile',
    icon: 'gear',
    iconColor: 'var(--oas-color-primary)',
    hidden: true,
    group: 'nav.output',
    render: renderProfile,
  },
  {
    path: '/form',
    titleKey: 'nav.createOrder',
    icon: 'plus',
    iconColor: 'var(--oas-color-warning)',
    group: 'nav.business',
    render: renderForm,
  },
  {
    path: '/order-detail',
    titleKey: 'nav.orderDetail',
    icon: 'calendar',
    hidden: true,
    parent: '/orders',
    render: renderOrderDetail,
  },
  {
    path: '/result',
    titleKey: 'nav.result',
    icon: 'check',
    hidden: true,
    parent: '/form',
    render: renderResult,
  },
  {
    path: '/system/roles',
    titleKey: 'nav.roles',
    icon: 'star-filled',
    iconColor: 'var(--oas-tint-violet)',
    roles: ['admin'],
    group: 'nav.system',
    render: renderRoles,
  },
  {
    path: '/system/menus',
    titleKey: 'nav.menus',
    icon: 'lock',
    iconColor: 'var(--oas-color-primary)',
    roles: ['admin'],
    group: 'nav.system',
    render: renderMenus,
  },
  {
    path: '/system/dept',
    titleKey: 'nav.dept',
    icon: 'organization',
    iconColor: 'var(--oas-tint-cyan)',
    roles: ['admin'],
    group: 'nav.system',
    render: renderDept,
  },
  {
    path: '/system/category',
    titleKey: 'nav.category',
    icon: 'tree',
    iconColor: 'var(--oas-tint-violet)',
    roles: ['admin'],
    group: 'nav.system',
    render: renderCategory,
  },
  {
    path: '/system/dict',
    titleKey: 'nav.dict',
    icon: 'search',
    iconColor: 'var(--oas-color-success)',
    roles: ['admin'],
    group: 'nav.system',
    render: renderDict,
  },
  {
    path: '/system/logs',
    titleKey: 'nav.logs',
    icon: 'clock',
    iconColor: 'var(--oas-color-warning)',
    roles: ['admin'],
    group: 'nav.system',
    render: renderLogs,
  },
  {
    path: '/settings',
    titleKey: 'nav.settings',
    icon: 'filter',
    iconColor: 'var(--oas-tint-violet)',
    group: 'nav.system',
    render: renderSettings,
  },
  {
    path: '/products/edit',
    titleKey: 'nav.products',
    icon: 'edit',
    roles: ['admin'],
    hidden: true,
    parent: '/products',
    render: renderProductEdit,
  },
  {
    path: '/forbidden',
    titleKey: 'nav.forbidden',
    icon: 'warning',
    iconColor: 'var(--oas-color-danger)',
    group: 'nav.demo',
    render: renderForbidden,
  },
  {
    path: '/not-found',
    titleKey: 'nav.notFound',
    icon: 'search',
    iconColor: 'var(--oas-color-primary)',
    group: 'nav.demo',
    render: renderNotFound,
  },
  {
    path: '/500',
    titleKey: 'nav.serverError',
    icon: 'error',
    iconColor: 'var(--oas-color-warning)',
    group: 'nav.demo',
    render: renderServerError,
  },
  {
    path: '/basic-form',
    titleKey: 'nav.basicForm',
    icon: 'form',
    iconColor: 'var(--oas-color-success)',
    group: 'nav.demo',
    render: renderBasicForm,
  },
  {
    path: '/advanced-form',
    titleKey: 'nav.advancedForm',
    icon: 'menu',
    iconColor: 'var(--oas-tint-cyan)',
    group: 'nav.demo',
    render: renderAdvancedForm,
  },
]

/**
 * 按 path 精确匹配路由
 * @param {string} path
 * @returns {CdnRoute | undefined}
 */
export function matchRoute(path) {
  return routes.find((r) => r.path === path)
}
