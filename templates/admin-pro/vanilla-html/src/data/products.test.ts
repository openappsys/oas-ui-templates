import { beforeEach, describe, expect, it } from 'vitest'
import {
  createProduct,
  getProduct,
  listProducts,
  removeProduct,
  resetProducts,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from './products'
import type { ProductStatus } from './products'

const CATEGORIES: string[] = ['数码', '服饰', '家居', '食品']
const STATUSES: ProductStatus[] = ['on', 'off']

describe('products 数据源', () => {
  beforeEach(() => resetProducts())

  it('listProducts 返回 8 条种子', async () => {
    const rows = await listProducts()
    expect(rows.length).toBe(8)
    for (const r of rows) {
      expect(CATEGORIES).toContain(r.category)
      expect(STATUSES).toContain(r.status)
      expect(r.price).toBeGreaterThan(0)
      expect(r.stock).toBeGreaterThanOrEqual(0)
      expect(r.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('createProduct 头插新行并生成 id/created', async () => {
    const before = (await listProducts()).length
    const row = await createProduct({
      name: '新品耳机',
      category: '数码',
      price: 299,
      stock: 20,
      status: 'on',
    })
    expect(row.id).toBeGreaterThan(0)
    expect(row.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const after = await listProducts()
    expect(after.length).toBe(before + 1)
    expect(after[0].name).toBe('新品耳机')
  })

  it('updateProduct 修改命中行，id 不存在返回 null', async () => {
    const rows = await listProducts()
    const target = rows[rows.length - 1]
    const updated = await updateProduct(target.id, { price: 888, stock: 3 })
    expect(updated?.price).toBe(888)
    expect(updated?.stock).toBe(3)
    expect(await updateProduct(99999, { name: 'x' })).toBeNull()
  })

  it('getProduct 命中返回实体，未命中返回 null', async () => {
    const rows = await listProducts()
    const target = rows[0]
    const found = await getProduct(target.id)
    expect(found?.id).toBe(target.id)
    expect(await getProduct(99999)).toBeNull()
  })

  it('toggleProductStatus 翻转 on/off，id 不存在返回 null', async () => {
    const rows = await listProducts()
    const target = rows[0]
    const flipped = await toggleProductStatus(target.id)
    expect(flipped?.status).toBe(target.status === 'on' ? 'off' : 'on')
    expect(await toggleProductStatus(99999)).toBeNull()
  })

  it('removeProduct 删除命中行，id 不存在返回 false', async () => {
    const rows = await listProducts()
    const before = rows.length
    expect(await removeProduct(rows[rows.length - 1].id)).toBe(true)
    expect((await listProducts()).length).toBe(before - 1)
    expect(await removeProduct(99999)).toBe(false)
  })

  it('resetProducts 恢复 8 条种子', async () => {
    await createProduct({
      name: '临时品',
      category: '家居',
      price: 10,
      stock: 1,
      status: 'on',
    })
    expect((await listProducts()).length).toBe(9)
    resetProducts()
    expect((await listProducts()).length).toBe(8)
  })

  it('stockLevel 三级库存阈值', () => {
    expect(stockLevel(0)).toBe('critical')
    expect(stockLevel(4)).toBe('critical')
    expect(stockLevel(5)).toBe('low')
    expect(stockLevel(15)).toBe('low')
    expect(stockLevel(20)).toBe('low')
    expect(stockLevel(21)).toBe('ok')
    expect(stockLevel(120)).toBe('ok')
  })

  it('种子商品带销量 sold 落在 45~120 且最大值为 120', async () => {
    const rows = await listProducts()
    const sold = rows.map((r) => r.sold!).sort((a, b) => b - a)
    expect(sold.length).toBe(8)
    expect(sold[0]).toBe(120)
    expect(sold[sold.length - 1]).toBe(45)
    expect(sold.every((n) => n >= 45 && n <= 120)).toBe(true)
  })
})
