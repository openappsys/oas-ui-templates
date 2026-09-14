/**
 * 用户数据模块（自 vanilla src/data/users.ts 去 TS 移植，逻辑与种子数据逐字保留）
 * localStorage 键名前缀按 cdn 既有约定改为 oas-admin-cdn.*
 */
import { persist, restore } from './store.js'

/** @typedef {'admin' | 'editor' | 'viewer'} UserRole */
/** @typedef {'active' | 'disabled'} UserStatus */
/**
 * @typedef {Object} UserRow
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {UserRole} role
 * @property {number | null} roleId
 * @property {UserStatus} status
 * @property {string} created
 */

function seed() {
  const raw = [
    ['张伟', 'zhangwei@example.com', 'admin', 'active', 1, '2026-01-12'],
    ['王芳', 'wangfang@example.com', 'editor', 'active', 2, '2026-02-03'],
    ['李娜', 'lina@example.com', 'viewer', 'active', 4, '2026-02-21'],
    ['刘强', 'liuqiang@example.com', 'editor', 'disabled', 3, '2026-03-05'],
    ['陈静', 'chenjing@example.com', 'viewer', 'active', 4, '2026-03-18'],
    ['杨洋', 'yangyang@example.com', 'editor', 'active', 2, '2026-04-02'],
    ['赵敏', 'zhaomin@example.com', 'viewer', 'active', 4, '2026-04-27'],
    ['孙磊', 'sunlei@example.com', 'viewer', 'disabled', 4, '2026-05-15'],
  ]
  return raw.map(([name, email, role, status, roleId, created], i) => ({
    id: i + 1,
    name,
    email,
    role,
    roleId,
    status,
    created,
  }))
}

const KEY = 'oas-admin-cdn.users.v1'
const rows = /** @type {UserRow[]} */ (restore(KEY, seed))
let seq = rows.length

/** @param {*} value @param {number} [ms] */
function delay(value, ms = 100) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/** @returns {Promise<UserRow[]>} */
export function listUsers() {
  return delay([...rows])
}

/**
 * @param {Omit<UserRow, 'id' | 'created'>} data
 * @returns {Promise<UserRow>}
 */
export function createUser(data) {
  const row = {
    ...data,
    id: ++seq,
    created: new Date().toISOString().slice(0, 10),
  }
  rows.unshift(row)
  persist(KEY, rows)
  return delay(row)
}

/**
 * @param {number} id
 * @param {Partial<Omit<UserRow, 'id'>>} data
 * @returns {Promise<UserRow | null>}
 */
export function updateUser(id, data) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  persist(KEY, rows)
  return delay(rows[i])
}

/** @param {number} id @returns {Promise<boolean>} */
export function removeUser(id) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  persist(KEY, rows)
  return delay(true)
}

export function resetUsers() {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
  localStorage.removeItem(KEY)
}
