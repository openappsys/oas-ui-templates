export type RouteGroup = '总览' | '业务' | '系统'

export interface RouteMeta {
  title: string
  icon: string
  roles?: string[]
  hidden?: boolean
  group?: RouteGroup
}

export interface PageModule {
  render: (el: HTMLElement) => () => void
}

export interface Route {
  path: string
  meta: RouteMeta
  load: () => Promise<PageModule>
}

export const routes: Route[] = [
  {
    path: '/dashboard',
    meta: { title: '仪表盘', icon: 'star', group: '总览' },
    load: () => import('../pages/dashboard'),
  },
  {
    path: '/orders',
    meta: { title: '订单管理', icon: 'calendar', group: '业务' },
    load: () => import('../pages/orders'),
  },
  {
    path: '/products',
    meta: { title: '商品管理', icon: 'edit', roles: ['admin'], group: '业务' },
    load: () => import('../pages/products'),
  },
  {
    path: '/users',
    meta: { title: '用户管理', icon: 'user', roles: ['admin', 'viewer'], group: '业务' },
    load: () => import('../pages/users'),
  },
  {
    path: '/profile',
    meta: { title: '个人中心', icon: 'gear', group: '总览' },
    load: () => import('../pages/profile'),
  },
  {
    path: '/form',
    meta: { title: '创建订单', icon: 'plus', group: '业务' },
    load: () => import('../pages/form'),
  },
  {
    path: '/order-detail',
    meta: { title: '订单详情', icon: 'calendar', hidden: true },
    load: () => import('../pages/order-detail'),
  },
  {
    path: '/result',
    meta: { title: '结果', icon: 'check', hidden: true },
    load: () => import('../pages/result'),
  },
  {
    path: '/system/roles',
    meta: { title: '角色管理', icon: 'user', roles: ['admin'], group: '系统' },
    load: () => import('../pages/roles'),
  },
  {
    path: '/system/menus',
    meta: { title: '权限管理', icon: 'lock', roles: ['admin'], group: '系统' },
    load: () => import('../pages/menus'),
  },
  {
    path: '/system/dept',
    meta: { title: '部门管理', icon: 'user', roles: ['admin'], group: '系统' },
    load: () => import('../pages/dept'),
  },
  {
    path: '/system/dict',
    meta: { title: '字典管理', icon: 'edit', roles: ['admin'], group: '系统' },
    load: () => import('../pages/dict'),
  },
  {
    path: '/system/logs',
    meta: { title: '日志中心', icon: 'clock', roles: ['admin'], group: '系统' },
    load: () => import('../pages/logs'),
  },
  {
    path: '/settings',
    meta: { title: '设置中心', icon: 'filter', group: '系统' },
    load: () => import('../pages/settings'),
  },
  {
    path: '/products/edit',
    meta: { title: '编辑商品', icon: 'edit', roles: ['admin'], hidden: true },
    load: () => import('../pages/product-edit'),
  },
]

export function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path)
}
