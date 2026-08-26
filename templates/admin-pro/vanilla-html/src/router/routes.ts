export type RouteGroup = 'nav.output' | 'nav.business' | 'nav.system' | 'nav.demo'

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
    meta: { titleKey: 'nav.dashboard', icon: 'nav-dashboard', group: 'nav.output' },
    load: () => import('../pages/dashboard'),
  },
  {
    path: '/orders',
    meta: { titleKey: 'nav.orders', icon: 'nav-orders', group: 'nav.business' },
    load: () => import('../pages/orders'),
  },
  {
    path: '/products',
    meta: {
      titleKey: 'nav.products',
      icon: 'nav-products',
      roles: ['admin'],
      group: 'nav.business',
    },
    load: () => import('../pages/products'),
  },
  {
    path: '/users',
    meta: {
      titleKey: 'nav.users',
      icon: 'nav-users',
      roles: ['admin', 'viewer'],
      group: 'nav.business',
    },
    load: () => import('../pages/users'),
  },
  {
    path: '/profile',
    meta: { titleKey: 'nav.profile', icon: 'nav-profile', group: 'nav.output' },
    load: () => import('../pages/profile'),
  },
  {
    path: '/form',
    meta: { titleKey: 'nav.createOrder', icon: 'nav-create-order', group: 'nav.business' },
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
    meta: { titleKey: 'nav.roles', icon: 'nav-roles', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/roles'),
  },
  {
    path: '/system/menus',
    meta: { titleKey: 'nav.menus', icon: 'nav-menus', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/menus'),
  },
  {
    path: '/system/dept',
    meta: { titleKey: 'nav.dept', icon: 'nav-dept', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/dept'),
  },
  {
    path: '/system/dict',
    meta: { titleKey: 'nav.dict', icon: 'nav-dict', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/dict'),
  },
  {
    path: '/system/logs',
    meta: { titleKey: 'nav.logs', icon: 'nav-logs', roles: ['admin'], group: 'nav.system' },
    load: () => import('../pages/logs'),
  },
  {
    path: '/settings',
    meta: { titleKey: 'nav.settings', icon: 'nav-settings', group: 'nav.system' },
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
    meta: { titleKey: 'nav.forbidden', icon: 'nav-forbidden', group: 'nav.demo' },
    load: () => import('../pages/forbidden'),
  },
  {
    path: '/not-found',
    meta: { titleKey: 'nav.notFound', icon: 'nav-not-found', group: 'nav.demo' },
    load: () => import('../pages/not-found'),
  },
  {
    path: '/500',
    meta: { titleKey: 'nav.serverError', icon: 'nav-server-error', group: 'nav.demo' },
    load: () => import('../pages/server-error'),
  },
  {
    path: '/basic-form',
    meta: { titleKey: 'nav.basicForm', icon: 'nav-basic-form', group: 'nav.demo' },
    load: () => import('../pages/basic-form'),
  },
]

export function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path)
}
