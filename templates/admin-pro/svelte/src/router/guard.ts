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
