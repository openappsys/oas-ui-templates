/**
 * 商品数据模块（自 vanilla src/data/products.ts 去 TS 移植，逻辑与种子数据逐字保留）
 * localStorage 键名前缀按 cdn 既有约定改为 oas-admin-cdn.*
 */
import { persist, restore } from './store.js'

/** @typedef {string} ProductCategory */
/** @typedef {'on' | 'off'} ProductStatus */
/** @typedef {'ok' | 'low' | 'critical'} StockLevel */

/**
 * 按库存数判定库存水位
 * @param {number} stock
 * @returns {StockLevel}
 */
export function stockLevel(stock) {
  if (stock < 5) return 'critical'
  if (stock <= 20) return 'low'
  return 'ok'
}

/**
 * @typedef {Object} ProductRow
 * @property {number} id
 * @property {string} name
 * @property {ProductCategory} category
 * @property {number} price
 * @property {number} stock
 * @property {ProductStatus} status
 * @property {string} created
 * @property {number} [sold]
 */

function seed() {
  const raw = [
    ['无线降噪耳机', '数码', 899, 36, 'on', '2026-06-12', 120],
    ['智能手表', '数码', 1299, 8, 'on', '2026-06-28', 88],
    ['北欧原木餐桌', '家居', 2680, 4, 'on', '2026-07-03', 62],
    ['法式亚麻连衣裙', '服饰', 459, 62, 'off', '2026-07-15', 55],
    ['有机燕麦片', '食品', 59, 120, 'on', '2026-07-21', 76],
    ['山茶花护手霜', '家居', 78, 3, 'off', '2026-08-02', 45],
    ['商务双肩包', '服饰', 399, 42, 'on', '2026-08-09', 96],
    ['冷萃咖啡液', '食品', 129, 15, 'on', '2026-08-18', 112],
  ]
  return raw.map(([name, category, price, stock, status, created, sold], i) => ({
    id: i + 1,
    name,
    category,
    price,
    stock,
    status,
    created,
    sold,
  }))
}

const KEY = 'oas-admin-cdn.products.v1'
const rows = /** @type {ProductRow[]} */ (restore(KEY, seed))
let seq = rows.length

/** @param {*} value @param {number} [ms] */
function delay(value, ms = 100) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/** @returns {Promise<ProductRow[]>} */
export function listProducts() {
  return delay([...rows])
}

/** @param {number} id @returns {Promise<ProductRow | null>} */
export function getProduct(id) {
  return delay(rows.find((r) => r.id === id) ?? null)
}

/**
 * @param {Omit<ProductRow, 'id' | 'created'>} data
 * @returns {Promise<ProductRow>}
 */
export function createProduct(data) {
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
 * @param {Partial<Omit<ProductRow, 'id'>>} data
 * @returns {Promise<ProductRow | null>}
 */
export function updateProduct(id, data) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  persist(KEY, rows)
  return delay(rows[i])
}

/** @param {number} id @returns {Promise<ProductRow | null>} */
export function toggleProductStatus(id) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], status: rows[i].status === 'on' ? 'off' : 'on' }
  persist(KEY, rows)
  return delay(rows[i])
}

/** @param {number} id @returns {Promise<boolean>} */
export function removeProduct(id) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  persist(KEY, rows)
  return delay(true)
}

export function resetProducts() {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
  localStorage.removeItem(KEY)
}
