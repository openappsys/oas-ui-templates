import { describe, expect, it } from 'vitest'
import { boardData } from './board'

describe('board 数据源', () => {
  it('返回 4 张统计卡（gmv/orders/users/conversion）', () => {
    const d = boardData()
    expect(d.stats).toHaveLength(4)
    expect(d.stats.map((s) => s.key)).toEqual(['gmv', 'orders', 'users', 'conversion'])
    expect(d.stats[0]).toMatchObject({ value: '12845678', prefix: '¥', anim: true })
  })

  it('月度营收为 6 个数值', () => {
    expect(boardData().monthRevenue).toHaveLength(6)
    for (const v of boardData().monthRevenue) expect(Number.isFinite(v)).toBe(true)
  })

  it('品类占比为 3 条（数码/家电/食品）且合计 100', () => {
    const d = boardData()
    expect(d.categoryShare.map((c) => c.name)).toEqual(['数码', '家电', '食品'])
    expect(d.categoryShare.reduce((a, c) => a + c.value, 0)).toBe(100)
  })

  it('渠道趋势为 3 个系列，每组 4 个数值', () => {
    const d = boardData()
    expect(d.channel.series).toHaveLength(3)
    for (const s of d.channel.series) expect(s.data).toHaveLength(4)
  })

  it('季度目标含 order/revenue/users', () => {
    const d = boardData()
    expect(d.quarterTargets).toMatchObject({ order: 72, revenue: 58, users: 85 })
  })

  it('确定性：重复调用数据一致且不共享引用（深拷贝）', () => {
    const a = boardData()
    const b = boardData()
    expect(a).toEqual(b)
    expect(a.monthRevenue).not.toBe(b.monthRevenue)
    expect(a.categoryShare).not.toBe(b.categoryShare)
    a.categoryShare[0]!.value = 99
    expect(boardData().categoryShare[0]!.value).toBe(40)
  })
})
