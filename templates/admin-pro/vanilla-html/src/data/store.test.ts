import { beforeEach, describe, expect, it } from 'vitest'
import { persist, restore } from './store'

describe('store 持久化工具', () => {
  beforeEach(() => localStorage.clear())

  it('persist 写入后 restore 读回相同数据', () => {
    const rows = [
      { id: 1, name: '耳机', sold: 120 },
      { id: 2, name: '咖啡', sold: 45 },
    ]
    persist('oas-admin.products.v1', rows)
    expect(restore('oas-admin.products.v1', () => [])).toEqual(rows)
  })

  it('无存储值时 restore 调用种子并写入 localStorage', () => {
    const out = restore('oas-admin.users.v1', () => [{ id: 7, name: 'seed' }])
    expect(out).toEqual([{ id: 7, name: 'seed' }])
    expect(JSON.parse(localStorage.getItem('oas-admin.users.v1')!)).toEqual([
      { id: 7, name: 'seed' },
    ])
  })

  it('JSON 损坏时回退种子且不抛错', () => {
    localStorage.setItem('oas-admin.orders.v1', '{bad json')
    expect(restore('oas-admin.orders.v1', () => [{ id: 3 }])).toEqual([{ id: 3 }])
  })
})
