import { hasAccess, session } from '../store/session'
import { matchRoute, routes } from './routes'
import type { PageModule } from './routes'

export type GuardResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'login' | 'forbidden' | 'not-found' }

export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, '')
  return path === '' ? routes[0].path : path
}

export { matchRoute }

export function guard(path: string): GuardResult {
  if (!session.user) return { ok: false, reason: 'login' }
  const route = matchRoute(path)
  if (!route) return { ok: false, reason: 'not-found' }
  if (!hasAccess(session.user, route.meta.roles)) return { ok: false, reason: 'forbidden' }
  return { ok: true, path }
}

let view: HTMLElement | null = null
let dispose: (() => void) | undefined
let epoch = 0

function clearDispose(): void {
  dispose?.()
  dispose = undefined
}

const NOTICE_DESC: Record<string, string> = {
  '404': '你访问的页面不存在或已被移除。',
  '403': '当前账号没有权限访问该页面。',
  '500': '页面加载出现异常，请稍后重试。',
}

function renderNotice(el: HTMLElement, code: string, text: string): void {
  const title = `${code} ${text}`
  const desc = NOTICE_DESC[code] ?? ''
  el.innerHTML = `<div class="page notice"><div class="notice-code">${code}</div><h1 class="notice-title">${title}</h1><p class="notice-desc">${desc}</p><oas-button type="primary" data-action="home">返回首页</oas-button></div>`
  el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
    location.hash = routes[0].path
  })
}

function runResolve(): void {
  resolve().catch(() => {
    if (view && view.innerHTML === '') renderNotice(view, '500', '页面加载失败')
  })
}

export function initRouter(el: HTMLElement): void {
  view = el
  window.addEventListener('hashchange', runResolve)
  runResolve()
}

export async function resolve(): Promise<void> {
  if (!view) return
  const token = ++epoch
  const path = parseHash(location.hash)
  const g = guard(path)
  clearDispose()
  view.innerHTML = ''
  if (!g.ok) {
    if (g.reason === 'login') {
      const mod = await import('../pages/login')
      if (token !== epoch) return
      dispose = mod.render(view)
    } else if (g.reason === 'not-found') {
      renderNotice(view, '404', '页面不存在')
    } else {
      renderNotice(view, '403', '无权访问该页面')
    }
    return
  }
  const route = matchRoute(path)!
  const mod: PageModule = await route.load()
  if (token !== epoch) return
  dispose = mod.render(view)
  document.title = `${route.meta.title} · OAS Admin`
}
