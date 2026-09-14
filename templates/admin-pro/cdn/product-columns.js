/**
 * 商品表格列设置持久化（自 vanilla src/pages/product-columns.ts 去 TS 移植，逻辑逐字保留）
 * localStorage 键按 cdn 既有约定改为 oas-admin-cdn.products.columns
 */

export const PRODUCT_COLUMN_KEYS = ['name', 'category', 'price', 'stock', 'status', 'action']

export const PRODUCT_COLUMN_MANDATORY = ['name', 'action']

const KEY = 'oas-admin-cdn.products.columns'

/** @returns {string[]} 可见列（按 PRODUCT_COLUMN_KEYS 稳定排序，必选列强制保留） */
export function readProductColumns() {
  let raw = null
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) raw = JSON.parse(stored)
  } catch {
    raw = null
  }
  if (!Array.isArray(raw) || raw.length === 0) return [...PRODUCT_COLUMN_KEYS]
  const visible = PRODUCT_COLUMN_KEYS.filter((k) => raw.includes(k))
  for (const m of PRODUCT_COLUMN_MANDATORY) {
    if (!visible.includes(m)) visible.push(m)
  }
  return visible
}

/** @param {string[]} keys */
export function writeProductColumns(keys) {
  const visible = [...new Set(keys)].filter((k) => PRODUCT_COLUMN_KEYS.includes(k))
  for (const m of PRODUCT_COLUMN_MANDATORY) {
    if (!visible.includes(m)) visible.push(m)
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(visible))
  } catch {
    return
  }
}
