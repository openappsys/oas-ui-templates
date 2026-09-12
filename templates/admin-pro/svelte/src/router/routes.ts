// src/router/routes.ts —— 路由表事实来源（23 条 path/meta 与 react 版 routes.tsx 逐字对齐）
import type { Component } from 'svelte'

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
  /** 懒加载页面组件（() => import('../pages/xxx.svelte')） */
  Component: () => Promise<{ default: Component }>
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
    Component: () => import('../pages/dashboard.svelte'),
  },
  {
    path: '/orders',
    meta: {
      titleKey: 'nav.orders',
      icon: 'calendar',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.business',
    },
    Component: () => import('../pages/orders.svelte'),
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
    Component: () => import('../pages/products.svelte'),
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
    Component: () => import('../pages/users.svelte'),
  },
  {
    path: '/data-board',
    meta: {
      titleKey: 'nav.dataBoard',
      icon: 'eye',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    Component: () => import('../pages/data-board.svelte'),
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
    Component: () => import('../pages/profile.svelte'),
  },
  {
    path: '/form',
    meta: {
      titleKey: 'nav.createOrder',
      icon: 'plus',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.business',
    },
    Component: () => import('../pages/form.svelte'),
  },
  {
    path: '/order-detail',
    meta: { titleKey: 'nav.orderDetail', icon: 'calendar', hidden: true, parent: '/orders' },
    Component: () => import('../pages/order-detail.svelte'),
  },
  {
    path: '/result',
    meta: { titleKey: 'nav.result', icon: 'check', hidden: true, parent: '/form' },
    Component: () => import('../pages/result.svelte'),
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
    Component: () => import('../pages/roles.svelte'),
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
    Component: () => import('../pages/menus.svelte'),
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
    Component: () => import('../pages/dept.svelte'),
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
    Component: () => import('../pages/category.svelte'),
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
    Component: () => import('../pages/dict.svelte'),
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
    Component: () => import('../pages/logs.svelte'),
  },
  {
    path: '/settings',
    meta: {
      titleKey: 'nav.settings',
      icon: 'filter',
      iconColor: 'var(--oas-tint-violet)',
      group: 'nav.system',
    },
    Component: () => import('../pages/settings.svelte'),
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
    Component: () => import('../pages/product-edit.svelte'),
  },
  {
    path: '/forbidden',
    meta: {
      titleKey: 'nav.forbidden',
      icon: 'warning',
      iconColor: 'var(--oas-color-danger)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/forbidden.svelte'),
  },
  {
    path: '/not-found',
    meta: {
      titleKey: 'nav.notFound',
      icon: 'search',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/not-found.svelte'),
  },
  {
    path: '/500',
    meta: {
      titleKey: 'nav.serverError',
      icon: 'error',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/server-error.svelte'),
  },
  {
    path: '/basic-form',
    meta: {
      titleKey: 'nav.basicForm',
      icon: 'form',
      iconColor: 'var(--oas-color-success)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/basic-form.svelte'),
  },
  {
    path: '/advanced-form',
    meta: {
      titleKey: 'nav.advancedForm',
      icon: 'menu',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.demo',
    },
    Component: () => import('../pages/advanced-form.svelte'),
  },
  {
    path: '/login',
    meta: { titleKey: 'login.welcome', icon: 'lock', hidden: true },
    Component: () => import('../pages/login.svelte'),
  },
]

export function matchRoute(path: string): AppRoute | undefined {
  return appRoutes.find((r) => r.path === path)
}
