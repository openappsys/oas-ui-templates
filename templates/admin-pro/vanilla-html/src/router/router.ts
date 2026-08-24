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

function clearDispose(): void {
  dispose?.()
  dispose = undefined
}

function renderNotice(el: HTMLElement, code: string, text: string): void {
  el.innerHTML = `<div class="page notice"><h1>${code}</h1><p>${text}</p><oas-button type="primary" data-action="home">返回首页</oas-button></div>`
  el.querySelector('[data-action="home"]')?.addEventListener('click', () => {
    location.hash = routes[0].path
  })
}

export function initRouter(el: HTMLElement): void {
  view = el
  window.addEventListener('hashchange', resolve)
  void resolve()
}

export async function resolve(): Promise<void> {
  if (!view) return
  const path = parseHash(location.hash)
  const g = guard(path)
  clearDispose()
  view.innerHTML = ''
  if (!g.ok) {
    if (g.reason === 'login') {
      dispose = (await import('../pages/login')).render(view)
    } else if (g.reason === 'not-found') {
      renderNotice(view, '404', '页面不存在')
    } else {
      renderNotice(view, '403', '无权访问该页面')
    }
    return
  }
  const route = matchRoute(path)!
  const mod: PageModule = await route.load()
  clearDispose()
  view.innerHTML = ''
  document.title = `${route.meta.title} · OAS Admin`
  dispose = mod.render(view)
}
