export type Role = 'admin' | 'viewer'

export interface User {
  name: string
  role: Role
}

const KEY = 'oas-admin.session'
const subs = new Set<() => void>()

function restore(): User | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as User | null
  } catch {
    return null
  }
}

let user: User | null = restore()

function emit() {
  for (const fn of subs) fn()
}

export const session = {
  get user(): User | null {
    return user
  },
  subscribe(fn: () => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  login(name: string, role: Role): void {
    user = { name, role }
    localStorage.setItem(KEY, JSON.stringify(user))
    emit()
  },
  logout(): void {
    user = null
    localStorage.removeItem(KEY)
    emit()
  },
}

export function hasAccess(user: User | null, roles?: string[]): boolean {
  if (!user) return false
  if (!roles || roles.length === 0) return true
  return roles.includes(user.role)
}
