// src/router/routes.tsx —— 路由表事实来源
// 本模版为 HashRouter 组装需要补入，meta 为本模版新增（titleKey 取 i18n 已存在的 login.welcome）。
// 页面全部走 React.lazy 路由级代码分割（对齐 vue 版 () => import()）：每页独立 chunk，
// 首屏只加载当前路由；Suspense 已由 app-shell 的 <Suspense><Outlet/></Suspense> 承接。
// LoginPage 在 index.tsx 未登录分支另有静态 import（登录首屏不等待 chunk），表内条目仅为表完整性。
import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

const AdvancedFormPage = lazy(() => import('../pages/advanced-form'))
const BasicFormPage = lazy(() => import('../pages/basic-form'))
const CategoryPage = lazy(() => import('../pages/category'))
const DashboardPage = lazy(() => import('../pages/dashboard'))
const DataBoardPage = lazy(() => import('../pages/data-board'))
const DeptPage = lazy(() => import('../pages/dept'))
const DictPage = lazy(() => import('../pages/dict'))
const ForbiddenPage = lazy(() => import('../pages/forbidden'))
const FormPage = lazy(() => import('../pages/form'))
const LoginPage = lazy(() => import('../pages/login'))
const LogsPage = lazy(() => import('../pages/logs'))
const MenusPage = lazy(() => import('../pages/menus'))
const NotFoundPage = lazy(() => import('../pages/not-found'))
const OrderDetailPage = lazy(() => import('../pages/order-detail'))
const OrdersPage = lazy(() => import('../pages/orders'))
const ProductEditPage = lazy(() => import('../pages/product-edit'))
const ProductsPage = lazy(() => import('../pages/products'))
const ProfilePage = lazy(() => import('../pages/profile'))
const ResultPage = lazy(() => import('../pages/result'))
const RolesPage = lazy(() => import('../pages/roles'))
const ServerErrorPage = lazy(() => import('../pages/server-error'))
const SettingsPage = lazy(() => import('../pages/settings'))
const UsersPage = lazy(() => import('../pages/users'))

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
  Component: ComponentType | LazyExoticComponent<ComponentType>
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
    Component: DashboardPage,
  },
  {
    path: '/orders',
    meta: {
      titleKey: 'nav.orders',
      icon: 'calendar',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.business',
    },
    Component: OrdersPage,
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
    Component: ProductsPage,
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
    Component: UsersPage,
  },
  {
    path: '/data-board',
    meta: {
      titleKey: 'nav.dataBoard',
      icon: 'eye',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.output',
    },
    Component: DataBoardPage,
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
    Component: ProfilePage,
  },
  {
    path: '/form',
    meta: {
      titleKey: 'nav.createOrder',
      icon: 'plus',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.business',
    },
    Component: FormPage,
  },
  {
    path: '/order-detail',
    meta: { titleKey: 'nav.orderDetail', icon: 'calendar', hidden: true, parent: '/orders' },
    Component: OrderDetailPage,
  },
  {
    path: '/result',
    meta: { titleKey: 'nav.result', icon: 'check', hidden: true, parent: '/form' },
    Component: ResultPage,
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
    Component: RolesPage,
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
    Component: MenusPage,
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
    Component: DeptPage,
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
    Component: CategoryPage,
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
    Component: DictPage,
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
    Component: LogsPage,
  },
  {
    path: '/settings',
    meta: {
      titleKey: 'nav.settings',
      icon: 'filter',
      iconColor: 'var(--oas-tint-violet)',
      group: 'nav.system',
    },
    Component: SettingsPage,
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
    Component: ProductEditPage,
  },
  {
    path: '/forbidden',
    meta: {
      titleKey: 'nav.forbidden',
      icon: 'warning',
      iconColor: 'var(--oas-color-danger)',
      group: 'nav.demo',
    },
    Component: ForbiddenPage,
  },
  {
    path: '/not-found',
    meta: {
      titleKey: 'nav.notFound',
      icon: 'search',
      iconColor: 'var(--oas-color-primary)',
      group: 'nav.demo',
    },
    Component: NotFoundPage,
  },
  {
    path: '/500',
    meta: {
      titleKey: 'nav.serverError',
      icon: 'error',
      iconColor: 'var(--oas-color-warning)',
      group: 'nav.demo',
    },
    Component: ServerErrorPage,
  },
  {
    path: '/basic-form',
    meta: {
      titleKey: 'nav.basicForm',
      icon: 'form',
      iconColor: 'var(--oas-color-success)',
      group: 'nav.demo',
    },
    Component: BasicFormPage,
  },
  {
    path: '/advanced-form',
    meta: {
      titleKey: 'nav.advancedForm',
      icon: 'menu',
      iconColor: 'var(--oas-tint-cyan)',
      group: 'nav.demo',
    },
    Component: AdvancedFormPage,
  },
  {
    path: '/login',
    meta: { titleKey: 'login.welcome', icon: 'lock', hidden: true },
    Component: LoginPage,
  },
]

export function matchRoute(path: string): AppRoute | undefined {
  return appRoutes.find((r) => r.path === path)
}
