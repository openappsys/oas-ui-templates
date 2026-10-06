/**
 * 页签状态纯函数（自 vanilla src/router/tabs.ts 逐字移植，键为路由 path）
 * HOME_PATH 不可关闭；隐藏路由归并到 parent；错误页不入页签
 */
import { matchRoute, routes } from '../routes.js'

export const HOME_PATH = routes[0].path

const ERROR_PATHS = new Set(['/forbidden', '/not-found', '/500'])

function tabKeyOf(route, current) {
  if (!route) return current
  if (route.hidden) return route.parent ?? current
  if (ERROR_PATHS.has(route.path)) return current
  return route.path
}

function ensureHome(keys) {
  return keys.includes(HOME_PATH) ? keys : [HOME_PATH, ...keys]
}

export function visit(prev, path) {
  const route = matchRoute(path)
  const key = tabKeyOf(route, prev.active)
  const keys = ensureHome(prev.keys)
  if (key === null || key === prev.active) {
    return { keys, active: prev.active ?? HOME_PATH }
  }
  return { keys: keys.includes(key) ? keys : [...keys, key], active: key }
}

export function closeTab(prev, closed) {
  if (closed === HOME_PATH) return { view: prev, navigateTo: null }
  const idx = prev.keys.indexOf(closed)
  if (idx === -1) return { view: prev, navigateTo: null }
  const keys = prev.keys.filter((k) => k !== closed)
  if (prev.active !== closed) return { view: { keys, active: prev.active }, navigateTo: null }
  const next = prev.keys[idx + 1] ?? prev.keys[idx - 1] ?? HOME_PATH
  return { view: { keys, active: next }, navigateTo: next }
}

/** 批量关闭：HOME_PATH 保留（不可关），active 被关则导航到最靠近的存活项 */
export function closeKeys(prev, closed) {
  const set = new Set(closed.filter((k) => k !== HOME_PATH))
  if (set.size === 0) return { view: prev, navigateTo: null }
  const keys = prev.keys.filter((k) => !set.has(k))
  if (!set.has(prev.active ?? '')) return { view: { keys, active: prev.active }, navigateTo: null }
  const next = prev.keys.find((k) => k !== HOME_PATH && !set.has(k)) ?? HOME_PATH
  return { view: { keys, active: next }, navigateTo: next }
}
