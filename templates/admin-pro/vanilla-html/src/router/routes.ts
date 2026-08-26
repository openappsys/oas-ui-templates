export type RouteGroup = 'nav.output' | 'nav.business' | 'nav.system' | 'nav.demo'

export interface RouteMeta {
  titleKey: string
  icon: string
  /** 侧栏图标颜色（可选，任意 CSS 色值；缺省随激活/禁用态着色） */
  iconColor?: string
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
    meta: {
      titleKey: 'nav.dashboard',
      icon: 'star',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    load: () => import('../pages/dashboard'),
  },
  {
    path: '/orders',
    meta: {
      titleKey: 'nav.orders',
      icon: 'calendar',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.business',
    },
    load: () => import('../pages/orders'),
  },
  {
    path: '/products',
    meta: {
      titleKey: 'nav.products',
      icon: 'edit',
      iconColor: 'var(--oas-tint-violet)',
      roles: ['admin'],
      group: 'nav.business',
    },
    load: () => import('../pages/products'),
  },
  {
    path: '/users',
    meta: {
      titleKey: 'nav.users',
      icon: 'user',
      iconColor: 'var(--oas-color-success)',
      roles: ['admin', 'viewer'],
      group: 'nav.business',
    },
    load: () => import('../pages/users'),
  },
  {
    path: '/data-board',
    meta: {
      titleKey: 'nav.dataBoard',
      icon: 'eye',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    load: () => import('../pages/data-board'),
  },
  {
    path: '/profile',
    meta: {
      titleKey: 'nav.profile',
      icon: 'gear',
      iconColor: 'var(--oas-color-primary)',
      hidden: true,
      group: 'nav.output',
    },
    load: () => import('../pages/profile'),
  },
  {
    path: '/form',
    meta: {
      titleKey: 'nav.createOrder',
      icon: 'plus',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.business',
    },
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
    meta: {
      titleKey: 'nav.roles',
      icon: 'star-filled',
      iconColor: 'var(--oas-tint-violet)',
      roles: ['admin'],
      group: 'nav.system',
    },
    load: () => import('../pages/roles'),
  },
  {
    path: '/system/menus',
    meta: {
      titleKey: 'nav.menus',
      icon: 'lock',
      iconColor: 'var(--oas-color-primary)',
      roles: ['admin'],
      group: 'nav.system',
    },
    load: () => import('../pages/menus'),
  },
  {
    path: '/system/dept',
    meta: {
      titleKey: 'nav.dept',
      icon: 'organization',
      iconColor: 'var(--oas-tint-cyan)',
      roles: ['admin'],
      group: 'nav.system',
    },
    load: () => import('../pages/dept'),
  },
  {
    path: '/system/category',
    meta: {
      titleKey: 'nav.category',
      icon: 'tree',
      iconColor: 'var(--oas-tint-violet)',
      roles: ['admin'],
      group: 'nav.system',
    },
    load: () => import('../pages/category'),
  },
  {
    path: '/system/dict',
    meta: {
      titleKey: 'nav.dict',
      icon: 'search',
      iconColor: 'var(--oas-color-success)',
      roles: ['admin'],
      group: 'nav.system',
    },
    load: () => import('../pages/dict'),
  },
  {
    path: '/system/logs',
    meta: {
      titleKey: 'nav.logs',
      icon: 'clock',
      iconColor: 'var(--oas-color-warning)',
      roles: ['admin'],
      group: 'nav.system',
    },
    load: () => import('../pages/logs'),
  },
  {
    path: '/settings',
    meta: {
      titleKey: 'nav.settings',
      icon: 'filter',
      iconColor: 'var(--oas-tint-violet)',
      group: 'nav.system',
    },
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
    meta: {
      titleKey: 'nav.forbidden',
      icon: 'warning',
      iconColor: 'var(--oas-color-danger)',
      group: 'nav.demo',
    },
    load: () => import('../pages/forbidden'),
  },
  {
    path: '/not-found',
    meta: {
      titleKey: 'nav.notFound',
      icon: 'search',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.demo',
    },
    load: () => import('../pages/not-found'),
  },
  {
    path: '/500',
    meta: {
      titleKey: 'nav.serverError',
      icon: 'error',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.demo',
    },
    load: () => import('../pages/server-error'),
  },
  {
    path: '/basic-form',
    meta: {
      titleKey: 'nav.basicForm',
      icon: 'copy',
      iconColor: 'var(--oas-color-success)',
      group: 'nav.demo',
    },
    load: () => import('../pages/basic-form'),
  },
  {
    path: '/advanced-form',
    meta: {
      titleKey: 'nav.advancedForm',
      icon: 'menu',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.demo',
    },
    load: () => import('../pages/advanced-form'),
  },
]

export function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path)
}
