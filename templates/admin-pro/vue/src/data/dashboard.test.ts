import { describe, expect, it } from 'vitest'
import { orderBreakdown, recentOrders, trendDays, trendSeries } from './dashboard'

describe('dashboard 数据源', () => {
  it('trendSeries 生成指定天数且数值合法', () => {
    expect(trendSeries(7)).toHaveLength(7)
    expect(trendSeries(30)).toHaveLength(30)
    for (const v of [...trendSeries(7), ...trendSeries(30)]) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(200)
    }
  })

  it('trendSeries 确定性：同天数重复调用结果一致', () => {
    expect(trendSeries(30)).toEqual(trendSeries(30))
    expect(trendSeries(14)).toEqual(trendSeries(14))
  })

  it('trendDays 7/14 天全量展示', () => {
    expect(trendDays(7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(trendDays(14)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('trendDays 30 天抽稀为 7 个标签（首/末/每 5 天）', () => {
    const days = trendDays(30)
    expect(days).toHaveLength(30)
    const shown = days.filter((d) => d !== '')
    expect(shown).toEqual([1, 5, 10, 15, 20, 25, 30])
  })

  it('orderBreakdown 各区间切片求和等于总数', () => {
    for (const days of [7, 14, 30]) {
      const b = orderBreakdown(days)
      expect(b.total).toBeGreaterThan(0)
      expect(b.slices.reduce((sum, s) => sum + s.value, 0)).toBe(b.total)
      for (const s of b.slices) {
        expect(s.value).toBeGreaterThan(0)
        expect(s.status).toMatch(/^(done|shipping|pending|cancelled)$/)
      }
    }
  })

  it('orderBreakdown 7 日总数保持 1926（默认口径）', () => {
    expect(orderBreakdown(7).total).toBe(1926)
  })

  it('orderBreakdown 区间越长已完成占比越高', () => {
    const doneRatio = (days: number) => {
      const b = orderBreakdown(days)
      const done = b.slices.find((s) => s.status === 'done')!.value
      return done / b.total
    }
    expect(doneRatio(30)).toBeGreaterThan(doneRatio(14))
    expect(doneRatio(14)).toBeGreaterThan(doneRatio(7))
  })

  it('recentOrders 按区间过滤（daysAgo < days）', () => {
    expect(recentOrders(7)).toHaveLength(5)
    expect(recentOrders(14)).toHaveLength(7)
    expect(recentOrders(30)).toHaveLength(11)
    for (const days of [7, 14, 30]) {
      for (const r of recentOrders(days)) {
        expect(r.daysAgo).toBeLessThan(days)
        expect(r.amount).toBeGreaterThan(0)
        expect(r.id).toMatch(/^SO-\d{5}$/)
      }
    }
  })

  it('recentOrders 保持时间升序（最近在前）', () => {
    const rows = recentOrders(30)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].daysAgo).toBeLessThanOrEqual(rows[i].daysAgo)
    }
  })
})
