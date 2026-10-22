/** API 模式会话：token 存储 + 401/403 反馈通道。
 *  token 是 mock 服务端签发的不透明串（`mock-` 前缀），客户端只负责存取与失效清理。 */

export const TOKEN_KEY = 'oas-pm-token'

/** 会话失效（401）：App 收到后回到登录页 */
export const SESSION_EXPIRED_EVENT = 'oas-pm-session-expired'
/** 请求被拒（403 等业务错误）：App 显示提示条 */
export const API_ERROR_EVENT = 'oas-pm-api-error'

export interface SessionEvents {
  /** token 已被清掉，需要重新登录 */
  expired(): void
  /** 已登录但无权限（或端点报错）：提示用户 */
  forbidden(message: string): void
}

function storage(): Storage | null {
  // 非浏览器（单测/SSR）直接用内存态：Node 的 localStorage 全局取值会告警
  if (typeof window === 'undefined') return null
  try {
    return localStorage
  } catch {
    // 隐私模式/禁用存储：会话降级为内存态（本标签页内仍可用）
    return null
  }
}

let memoryToken: string | null = null

export function getToken(): string | null {
  const store = storage()
  return store ? store.getItem(TOKEN_KEY) : memoryToken
}

export function setToken(token: string): void {
  memoryToken = token
  storage()?.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  memoryToken = null
  storage()?.removeItem(TOKEN_KEY)
}

function dispatch(name: string, detail?: unknown): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

/** 默认反馈通道：派发 window 事件（App 订阅）；测试注入自己的实现 */
export const sessionEvents: SessionEvents = {
  expired: () => dispatch(SESSION_EXPIRED_EVENT),
  forbidden: (message) => dispatch(API_ERROR_EVENT, { status: 403, message }),
}

export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = () => handler()
  window.addEventListener(SESSION_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
}

export function onApiError(handler: (status: number, message: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ status?: number; message?: string }>).detail
    handler(detail?.status ?? 0, detail?.message ?? '')
  }
  window.addEventListener(API_ERROR_EVENT, listener)
  return () => window.removeEventListener(API_ERROR_EVENT, listener)
}
