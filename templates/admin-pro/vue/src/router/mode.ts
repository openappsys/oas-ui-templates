// src/router/mode.ts —— 路由模式：'hash'（默认，#/path）或 'history'（/path，需服务器 SPA 回退）
// 本模版用 vue-router，本模块保留「读/写模式 + 链接 href 生成 + 切换后整页刷新」，
// 由 router/index.ts 在创建时按存储值二选一 createWebHashHistory/createWebHistory。
// 另：react 版 nav-items.routeHref 固定 hash 是双模式落地前的遗留，本模版 routeHref 即按模式
export type RouterMode = 'hash' | 'history'

const KEY = 'oas-admin.router-mode'

/** 部署 base（vite BASE_URL）：'/'（独立部署，当根）或子路径（无尾斜杠）；'./' 归一为 '/' */
const BASE = resolveBase()

function resolveBase(): string {
  const b = (import.meta.env.BASE_URL as string | undefined) ?? '/'
  if (b && b !== '.' && b !== './' && b.startsWith('/')) return b.replace(/\/$/, '') || '/'
  return '/'
}

/** history 模式把路由路径拼成绝对 URL 路径（带 base）；path 以 / 开头 */
function joinBase(path: string): string {
  if (BASE === '/') return path === '' ? '/' : path
  return path === '' ? BASE : `${BASE}${path}`
}

/** vue-router history 实例的 base（'/' 时传 undefined，等价默认） */
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

/** 生成链接 href：hash="#/path"、history="base/path"（对齐 vanilla mode.ts href()） */
export function routeHref(path: string): string {
  return routerMode() === 'history' ? joinBase(path) : `#${path}`
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
