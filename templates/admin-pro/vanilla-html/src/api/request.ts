export interface HttpConfig {
  baseURL?: string
  timeout?: number
  interceptors?: Interceptor[]
}

export interface Interceptor {
  onRequest?: (ctx: Ctx) => void
  onResponse?: (ctx: Ctx) => void
  onError?: (ctx: Ctx) => void
}

interface Ctx {
  url: string
  method: string
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  headers: Record<string, string>
  signal?: AbortSignal
  response?: Response
  handled?: boolean
}

export interface RequestOptions {
  url: string
  method?: string
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

function buildUrl(baseURL: string, url: string, params?: RequestOptions['params']): string {
  let u = url.startsWith('http') ? url : baseURL + url
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) u += (u.includes('?') ? '&' : '?') + qs
  }
  return u
}

export function createHttp(config: HttpConfig = {}) {
  const { baseURL = '', timeout = 8000, interceptors = [] } = config
  return {
    async request<T = unknown>(opts: RequestOptions): Promise<T> {
      const ctx: Ctx = {
        url: buildUrl(baseURL, opts.url, opts.params),
        method: opts.method ?? 'GET',
        body: opts.body,
        params: opts.params,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        signal: opts.signal,
      }
      for (const i of interceptors) i.onRequest?.(ctx)
      const controller = new AbortController()
      const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : undefined
      const merged = ctx.signal ? AbortSignal.any([ctx.signal, controller.signal]) : controller.signal
      const fetchImpl = opts.fetchImpl ?? fetch
      try {
        const res = await fetchImpl(ctx.url, {
          method: ctx.method,
          headers: ctx.headers,
          body: ctx.body === undefined ? undefined : JSON.stringify(ctx.body),
          signal: merged,
        })
        ctx.response = res
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        for (const i of interceptors) i.onResponse?.(ctx)
        return (await res.json()) as T
      } catch (err) {
        ctx.handled = false
        for (const i of interceptors) i.onError?.(ctx)
        if (!ctx.handled) throw err
        throw err
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
    },
  }
}

export const http = createHttp()
