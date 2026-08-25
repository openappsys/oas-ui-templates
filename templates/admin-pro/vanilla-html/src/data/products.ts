import { persist, restore } from './store'

export type ProductCategory = '数码' | '服饰' | '家居' | '食品'
export type ProductStatus = 'on' | 'off'
export type StockLevel = 'ok' | 'low' | 'critical'

export function stockLevel(stock: number): StockLevel {
  if (stock < 5) return 'critical'
  if (stock <= 20) return 'low'
  return 'ok'
}

export interface ProductRow {
  id: number
  name: string
  category: ProductCategory
  price: number
  stock: number
  status: ProductStatus
  created: string
  sold?: number
}

function seed(): ProductRow[] {
  const raw: Array<[string, ProductCategory, number, number, ProductStatus, string, number]> = [
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

const KEY = 'oas-admin.products.v1'
const rows: ProductRow[] = restore(KEY, seed)
let seq = rows.length

function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function listProducts(): Promise<ProductRow[]> {
  return delay([...rows])
}

export function createProduct(data: Omit<ProductRow, 'id' | 'created'>): Promise<ProductRow> {
  const row: ProductRow = {
    ...data,
    id: ++seq,
    created: new Date().toISOString().slice(0, 10),
  }
  rows.unshift(row)
  persist(KEY, rows)
  return delay(row)
}

export function updateProduct(
  id: number,
  data: Partial<Omit<ProductRow, 'id'>>,
): Promise<ProductRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  persist(KEY, rows)
  return delay(rows[i])
}

export function toggleProductStatus(id: number): Promise<ProductRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], status: rows[i].status === 'on' ? 'off' : 'on' }
  persist(KEY, rows)
  return delay(rows[i])
}

export function removeProduct(id: number): Promise<boolean> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  persist(KEY, rows)
  return delay(true)
}

export function resetProducts(): void {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
  localStorage.removeItem(KEY)
}
