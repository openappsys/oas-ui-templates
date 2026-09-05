// src/router/mode.ts —— 路由模式：'hash'（默认，#/path）或 'history'（/path，需服务器 SPA 回退）
// 移植自 vanilla-html/src/router/mode.ts，localStorage 键名逐字一致（oas-admin.router-mode）。
// 差异（因果链）：vanilla 是自研路由器，navigate/href/onRouteChange 都走本模块；
// 本模版用 react-router，本模块只保留「读/写模式 + 切换后整页刷新」，
// 由 router/index.tsx 在挂载时按存储值二选一 HashRouter/BrowserRouter。
export type RouterMode = 'hash' | 'history'

const KEY = 'oas-admin.router-mode'

/** 部署 base（vite BASE_URL）：'/'（独立部署，当根）或子路径（无尾斜杠）；'./' 归一为 '/' */
const BASE = resolveBase()

function resolveBase(): string {
  const b = (import.meta.env.BASE_URL as string | undefined) ?? '/'
  if (b && b !== '.' && b !== './' && b.startsWith('/')) return b.replace(/\/$/, '') || '/'
  return '/'
}

/** BrowserRouter 的 basename（'/' 时传 undefined，等价默认） */
export const ROUTER_BASENAME: string | undefined = BASE === '/' ? undefined : BASE

export function routerMode(): RouterMode {
  try {
    return localStorage.getItem(KEY) === 'history' ? 'history' : 'hash'
  } catch {
    return 'hash'
  }
}

export function setRouterMode(mode: RouterMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* 忽略 */
  }
}

/** 当前路由路径（不带 base/# 前缀）：hash 模式读 location.hash，history 模式读 pathname 剥 base */
export function currentPath(): string {
  if (routerMode() === 'history') {
    const p = window.location.pathname
    if (BASE !== '/' && (p === BASE || p.startsWith(`${BASE}/`))) return p.slice(BASE.length) || '/'
    return p
  }
  return window.location.hash.replace(/^#/, '') || '/'
}

/** 切换模式后让全局生效：把当前路径换成新模式的 URL 形态并整页刷新（replace 重新加载文档） */
export function applyRouterMode(mode: RouterMode): void {
  if (mode === routerMode()) return
  const path = currentPath()
  setRouterMode(mode)
  window.location.replace(dstHref(path, mode))
}

function dstHref(path: string, mode: RouterMode): string {
  if (mode === 'history') {
    const basePath = BASE === '/' ? '' : BASE
    return `${window.location.origin}${basePath}${path}`
  }
  // hash：pathname 停在 base 根，路由放 hash 段
  const basePath = BASE === '/' ? '/' : `${BASE}/`
  return `${window.location.origin}${basePath}#${path}`
}
