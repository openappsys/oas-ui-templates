import { message } from '@oas-ui/ui/feedback/message'
import { createHttp, type Interceptor } from './request'
import { t } from '../i18n'

function tokenFromSession(): string {
  try {
    const raw = localStorage.getItem('oas-admin.session')
    return raw ? ((JSON.parse(raw) as { token?: string })?.token ?? '') : ''
  } catch {
    return ''
  }
}

const injectToken: Interceptor = {
  onRequest: (ctx) => {
    const token = tokenFromSession()
    if (token) ctx.headers.Authorization = `Bearer ${token}`
  },
}

const onError: Interceptor = {
  onError: (ctx) => {
    ctx.handled = false
    message.error(t('common.networkError'))
  },
}

export const http = createHttp({
  baseURL: '/api',
  timeout: 8000,
  interceptors: [injectToken, onError],
})

export function enableFakeFetch(): void {
  const original = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return url.startsWith('/api/') ? fakeRoute(url, init) : original(input, init)
  }) as typeof fetch
}

type Envelope = { code: number; data?: unknown; message?: string }

function fakeRoute(url: string, init?: RequestInit): Promise<Response> {
  const u = new URL(url, location.origin)
  const path = u.pathname
  const body = init?.body ? JSON.parse(String(init.body)) : undefined
  let data: unknown
  let status = 200
  if (path.startsWith('/api/auth/login')) {
    data = { token: 'demo-token', name: body?.name ?? 'Demo User', role: body?.role ?? 'admin' }
  } else if (path.startsWith('/api/auth/profile')) {
    data = { name: 'Demo User', role: 'admin' }
  } else if (path.startsWith('/api/orders')) {
    data = { list: [] }
  } else {
    status = 404
    data = { code: 404, message: 'Not Found' }
  }
  const envelope: Envelope = { code: status === 200 ? 0 : status, data }
  return Promise.resolve(
    new Response(JSON.stringify(envelope), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}
