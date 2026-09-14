// 商品列设置：可见列持久化（自 vanilla src/pages/product-columns.ts 去 TS 移植，键名换 mpa 前缀）
export const PRODUCT_COLUMN_KEYS = ['name', 'category', 'price', 'stock', 'status', 'action']

// name / action 为必选列，不可取消
export const PRODUCT_COLUMN_MANDATORY = ['name', 'action']

const KEY = 'oas-admin-cdn-mpa.products.columns'

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
