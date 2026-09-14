// 商品分类数据模块：内存 CRUD + localStorage 持久化（自 vanilla src/data/categories.ts 去 TS 移植）
import { persist, restore } from './store.js'

function seed() {
  const raw = [
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

const KEY = 'oas-admin-cdn-mpa.categories.v1'
const rows = restore(KEY, seed)
let seq = rows.length

function delay(value, ms = 100) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function listCategories() {
  return delay([...rows])
}

export function createCategory(data) {
  const row = { ...data, id: ++seq }
  rows.push(row)
  persist(KEY, rows)
  return delay(row)
}

export function updateCategory(id, data) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  rows[i] = { ...rows[i], ...data }
  persist(KEY, rows)
  return delay(rows[i])
}

export function removeCategory(id) {
  const i = rows.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  rows.splice(i, 1)
  persist(KEY, rows)
  return delay(true)
}

export function resetCategories() {
  rows.length = 0
  rows.push(...seed())
  seq = rows.length
  localStorage.removeItem(KEY)
}
