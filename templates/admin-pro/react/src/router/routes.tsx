// src/router/routes.tsx —— 路由表事实来源
// path/meta 与 vanilla-html/src/router/routes.ts 中对应页面逐字对齐（本模版取 11 条）
// 例外：/login 在 vanilla 路由表中不存在（vanilla 未登录时由 router 直接渲染登录页），
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
    path: '/login',
    meta: { titleKey: 'login.welcome', icon: 'lock', hidden: true },
    Component: lazy(() => import('../pages/login')),
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
]

export function matchRoute(path: string): AppRoute | undefined {
  return appRoutes.find((r) => r.path === path)
}
