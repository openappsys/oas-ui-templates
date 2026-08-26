import { hasAccess, session } from '../store/session'
import { matchRoute, routes } from './routes'
import type { PageModule } from './routes'
import { t } from '../i18n'

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

function runResolve(): void {
  resolve().catch(() => {
    if (view && view.innerHTML === '') location.hash = '/500'
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
      return
    } else if (g.reason === 'not-found') {
      location.hash = '/not-found'
      return
    } else {
      location.hash = '/forbidden'
      return
    }
  }
  const route = matchRoute(path)!
  const mod: PageModule = await route.load()
  if (token !== epoch) return
  dispose = mod.render(view)
  document.title = `${t(route.meta.titleKey)} · ${t('app.fullname')}`
}
