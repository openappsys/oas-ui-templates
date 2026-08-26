import { persist, restore } from './store'

export type CategoryStatus = 'on' | 'off'

export interface CategoryRow {
  id: number
  name: string
  code: string
  sort: number
  status: CategoryStatus
  desc: string
}

function seed(): CategoryRow[] {
  const raw: Array<[string, string, number, CategoryStatus, string]> = [
    ['数码', 'digital', 1, 'on', '消费电子、智能设备'],
    ['服饰', 'apparel', 2, 'on', '服装、鞋靴、配饰'],
    ['家居', 'home', 3, 'on', '家具、家纺、厨具'],
    ['食品', 'food', 4, 'on', '零食、饮品、生鲜'],
  ]
  return raw.map(([name, code, sort, status, desc], i) => ({
    id: i + 1,
    name,
    code,
    sort,
    status,
    desc,
  }))
}

const KEY = 'oas-admin.categories.v1'
const rows: CategoryRow[] = restore(KEY, seed)
let seq = rows.length

function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function listCategories(): Promise<CategoryRow[]> {
  return delay([...rows])
}

export function createCategory(data: Omit<CategoryRow, 'id'>): Promise<CategoryRow> {
  const row: CategoryRow = { ...data, id: ++seq }
  rows.push(row)
  persist(KEY, rows)
  return delay(row)
}

export function updateCategory(
  id: number,
  data: Partial<Omit<CategoryRow, 'id'>>,
): Promise<CategoryRow | null> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  persist(KEY, rows)
  return delay(rows[i])
}

export function removeCategory(id: number): Promise<boolean> {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  persist(KEY, rows)
  return delay(true)
}

export function resetCategories(): void {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
  localStorage.removeItem(KEY)
}
