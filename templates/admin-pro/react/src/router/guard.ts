// src/router/guard.ts —— 守卫三态，语义对齐 vanilla router.ts 的 guard()
// 差异：vanilla 直接读模块级 session.user；本实现把 user 作为入参，便于 React 侧以订阅值驱动
import { hasAccess, type User } from '../store/session'
import { appRoutes } from './routes'

export type GuardResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'login' | 'forbidden' | 'not-found' }

export function guard(path: string, user: User | null): GuardResult {
  if (path !== '/login' && !user) return { ok: false, reason: 'login' }
  const route = appRoutes.find((r) => r.path === path)
  if (!route) return { ok: false, reason: 'not-found' }
  if (!hasAccess(user, route.meta.roles)) return { ok: false, reason: 'forbidden' }
  return { ok: true, path }
}
