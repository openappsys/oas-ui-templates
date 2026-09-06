// src/router/routes.ts —— 路由表事实来源
// path/meta 与 vanilla-html/src/router/routes.ts 对应条目逐字对齐（react 版同期并行，
// 未落地的页面以 vanilla 为准）；/login 为本模版组装新增（见下方原注释）
// 例外：/login 在 vanilla 路由表中不存在（vanilla 未登录时由 router 直接渲染登录页），
// 本模版为 hash 路由组装需要补入，meta 为本模版新增（titleKey 取 i18n 已存在的 login.welcome）
import type { RouteComponent } from 'vue-router'

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
  /** 懒加载页面组件（() => import('../pages/xxx.vue')） */
  Component: () => Promise<RouteComponent>
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
    Component: () => import('../pages/dashboard.vue'),
  },
  {
    path: '/orders',
    meta: {
      titleKey: 'nav.orders',
      icon: 'calendar',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.business',
    },
    Component: () => import('../pages/orders.vue'),
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
    Component: () => import('../pages/products.vue'),
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
    Component: () => import('../pages/users.vue'),
  },
  {
    path: '/data-board',
    meta: {
      titleKey: 'nav.dataBoard',
      icon: 'eye',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    Component: () => import('../pages/data-board.vue'),
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
    Component: () => import('../pages/profile.vue'),
  },
  {
    path: '/form',
    meta: {
      titleKey: 'nav.createOrder',
      icon: 'plus',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.business',
    },
    Component: () => import('../pages/form.vue'),
  },
  {
    path: '/order-detail',
    meta: { titleKey: 'nav.orderDetail', icon: 'calendar', hidden: true, parent: '/orders' },
    Component: () => import('../pages/order-detail.vue'),
  },
  {
    path: '/result',
    meta: { titleKey: 'nav.result', icon: 'check', hidden: true, parent: '/form' },
    Component: () => import('../pages/result.vue'),
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
    Component: () => import('../pages/roles.vue'),
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
    Component: () => import('../pages/menus.vue'),
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
    Component: () => import('../pages/dept.vue'),
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
    Component: () => import('../pages/category.vue'),
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
    Component: () => import('../pages/dict.vue'),
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
    Component: () => import('../pages/logs.vue'),
  },
  {
    path: '/settings',
    meta: {
      titleKey: 'nav.settings',
      icon: 'filter',
      iconColor: 'var(--oas-tint-violet)',
      group: 'nav.system',
    },
    Component: () => import('../pages/settings.vue'),
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
    Component: () => import('../pages/product-edit.vue'),
  },
  {
    path: '/forbidden',
    meta: {
      titleKey: 'nav.forbidden',
      icon: 'warning',
      iconColor: 'var(--oas-color-danger)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/forbidden.vue'),
  },
  {
    path: '/not-found',
    meta: {
      titleKey: 'nav.notFound',
      icon: 'search',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/not-found.vue'),
  },
  {
    path: '/500',
    meta: {
      titleKey: 'nav.serverError',
      icon: 'error',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/server-error.vue'),
  },
  {
    path: '/basic-form',
    meta: {
      titleKey: 'nav.basicForm',
      icon: 'form',
      iconColor: 'var(--oas-color-success)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/basic-form.vue'),
  },
  {
    path: '/advanced-form',
    meta: {
      titleKey: 'nav.advancedForm',
      icon: 'menu',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/advanced-form.vue'),
  },
  {
    path: '/login',
    meta: { titleKey: 'login.welcome', icon: 'lock', hidden: true },
    Component: () => import('../pages/login.vue'),
  },
]

export function matchRoute(path: string): AppRoute | undefined {
  return appRoutes.find((r) => r.path === path)
}
