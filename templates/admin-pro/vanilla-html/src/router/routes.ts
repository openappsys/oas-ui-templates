export interface RouteMeta {
  title: string
  icon: string
  roles?: string[]
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
    path: '/users',
    meta: { title: '用户管理', icon: 'user', roles: ['admin'] },
    load: () => import('../pages/users'),
  },
  {
    path: '/profile',
    meta: { title: '个人中心', icon: 'gear' },
    load: () => import('../pages/profile'),
  },
]

export function matchRoute(path: string): Route | undefined {
  return routes.find((r) => r.path === path)
}
