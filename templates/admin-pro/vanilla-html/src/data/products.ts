export type ProductCategory = '数码' | '服饰' | '家居' | '食品'
export type ProductStatus = 'on' | 'off'

export interface ProductRow {
  id: number
  name: string
  category: ProductCategory
  price: number
  stock: number
  status: ProductStatus
  created: string
}

function seed(): ProductRow[] {
  const raw: Array<[string, ProductCategory, number, number, ProductStatus, string]> = [
    ['无线降噪耳机', '数码', 899, 36, 'on', '2026-06-12'],
    ['智能手表', '数码', 1299, 8, 'on', '2026-06-28'],
    ['北欧原木餐桌', '家居', 2680, 4, 'on', '2026-07-03'],
    ['法式亚麻连衣裙', '服饰', 459, 62, 'off', '2026-07-15'],
    ['有机燕麦片', '食品', 59, 120, 'on', '2026-07-21'],
    ['山茶花护手霜', '家居', 78, 3, 'off', '2026-08-02'],
    ['商务双肩包', '服饰', 399, 42, 'on', '2026-08-09'],
    ['冷萃咖啡液', '食品', 129, 15, 'on', '2026-08-18'],
  ]
  return raw.map(([name, category, price, stock, status, created], i) => ({
    id: i + 1,
    name,
    category,
    price,
    stock,
    status,
    created,
  }))
}

const rows: ProductRow[] = seed()
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
  return delay(row)
}

export function updateProduct(
  id: number,
  data: Partial<Omit<ProductRow, 'id'>>,
): Promise<ProductRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  return delay(rows[i])
}

export function toggleProductStatus(id: number): Promise<ProductRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], status: rows[i].status === 'on' ? 'off' : 'on' }
  return delay(rows[i])
}

export function removeProduct(id: number): Promise<boolean> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  return delay(true)
}

export function resetProducts(): void {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
}
