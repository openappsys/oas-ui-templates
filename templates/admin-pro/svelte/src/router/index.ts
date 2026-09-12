// src/router/index.ts —— 自研双模式路由（Svelte store 封装，不引第三方路由库）
// 形态：hash 默认 / history 可选（localStorage oas-admin.router-mode，见 mode.ts，模块加载时一次性定型；
// 设置中心切换走 modal.confirm + 整页刷新 applyRouterMode，此处不再感知）。
// 守卫：guard() 纯函数三态结论换成重定向（replace 语义与 react loader / vue beforeEach 一致）：
//   未登录 → /login、路径不存在 → /not-found、无权限 → /forbidden；
//   / 归一到 /dashboard（对齐 react 版 index loader replace('/dashboard')）；
//   /login 本身永远放行（对齐 vue 版修法：guard 把「未登录访问 /login」判为 forbidden，
//   未登录走到 /forbidden 又弹回 /login 会死循环）。
// 登录态变化经 session.subscribe 触发重估：登出立即弹回 /login（对齐 react 版 SessionSync revalidate）。
// 布局壳接线：RouterView 按 currentPath 渲染页面组件；AppShell（Task 2）在 RouterView 内
// 对非 /login 路径包布局壳，此处只产出路由状态与导航 API。
import { derived, writable, type Readable } from 'svelte/store'
import { session } from '../store/session'
import { guard } from './guard'
import { currentPath as readLocationPath, routeHref, routerMode } from './mode'
import { matchRoute, type AppRoute } from './routes'

const MODE = routerMode()

/** 守卫求值：返回最终应停留的路径（含重定向结论） */
function evaluate(raw: string): string {
  const path = raw || '/'
  // /login 永远放行（理由见文件头注释）
  if (path === '/login') return path
  // 根路径归一到首页（仍需过守卫：未登录 '/' 与 react 版一致弹回 /login）
  const resolved = path === '/' ? '/dashboard' : path
  const result = guard(resolved, session.user)
  if (result.ok) return resolved
  if (result.reason === 'forbidden') return '/forbidden'
  if (result.reason === 'not-found') return '/not-found'
  return '/login'
}

/** 目标路径的浏览器 URL（hash 模式 '#/path'，history 模式带 base） */
function urlOf(path: string): string {
  return MODE === 'history' ? routeHref(path) : `#${path}`
}

const store = writable<string>('')

/** 从当前 location 重估路由状态；守卫重定向用 replaceState 写回（不留历史条目） */
function syncFromLocation(): void {
  const raw = readLocationPath()
  const path = evaluate(raw)
  if (path !== (raw || '/')) {
    history.replaceState(null, '', urlOf(path))
  }
  store.set(path)
}

/**
 * 编程式导航：先过守卫求值再写 URL（push 留历史条目）。
 * hash/history 两模式统一走 pushState + 手动 sync（pushState 不触发 hashchange/popstate）。
 */
export function navigate(path: string): void {
  const target = evaluate(path)
  history.pushState(null, '', urlOf(target))
  store.set(target)
}

/** 当前路由路径（守卫求值后的最终路径） */
export const currentPath: Readable<string> = { subscribe: store.subscribe }

/** 当前匹配的路由表条目（/login 也能匹配到，供壳层判定布局分支） */
export const currentRoute: Readable<AppRoute | undefined> = derived(store, ($path) =>
  matchRoute($path),
)

// 浏览器事件接线：前进/后退（popstate；hash 模式下 hash 变化还会补发 hashchange，sync 幂等）
// 与登录态变化（登出立即重估当前路径，未登录弹回 /login）
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', syncFromLocation)
  window.addEventListener('hashchange', syncFromLocation)
  session.subscribe(syncFromLocation)
  syncFromLocation()
}
