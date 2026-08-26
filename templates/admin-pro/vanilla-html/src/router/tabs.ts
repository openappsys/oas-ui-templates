import { matchRoute, routes } from './routes'
import type { Route } from './routes'

export const HOME_PATH = routes[0].path

const ERROR_PATHS = new Set(['/forbidden', '/not-found', '/500'])

export interface TabsView {
  keys: string[]
  active: string | null
}

export interface TabsCloseResult {
  view: TabsView
  navigateTo: string | null
}

export function tabKeyOf(route: Route | undefined, current: string | null): string | null {
  if (!route) return current
  if (route.meta.hidden) return route.meta.parent ?? current
  if (ERROR_PATHS.has(route.path)) return current
  return route.path
}

function ensureHome(keys: string[]): string[] {
  return keys.includes(HOME_PATH) ? keys : [HOME_PATH, ...keys]
}

export function visit(prev: TabsView, path: string): TabsView {
  const route = matchRoute(path)
  const key = tabKeyOf(route, prev.active)
  const keys = ensureHome(prev.keys)
  if (key === null || key === prev.active) {
    return { keys, active: prev.active ?? HOME_PATH }
  }
  return { keys: keys.includes(key) ? keys : [...keys, key], active: key }
}

export function closeTab(prev: TabsView, closed: string): TabsCloseResult {
  if (closed === HOME_PATH) return { view: prev, navigateTo: null }
  const idx = prev.keys.indexOf(closed)
  if (idx === -1) return { view: prev, navigateTo: null }
  const keys = prev.keys.filter((k) => k !== closed)
  if (prev.active !== closed) return { view: { keys, active: prev.active }, navigateTo: null }
  const next = prev.keys[idx + 1] ?? prev.keys[idx - 1] ?? HOME_PATH
  return { view: { keys, active: next }, navigateTo: next }
}

/** 批量关闭：keys 保留 HOME_PATH（不可关），active 被关则导航到最靠近的存活项 */
export function closeKeys(prev: TabsView, closed: string[]): TabsCloseResult {
  const set = new Set(closed.filter((k) => k !== HOME_PATH))
  if (set.size === 0) return { view: prev, navigateTo: null }
  const keys = prev.keys.filter((k) => !set.has(k))
  if (!set.has(prev.active ?? '')) return { view: { keys, active: prev.active }, navigateTo: null }
  const next = prev.keys.find((k) => k !== HOME_PATH && !set.has(k)) ?? HOME_PATH
  return { view: { keys, active: next }, navigateTo: next }
}

export function closeAll(prev: TabsView): TabsCloseResult {
  const navigateTo = prev.active === HOME_PATH ? null : HOME_PATH
  return { view: { keys: [HOME_PATH], active: HOME_PATH }, navigateTo }
}
