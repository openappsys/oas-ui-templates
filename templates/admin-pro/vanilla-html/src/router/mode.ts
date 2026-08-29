import { routes } from './routes'

// 路由模式：'hash'（默认，#/path）或 'history'（/path，需服务器 SPA 回退——wranger 静态站已配 not_found_handling）
// 配置选择哪种就全局用哪种（localStorage 可切，缺省 hash），两者不同时生效。
export type RouterMode = 'hash' | 'history'

const KEY = 'oas-admin.router-mode'

/** 部署 base（vite BASE_URL）：'/'（独立部署，当根）或 '/admin-pro/vanilla-html'（门户子路径，无尾斜杠） */
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

/** 从 history 的 pathname 剥离 base 前缀，得到路由路径（如 /admin-pro/vanilla-html/settings → /settings） */
function stripBase(p: string): string {
  if (BASE === '/') return p
  if (p === BASE) return '/'
  if (p.startsWith(`${BASE}/`)) return p.slice(BASE.length)
  return p
}

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

/** 归一化当前路径（不带 #）：hash 模式读 location.hash、history 模式读 pathname（剥 base）；空串回默认路由 */
export function currentPath(): string {
  const raw =
    routerMode() === 'history'
      ? stripBase(window.location.pathname)
      : window.location.hash.replace(/^#/, '')
  if (raw === '' || raw === '/') return routes[0].path
  return raw
}

/** 导航：hash 模式写 location.hash（触发 hashchange）、history 模式 pushState（带 base）+ 派发自定义路由事件 */
export function navigate(path: string): void {
  if (routerMode() === 'history') {
    const target = joinBase(path)
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target)
      window.dispatchEvent(new Event('oas:routechange'))
    }
  } else if (window.location.hash !== `#${path}`) {
    window.location.hash = path
  }
}

/** 生成链接 href：hash="#/path"、history="base/path" */
export function href(path: string): string {
  return routerMode() === 'history' ? joinBase(path) : `#${path}`
}

/** 监听路由变化：hash 模式 hashchange、history 模式 popstate + pushState 后的自定义事件 */
export function onRouteChange(cb: () => void): () => void {
  const evt = routerMode() === 'history' ? 'popstate' : 'hashchange'
  window.addEventListener(evt, cb)
  window.addEventListener('oas:routechange', cb)
  return () => {
    window.removeEventListener(evt, cb)
    window.removeEventListener('oas:routechange', cb)
  }
}

/** 切换模式后让全局生效：把当前路径换成新模式的 URL 形态并刷新 */
export function applyRouterMode(mode: RouterMode): void {
  const cur = routerMode()
  if (mode === cur) return
  // 用当前（旧）模式读路由路径；再设新模式并跳转到新 URL 形态（replace 会重新加载文档）
  const path = currentPath()
  setRouterMode(mode)
  window.location.replace(dstHref(path, mode))
}

function dstHref(path: string, mode: RouterMode): string {
  if (mode === 'history') return `${window.location.origin}${joinBase(path)}`
  // hash：pathname 停在 base 根，路由放 hash 段
  const basePath = BASE === '/' ? '/' : `${BASE}/`
  return `${window.location.origin}${basePath}#${path}`
}
