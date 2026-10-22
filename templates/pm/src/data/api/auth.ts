import type { Member } from '@/types'
import { ApiError, errorMessage } from './errors'
import { clearToken, getToken, setToken } from './session'

/** 登录应答：token 由服务端签发，member 是当前身份（角色用于前端 can() 门禁） */
export interface LoginResult {
  token: string
  member: Member
}

/** 服务端认证请求的超时上限：网络挂起时登录按钮不能永远转圈 */
const AUTH_TIMEOUT_MS = 10_000

interface AuthResponse {
  status: number
  body: unknown
}

async function authRequest(
  method: string,
  path: string,
  body?: unknown,
  tokenOverride?: string | null,
): Promise<AuthResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
  const headers: Record<string, string> = {}
  const token = tokenOverride === undefined ? getToken() : tokenOverride
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  try {
    const res = await fetch(path, {
      method,
      headers,
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    // 204/空体 → null；错误体是 { error }
    return { status: res.status, body: await res.json().catch(() => null) }
  } catch (e) {
    // status 0 = 请求未到达服务端（断网/服务未启动/超时）
    throw new ApiError(0, (e as Error)?.message ?? 'network error')
  } finally {
    clearTimeout(timer)
  }
}

function failFrom(res: AuthResponse, fallback: string): never {
  throw new ApiError(res.status, errorMessage(res.body) ?? fallback)
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await authRequest('POST', '/api/auth/login', { email, password })
  if (res.status >= 400) failFrom(res, `login failed: ${res.status}`)
  const result = res.body as LoginResult
  setToken(result.token)
  return result
}

/** 启动校验：token 有效则返回成员；401 时清掉本地 token（会话已死） */
export async function fetchMe(): Promise<Member> {
  const res = await authRequest('GET', '/api/auth/me')
  if (res.status === 401) clearToken()
  if (res.status >= 400) failFrom(res, `session check failed: ${res.status}`)
  return (res.body as { member: Member }).member
}

/** 登出：本地 token 先失效（UI 立刻算未登录），再用旧 token 尽力让服务端作废它 */
export async function logout(): Promise<void> {
  const token = getToken()
  clearToken()
  if (!token) return
  try {
    await authRequest('POST', '/api/auth/logout', undefined, token)
  } catch (e) {
    console.error('[logout]', e)
  }
}
