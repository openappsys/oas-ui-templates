/**
 * 路由表（自 vanilla src/router/routes.ts 去 TS 移植，path / 顺序 / meta 逐字对齐）
 * 共 22 条 + 登录页（app.js 壳层特判）= 与 vanilla 全量对齐的 23 页。
 * 渲染函数：既有 3 页（dashboard / users / form）沿用现行实现，其余为本任务占位，
 * 后续任务按 vanilla 同名页逐个替换。
 *
 * 过渡期偏差（Task 5 页面替换时消除）：
 * - cdn 既有 e2e 断言「点击侧栏『基础表单』落在 #/form 且渲染 #basic-form」，
 *   故 /form 侧栏标签沿用 cdn 既有键 nav.form（navKey 覆盖），页面仍是基础表单实现；
 * - /basic-form 侧栏暂隐藏（navHidden），避免与 /form 出现两个同名菜单项，
 *   路由本身可达（哈希直访渲染占位页）。
 */
import { onLocaleChange, t } from './i18n.js'
import { renderDashboard, renderForm, renderUsers } from './pages.js'

/**
 * 「页面建设中」占位渲染（返回与页面渲染函数同构的 dispose 回调）
 * @param {string} titleKey
 * @returns {(el: HTMLElement) => () => void}
 */
function wip(titleKey) {
  return (el) => {
    function draw() {
      document.title = `${t(titleKey)} · ${t('app.title')}`
      el.innerHTML = `
        <div class="page">
          <h1 class="page-title">${t(titleKey)}</h1>
          <oas-card>
            <div data-testid="page-wip" style="padding: var(--oas-space-6) 0; text-align: center; color: var(--oas-color-text-secondary)">
              ${t('common.building')}
            </div>
          </oas-card>
        </div>`
    }
    draw()
    return onLocaleChange(draw)
  }
}

/**
 * @typedef {Object} CdnRoute
 * @property {string} path
 * @property {string} titleKey 页面标题 i18n 键（document.title）
 * @property {string} [navKey] 侧栏标签 i18n 键（缺省用 titleKey；/form 过渡期覆盖）
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
    render: wip('nav.orders'),
  },
  {
    path: '/products',
    titleKey: 'nav.products',
    icon: 'edit',
    iconColor: 'var(--oas-tint-violet)',
    roles: ['admin'],
    group: 'nav.business',
    render: wip('nav.products'),
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
    render: wip('nav.dataBoard'),
  },
  {
    path: '/profile',
    titleKey: 'nav.profile',
    icon: 'gear',
    iconColor: 'var(--oas-color-primary)',
    hidden: true,
    group: 'nav.output',
    render: wip('nav.profile'),
  },
  {
    path: '/form',
    titleKey: 'nav.createOrder',
    navKey: 'nav.form',
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
    render: wip('nav.orderDetail'),
  },
  {
    path: '/result',
    titleKey: 'nav.result',
    icon: 'check',
    hidden: true,
    parent: '/form',
    render: wip('nav.result'),
  },
  {
    path: '/system/roles',
    titleKey: 'nav.roles',
    icon: 'star-filled',
    iconColor: 'var(--oas-tint-violet)',
    roles: ['admin'],
    group: 'nav.system',
    render: wip('nav.roles'),
  },
  {
    path: '/system/menus',
    titleKey: 'nav.menus',
    icon: 'lock',
    iconColor: 'var(--oas-color-primary)',
    roles: ['admin'],
    group: 'nav.system',
    render: wip('nav.menus'),
  },
  {
    path: '/system/dept',
    titleKey: 'nav.dept',
    icon: 'organization',
    iconColor: 'var(--oas-tint-cyan)',
    roles: ['admin'],
    group: 'nav.system',
    render: wip('nav.dept'),
  },
  {
    path: '/system/category',
    titleKey: 'nav.category',
    icon: 'tree',
    iconColor: 'var(--oas-tint-violet)',
    roles: ['admin'],
    group: 'nav.system',
    render: wip('nav.category'),
  },
  {
    path: '/system/dict',
    titleKey: 'nav.dict',
    icon: 'search',
    iconColor: 'var(--oas-color-success)',
    roles: ['admin'],
    group: 'nav.system',
    render: wip('nav.dict'),
  },
  {
    path: '/system/logs',
    titleKey: 'nav.logs',
    icon: 'clock',
    iconColor: 'var(--oas-color-warning)',
    roles: ['admin'],
    group: 'nav.system',
    render: wip('nav.logs'),
  },
  {
    path: '/settings',
    titleKey: 'nav.settings',
    icon: 'filter',
    iconColor: 'var(--oas-tint-violet)',
    group: 'nav.system',
    render: wip('nav.settings'),
  },
  {
    path: '/products/edit',
    titleKey: 'nav.products',
    icon: 'edit',
    roles: ['admin'],
    hidden: true,
    parent: '/products',
    render: wip('nav.products'),
  },
  {
    path: '/forbidden',
    titleKey: 'nav.forbidden',
    icon: 'warning',
    iconColor: 'var(--oas-color-danger)',
    group: 'nav.demo',
    render: wip('nav.forbidden'),
  },
  {
    path: '/not-found',
    titleKey: 'nav.notFound',
    icon: 'search',
    iconColor: 'var(--oas-color-primary)',
    group: 'nav.demo',
    render: wip('nav.notFound'),
  },
  {
    path: '/500',
    titleKey: 'nav.serverError',
    icon: 'error',
    iconColor: 'var(--oas-color-warning)',
    group: 'nav.demo',
    render: wip('nav.serverError'),
  },
  {
    path: '/basic-form',
    titleKey: 'nav.basicForm',
    icon: 'form',
    iconColor: 'var(--oas-color-success)',
    group: 'nav.demo',
    navHidden: true,
    render: wip('nav.basicForm'),
  },
  {
    path: '/advanced-form',
    titleKey: 'nav.advancedForm',
    icon: 'menu',
    iconColor: 'var(--oas-tint-cyan)',
    group: 'nav.demo',
    render: wip('nav.advancedForm'),
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
