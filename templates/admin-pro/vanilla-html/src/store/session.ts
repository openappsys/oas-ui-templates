export type Role = 'admin' | 'viewer'

export interface User {
  name: string
  role: Role
}

const KEY = 'oas-admin.session'
const TIME_KEY = 'oas-admin.session.loginAt'
const subs = new Set<() => void>()

function restore(): User | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as User | null
  } catch {
    return null
  }
}

function restoreTime(): number | null {
  const raw = localStorage.getItem(TIME_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

let user: User | null = restore()
let loginAt: number | null = restoreTime()

function emit() {
  for (const fn of subs) fn()
}

export const session = {
  get user(): User | null {
    return user
  },
  get loginAt(): number | null {
    return loginAt
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  login(name: string, role: Role): void {
    user = { name, role }
    loginAt = Date.now()
    localStorage.setItem(KEY, JSON.stringify(user))
    localStorage.setItem(TIME_KEY, String(loginAt))
    emit()
  },
  logout(): void {
    user = null
    loginAt = null
    localStorage.removeItem(KEY)
    localStorage.removeItem(TIME_KEY)
    emit()
  },
}

export function hasAccess(user: User | null, roles?: string[]): boolean {
  if (!user) return false
  if (!roles || roles.length === 0) return true
  return roles.includes(user.role)
}
