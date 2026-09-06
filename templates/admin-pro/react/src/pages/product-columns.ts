export type ProductColumnKey = 'name' | 'category' | 'price' | 'stock' | 'status' | 'action'

export const PRODUCT_COLUMN_KEYS: ProductColumnKey[] = [
  'name',
  'category',
  'price',
  'stock',
  'status',
  'action',
]

export const PRODUCT_COLUMN_MANDATORY: ProductColumnKey[] = ['name', 'action']

const KEY = 'oas-admin.products.columns'

export function readProductColumns(): ProductColumnKey[] {
  let raw: unknown = null
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

export function writeProductColumns(keys: ProductColumnKey[]): void {
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
