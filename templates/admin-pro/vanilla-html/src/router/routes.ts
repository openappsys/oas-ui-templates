export type RouteGroup = 'nav.output' | 'nav.business' | 'nav.system'

export interface RouteMeta {
  titleKey: string
  icon: string
  roles?: string[]
  hidden?: boolean
  group?: RouteGroup
  /** 面包屑父级路由 path（用于隐藏的详情/结果页显示层级） */
  parent?: string
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
    meta: { titleKey: 'nav.dashboard', icon: 'star', group: 'nav.output' },
    load: () => import('../pages/dashboard'),
  },
  {
    path: '/orders',
    meta: { titleKey: 'nav.orders', icon: 'calendar', group: 'nav.business' },
    load: () => import('../pages/orders'),
  },
  {
    path: '/products',
    meta: { titleKey: 'nav.products', icon: 'edit', roles: ['admin'], group: 'nav.business' },
    load: () => import('../pages/products'),
  },
  {
    path: '/users',
    meta: {
      titleKey: 'nav.users',
      icon: 'user',
      roles: ['admin', 'viewer'],
      group: 'nav.business',
    },
    load: () => import('../pages/users'),
  },
  {
    path: '/profile',
    meta: { titleKey: 'nav.profile', icon: 'gear', group: 'nav.output' },
    load: () => import('../pages/profile'),
  },
  {
    path: '/form',
    meta: { titleKey: 'nav.createOrder', icon: 'plus', group: 'nav.business' },
    load: () => import('../pages/form'),
  },
  {
    path: '/order-detail',
    meta: { titleKey: 'nav.orderDetail', icon: 'calendar', hidden: true, parent: '/orders' },
    load: () => import('../pages/order-detail'),
  },
  {
    path: '/result',
    meta: { titleKey: 'nav.result', icon: 'check', hidden: true, parent: '/form' },
    load: () => import('../pages/result'),
  },
  {
    path: '/system/roles',
    meta: { titleKey: 'nav.roles', icon: 'star-filled', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/roles'),
  },
  {
    path: '/system/menus',
    meta: { titleKey: 'nav.menus', icon: 'lock', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/menus'),
  },
  {
    path: '/system/dept',
    meta: { titleKey: 'nav.dept', icon: 'organization', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/dept'),
  },
  {
    path: '/system/dict',
    meta: { titleKey: 'nav.dict', icon: 'search', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/dict'),
  },
  {
    path: '/system/logs',
    meta: { titleKey: 'nav.logs', icon: 'clock', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/logs'),
  },
  {
    path: '/settings',
    meta: { titleKey: 'nav.settings', icon: 'filter', group: 'nav.system' },
    load: () => import('../pages/settings'),
  },
  {
    path: '/products/edit',
    meta: {
      titleKey: 'nav.products',
      icon: 'edit',
      roles: ['admin'],
      hidden: true,
      parent: '/products',
    },
    load: () => import('../pages/product-edit'),
  },
  {
    path: '/forbidden',
    meta: { titleKey: 'nav.forbidden', icon: 'ban', hidden: true },
    load: () => import('../pages/forbidden'),
  },
  {
    path: '/not-found',
    meta: { titleKey: 'nav.notFound', icon: 'search', hidden: true },
    load: () => import('../pages/not-found'),
  },
  {
    path: '/basic-form',
    meta: { titleKey: 'nav.basicForm', icon: 'plus', group: 'nav.business' },
    load: () => import('../pages/basic-form'),
  },
]

export function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path)
}
