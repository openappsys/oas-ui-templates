export type UserRole = 'admin' | 'editor' | 'viewer'
export type UserStatus = 'active' | 'disabled'

export interface UserRow {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  created: string
}

function seed(): UserRow[] {
  const raw: Array<[string, string, UserRole, UserStatus, string]> = [
    ['张伟', 'zhangwei@example.com', 'admin', 'active', '2026-01-12'],
    ['王芳', 'wangfang@example.com', 'editor', 'active', '2026-02-03'],
    ['李娜', 'lina@example.com', 'viewer', 'active', '2026-02-21'],
    ['刘强', 'liuqiang@example.com', 'editor', 'disabled', '2026-03-05'],
    ['陈静', 'chenjing@example.com', 'viewer', 'active', '2026-03-18'],
    ['杨洋', 'yangyang@example.com', 'editor', 'active', '2026-04-02'],
    ['赵敏', 'zhaomin@example.com', 'viewer', 'active', '2026-04-27'],
    ['孙磊', 'sunlei@example.com', 'viewer', 'disabled', '2026-05-15'],
  ]
  return raw.map(([name, email, role, status, created], i) => ({
    id: i + 1,
    name,
    email,
    role,
    status,
    created,
  }))
}

const rows: UserRow[] = seed()
let seq = rows.length

function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function listUsers(): Promise<UserRow[]> {
  return delay([...rows])
}

export function createUser(data: Omit<UserRow, 'id' | 'created'>): Promise<UserRow> {
  const row: UserRow = {
    ...data,
    id: ++seq,
    created: new Date().toISOString().slice(0, 10),
  }
  rows.unshift(row)
  return delay(row)
}

export function updateUser(
  id: number,
  data: Partial<Omit<UserRow, 'id'>>,
): Promise<UserRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  return delay(rows[i])
}

export function removeUser(id: number): Promise<boolean> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  return delay(true)
}

export function resetUsers(): void {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
}
