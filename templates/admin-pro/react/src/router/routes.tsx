// src/router/routes.tsx —— 路由表事实来源
// 本模版为 HashRouter 组装需要补入，meta 为本模版新增（titleKey 取 i18n 已存在的 login.welcome）
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type RouteGroup = 'nav.output' | 'nav.business' | 'nav.system' | 'nav.demo'

export interface AppRouteMeta {
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

export interface AppRoute {
  path: string
  meta: AppRouteMeta
  Component: LazyExoticComponent<ComponentType>
}

export const appRoutes: AppRoute[] = [
  {
    path: '/dashboard',
    meta: {
      titleKey: 'nav.dashboard',
      icon: 'star',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    Component: lazy(() => import('../pages/dashboard')),
  },
  {
    path: '/orders',
    meta: {
      titleKey: 'nav.orders',
      icon: 'calendar',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.business',
    },
    Component: lazy(() => import('../pages/orders')),
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
    Component: lazy(() => import('../pages/products')),
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
    Component: lazy(() => import('../pages/users')),
  },
  {
    path: '/data-board',
    meta: {
      titleKey: 'nav.dataBoard',
      icon: 'eye',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    Component: lazy(() => import('../pages/data-board')),
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
    Component: lazy(() => import('../pages/profile')),
  },
  {
    path: '/form',
    meta: {
      titleKey: 'nav.createOrder',
      icon: 'plus',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.business',
    },
    Component: lazy(() => import('../pages/form')),
  },
  {
    path: '/order-detail',
    meta: { titleKey: 'nav.orderDetail', icon: 'calendar', hidden: true, parent: '/orders' },
    Component: lazy(() => import('../pages/order-detail')),
  },
  {
    path: '/result',
    meta: { titleKey: 'nav.result', icon: 'check', hidden: true, parent: '/form' },
    Component: lazy(() => import('../pages/result')),
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
    Component: lazy(() => import('../pages/roles')),
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
    Component: lazy(() => import('../pages/menus')),
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
    Component: lazy(() => import('../pages/dept')),
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
    Component: lazy(() => import('../pages/category')),
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
    Component: lazy(() => import('../pages/dict')),
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
    Component: lazy(() => import('../pages/logs')),
  },
  {
    path: '/settings',
    meta: {
      titleKey: 'nav.settings',
      icon: 'filter',
      iconColor: 'var(--oas-tint-violet)',
      group: 'nav.system',
    },
    Component: lazy(() => import('../pages/settings')),
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
    Component: lazy(() => import('../pages/product-edit')),
  },
  {
    path: '/forbidden',
    meta: {
      titleKey: 'nav.forbidden',
      icon: 'warning',
      iconColor: 'var(--oas-color-danger)',
      group: 'nav.demo',
    },
    Component: lazy(() => import('../pages/forbidden')),
  },
  {
    path: '/not-found',
    meta: {
      titleKey: 'nav.notFound',
      icon: 'search',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.demo',
    },
    Component: lazy(() => import('../pages/not-found')),
  },
  {
    path: '/500',
    meta: {
      titleKey: 'nav.serverError',
      icon: 'error',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.demo',
    },
    Component: lazy(() => import('../pages/server-error')),
  },
  {
    path: '/basic-form',
    meta: {
      titleKey: 'nav.basicForm',
      icon: 'form',
      iconColor: 'var(--oas-color-success)',
      group: 'nav.demo',
    },
    Component: lazy(() => import('../pages/basic-form')),
  },
  {
    path: '/advanced-form',
    meta: {
      titleKey: 'nav.advancedForm',
      icon: 'menu',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.demo',
    },
    Component: lazy(() => import('../pages/advanced-form')),
  },
  {
    path: '/login',
    meta: { titleKey: 'login.welcome', icon: 'lock', hidden: true },
    Component: lazy(() => import('../pages/login')),
  },
]

export function matchRoute(path: string): AppRoute | undefined {
  return appRoutes.find((r) => r.path === path)
}
