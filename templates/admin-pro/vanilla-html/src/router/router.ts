import { hasAccess, session } from '../store/session'
import { matchRoute, routes } from './routes'
import { currentPath, navigate, onRouteChange } from './mode'
import type { PageModule } from './routes'
import { t } from '../i18n'
import { progress } from '../components/progress'
import { reportError } from '../error'

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

function playViewEnter(wasEmpty: boolean): void {
  if (!view || wasEmpty) return
  view.classList.remove('page-enter')
  void view.offsetWidth
  view.classList.add('page-enter')
}

function clearDispose(): void {
  dispose?.()
  dispose = undefined
}

function runResolve(): void {
  resolve().catch((err) => {
    progress.done()
    reportError(err, 'router-load', { hash: location.hash })
    if (!view) return
    if (view.innerHTML === '') location.hash = '/500'
    else renderPageError(view)
  })
}

function renderPageError(el: HTMLElement): void {
  el.innerHTML = `<div class="page notice">
    <div class="notice-code">500</div>
    <h1 class="notice-title">${t('common.500.title')}</h1>
    <p class="notice-desc">${t('common.500.desc')}</p>
    <oas-button type="primary" data-action="retry">${t('common.retry')}</oas-button>
  </div>`
  el.querySelector('[data-action="retry"]')?.addEventListener('click', () => runResolve())
}

export function initRouter(el: HTMLElement): void {
  view = el
  el.addEventListener('animationend', (e) => {
    if (e.target === el) el.classList.remove('page-enter')
  })
  onRouteChange(runResolve)
  runResolve()
}

export async function resolve(): Promise<void> {
  if (!view) return
  progress.start()
  const token = ++epoch
  const path = currentPath()
  const g = guard(path)
  clearDispose()
  const wasEmpty = view.innerHTML === ''
  view.innerHTML = ''
  if (!g.ok) {
    if (g.reason === 'login') {
      const mod = await import('../pages/login')
      if (token !== epoch) return
      dispose = mod.render(view)
      playViewEnter(wasEmpty)
      progress.done()
      return
    } else if (g.reason === 'not-found') {
      if (currentPath() !== '/not-found') navigate('/not-found')
      else progress.done()
      return
    } else {
      if (currentPath() !== '/forbidden') navigate('/forbidden')
      else progress.done()
      return
    }
  }
  const route = matchRoute(path)!
  const mod: PageModule = await route.load()
  if (token !== epoch) return
  dispose = mod.render(view)
  playViewEnter(wasEmpty)
  document.title = `${t(route.meta.titleKey)} · ${t('app.fullname')}`
  progress.done()
}
