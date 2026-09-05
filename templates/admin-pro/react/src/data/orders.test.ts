import { beforeEach, describe, expect, it } from 'vitest'
import { createOrder, getOrder, listOrders, resetOrders, updateOrderStatus } from './orders'
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

  it('种子订单带合法手机号与加急标记', async () => {
    const rows = await listOrders()
    for (const r of rows) {
      expect(r.phone).toMatch(/^1\d{10}$/)
      expect(typeof r.urgent).toBe('boolean')
    }
  })

  it('种子订单 creator 一半张伟一半王芳', async () => {
    const rows = await listOrders()
    const zw = rows.filter((r) => r.creator === '张伟').length
    const wf = rows.filter((r) => r.creator === '王芳').length
    expect(zw).toBe(6)
    expect(wf).toBe(6)
  })

  it('createOrder 默认 creator 为张伟', async () => {
    const row = await createOrder({
      customer: '新客户',
      amount: 5200,
      status: 'pending',
      items: ['数码相机'],
    })
    expect(row.creator).toBe('张伟')
    const custom = await createOrder({
      customer: '新客户2',
      amount: 1000,
      status: 'paid',
      items: ['键盘'],
      creator: '王芳',
    })
    expect(custom.creator).toBe('王芳')
  })

  it('getOrder 返回命中行，id 不存在返回 null', async () => {
    const rows = await listOrders()
    const target = rows[0]
    const hit = await getOrder(target.id)
    expect(hit?.id).toBe(target.id)
    expect(hit?.customer).toBe(target.customer)
    expect(await getOrder('SO-99999')).toBeNull()
  })

  it('createOrder 保留加急/电话/备注字段', async () => {
    const row = await createOrder({
      customer: '加急客户',
      amount: 3200,
      status: 'pending',
      items: ['机械键盘'],
      urgent: true,
      phone: '13800001111',
      note: '尽快发货',
    })
    expect(row.urgent).toBe(true)
    expect(row.phone).toBe('13800001111')
    expect(row.note).toBe('尽快发货')
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
