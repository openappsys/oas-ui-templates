import { describe, expect, it } from 'vitest'
import { screenData, tickScreenData } from './screen'

describe('screen 数据源', () => {
  it('返回 4 张 KPI（gmv/orders/users/conversion）', () => {
    const d = screenData()
    expect(d.kpis).toHaveLength(4)
    expect(d.kpis.map((k) => k.key)).toEqual(['gmv', 'orders', 'users', 'conversion'])
  })

  it('国家销售含 10+ 个国家，每个有 key/name/iso3/lng/lat/value', () => {
    const d = screenData()
    expect(d.countries.length).toBeGreaterThanOrEqual(10)
    for (const c of d.countries) {
      expect(c.key).toBeTruthy()
      expect(c.name).toBeTruthy()
      expect(c.iso3).toMatch(/^[A-Z]{3}$/)
      expect(Number.isFinite(c.lng)).toBe(true)
      expect(Number.isFinite(c.lat)).toBe(true)
      expect(c.value).toBeGreaterThan(0)
    }
  })

  it('月度营收 6 值、品类占比 3 条合计 100、渠道 3 系列各 4 值', () => {
    const d = screenData()
    expect(d.monthRevenue).toHaveLength(6)
    expect(d.categoryShare).toHaveLength(3)
    expect(d.categoryShare.reduce((a, c) => a + c.value, 0)).toBe(100)
    expect(d.channel.series).toHaveLength(3)
    for (const s of d.channel.series) expect(s.data).toHaveLength(4)
  })

  it('确定性：重复调用一致且不共享引用', () => {
    const a = screenData()
    const b = screenData()
    expect(a).toEqual(b)
    expect(a.monthRevenue).not.toBe(b.monthRevenue)
    a.countries[0]!.value = 999999
    expect(screenData().countries[0]!.value).not.toBe(999999)
  })

  it('tickScreenData 返回新对象，至少一个 KPI 值变化', () => {
    const a = screenData()
    const b = tickScreenData(a)
    expect(b).not.toBe(a)
    expect(b.kpis).not.toBe(a.kpis)
    expect(b.kpis.some((k, i) => k.value !== a.kpis[i]!.value)).toBe(true)
  })

  it('tickScreenData 至少一个国家值变化', () => {
    const a = screenData()
    const b = tickScreenData(a)
    expect(b.countries.some((c, i) => c.value !== a.countries[i]!.value)).toBe(true)
  })
})
