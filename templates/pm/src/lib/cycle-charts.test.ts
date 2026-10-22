import { describe, expect, it } from 'vitest'
import type { Cycle, Issue } from '@/types'
import { buildBurndown, buildVelocity, cycleDays } from './cycle-charts'

/** 本地当日 0 点 + 天数偏移（与实现的时间轴口径一致） */
function dayStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function addDays(ts: number, n: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

const T0 = dayStart(Date.UTC(2026, 0, 5, 12))

const cycle = (over: Partial<Cycle> & { id: string }): Cycle => ({
  projectId: 'p1',
  name: over.id,
  startAt: T0,
  endAt: addDays(T0, 6) + 12 * 3_600_000,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const issue = (over: Partial<Issue> & { id: string }): Issue =>
  ({
    projectId: 'p1',
    key: over.id,
    title: 't',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    reporterId: 'm1',
    labels: [],
    startAt: null,
    dueAt: null,
    createdAt: 0,
    updatedAt: 0,
    order: 0,
    ...over,
  }) as Issue

describe('cycleDays', () => {
  it('含首尾自然日（7 天周期 = 7 个点），同日上下半天仍 1 个点', () => {
    const c = cycle({ id: 'c', startAt: T0 + 3_600_000, endAt: addDays(T0, 6) })
    expect(cycleDays(c)).toHaveLength(7)
    expect(cycleDays(c)[0]).toBe(T0)
    expect(cycleDays(cycle({ id: 'one', startAt: T0, endAt: T0 + 1000 }))).toHaveLength(1)
  })
})

describe('buildBurndown', () => {
  it('实际线：按 completedAt 逐日扣减；缺失 completedAt 的 done 记在最后一天', () => {
    const c = cycle({ id: 'c' })
    const rows = [
      issue({ id: 'a', status: 'done', completedAt: addDays(T0, 1) + 3_600_000 }),
      issue({ id: 'b', status: 'done', completedAt: addDays(T0, 3) + 3_600_000 }),
      // 历史数据：done 但没有 completedAt
      issue({ id: 'legacy', status: 'done', completedAt: undefined }),
      issue({ id: 'open1' }),
      issue({ id: 'open2' }),
    ]
    const burn = buildBurndown(c, rows)
    expect(burn.labels).toHaveLength(7)
    // 第 0 天：5 条全在；第 1 天末：a 完成 → 4
    expect(burn.actual[0]).toBe(5)
    expect(burn.actual[1]).toBe(4)
    expect(burn.actual[2]).toBe(4)
    expect(burn.actual[3]).toBe(3)
    // 最后一天：b 与 legacy 都完成 → 5 - 3 = 2
    expect(burn.actual[6]).toBe(2)
    // 单调不增
    for (let i = 1; i < burn.actual.length; i++) {
      expect(burn.actual[i]).toBeLessThanOrEqual(burn.actual[i - 1])
    }
  })

  it('理想线：从 total 线性降到 0（首尾锚定）', () => {
    const c = cycle({ id: 'c' })
    const rows = Array.from({ length: 10 }, (_, i) => issue({ id: `i${i}` }))
    const burn = buildBurndown(c, rows)
    expect(burn.ideal[0]).toBe(10)
    expect(burn.ideal[burn.ideal.length - 1]).toBe(0)
    // 7 个点等分 10 → 每点 10/6 递减后四舍五入
    expect(burn.ideal).toEqual([10, 8, 7, 5, 3, 2, 0])
  })

  it('未来日期沿用当日剩余（平台段），cancelled 计入剩余', () => {
    const c = cycle({ id: 'c', startAt: addDays(T0, -1), endAt: addDays(T0, 3) })
    const rows = [
      issue({ id: 'a', status: 'done', completedAt: T0 }),
      issue({ id: 'c1', status: 'cancelled' }),
      issue({ id: 'o' }),
    ]
    const burn = buildBurndown(c, rows)
    // 5 个自然日；total=3，done 1 → 剩 2；cancelled 不算完成，始终留在剩余里
    expect(burn.actual).toEqual([3, 2, 2, 2, 2])
  })

  it('total 可由调用方传入（与计数接口对齐时用）', () => {
    const burn = buildBurndown(cycle({ id: 'c' }), [], 42)
    expect(burn.actual[0]).toBe(42)
    expect(burn.ideal[0]).toBe(42)
  })
})

describe('buildVelocity', () => {
  it('只取已结束周期，按 startAt 倒序取 6 个，输出按时间升序', () => {
    const now = addDays(T0, 100)
    const rows = Array.from({ length: 8 }, (_, i) =>
      cycle({ id: `c${i}`, startAt: addDays(T0, i * 10), endAt: addDays(T0, i * 10 + 5) }),
    )
    // 未结束的周期不参与
    rows.push(cycle({ id: 'live', startAt: addDays(T0, 90), endAt: addDays(T0, 200) }))
    const counts = rows.map((c, i) => ({ cycleId: c.id, done: i }))
    const points = buildVelocity(rows, counts, now)
    expect(points.map((p) => p.label)).toEqual(['c2', 'c3', 'c4', 'c5', 'c6', 'c7'])
    expect(points.map((p) => p.value)).toEqual([2, 3, 4, 5, 6, 7])
  })

  it('计数缺失按 0（周期刚建、还没有工作项）', () => {
    const now = addDays(T0, 10)
    const rows = [cycle({ id: 'a', startAt: T0, endAt: addDays(T0, 1) })]
    expect(buildVelocity(rows, [], now)).toEqual([{ label: 'a', value: 0 }])
    expect(buildVelocity([], [], now)).toEqual([])
  })
})
