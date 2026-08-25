import { beforeEach, describe, expect, it } from 'vitest'
import { createOrder, listOrders, resetOrders, updateOrderStatus } from './orders'
import type { OrderStatus } from './orders'

const VALID: OrderStatus[] = ['pending', 'paid', 'shipping', 'done', 'cancelled']

describe('orders 数据源', () => {
  beforeEach(() => resetOrders())

  it('listOrders 返回 12 条种子，id 为 SO- 前缀', async () => {
    const rows = await listOrders()
    expect(rows.length).toBe(12)
    for (const r of rows) expect(r.id).toMatch(/^SO-\d{5}$/)
  })

  it('种子金额落在 800~30000 区间', async () => {
    const rows = await listOrders()
    for (const r of rows) {
      expect(r.amount).toBeGreaterThanOrEqual(800)
      expect(r.amount).toBeLessThanOrEqual(30000)
    }
  })

  it('种子状态分布：每种 2~3 条', async () => {
    const rows = await listOrders()
    for (const s of VALID) {
      const n = rows.filter((r) => r.status === s).length
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(3)
    }
  })

  it('种子订单带非空商品列表与创建日期', async () => {
    const rows = await listOrders()
    for (const r of rows) {
      expect(r.items.length).toBeGreaterThan(0)
      expect(r.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.customer.length).toBeGreaterThan(0)
    }
  })

  it('createOrder 头插新行并生成 SO- id/created', async () => {
    const before = (await listOrders()).length
    const row = await createOrder({
      customer: '新客户',
      amount: 5200,
      status: 'pending',
      items: ['数码相机'],
    })
    expect(row.id).toMatch(/^SO-\d{5}$/)
    expect(row.created).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const after = await listOrders()
    expect(after.length).toBe(before + 1)
    expect(after[0].customer).toBe('新客户')
    expect(after[0].items).toEqual(['数码相机'])
  })

  it('updateOrderStatus 修改命中行状态，id 不存在返回 null', async () => {
    const rows = await listOrders()
    const target = rows[0]
    const updated = await updateOrderStatus(target.id, 'done')
    expect(updated?.status).toBe('done')
    expect(updated?.id).toBe(target.id)
    expect(await updateOrderStatus('SO-99999', 'done')).toBeNull()
  })

  it('resetOrders 恢复 12 条种子', async () => {
    await createOrder({ customer: 'x', amount: 1, status: 'pending', items: [] })
    expect((await listOrders()).length).toBe(13)
    resetOrders()
    expect((await listOrders()).length).toBe(12)
  })
})
