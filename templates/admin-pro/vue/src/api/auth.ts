import { http } from './http'

export interface LoginApiResult {
  token: string
  name: string
  role: string
}

type Envelope<T> = { code: number; data: T; message?: string }

export async function login(username: string, password: string): Promise<LoginApiResult> {
  const res = await http.request<Envelope<LoginApiResult>>({
    url: '/auth/login',
    method: 'POST',
    body: { username, password },
  })
  if (res.code !== 0) throw new Error(res.message ?? 'Login failed')
  return res.data
}

export async function fetchProfile(): Promise<{ name: string; role: string }> {
  const res = await http.request<Envelope<{ name: string; role: string }>>({ url: '/auth/profile' })
  if (res.code !== 0) throw new Error(res.message ?? 'Fetch failed')
  return res.data
}

export async function fetchOrders(): Promise<unknown[]> {
  const res = await http.request<Envelope<unknown[]>>({ url: '/orders' })
  if (res.code !== 0) throw new Error(res.message ?? 'Fetch failed')
  return res.data
}
