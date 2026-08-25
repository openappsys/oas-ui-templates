export interface RouteMeta {
  title: string
  icon: string
  roles?: string[]
  hidden?: boolean
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
    meta: { title: '仪表盘', icon: 'star' },
    load: () => import('../pages/dashboard'),
  },
  {
    path: '/orders',
    meta: { title: '订单管理', icon: 'calendar' },
    load: () => import('../pages/orders'),
  },
  {
    path: '/products',
    meta: { title: '商品管理', icon: 'edit', roles: ['admin'] },
    load: () => import('../pages/products'),
  },
  {
    path: '/users',
    meta: { title: '用户管理', icon: 'user', roles: ['admin'] },
    load: () => import('../pages/users'),
  },
  {
    path: '/profile',
    meta: { title: '个人中心', icon: 'gear' },
    load: () => import('../pages/profile'),
  },
  {
    path: '/form',
    meta: { title: '创建订单', icon: 'plus' },
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
]

export function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path)
}
