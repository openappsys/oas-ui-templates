import { describe, expect, it } from 'vitest'
import {
  CYCLE_SIDEBAR_LIMIT,
  CURRENT_CYCLE,
  NO_CYCLE,
  currentCycleIds,
  cycleFilterPredicate,
  demoCycleIdFor,
  isCurrentCycle,
} from './cycles'
import type { Cycle } from '@/types'

const DAY = 86_400_000

const cycle = (over: Partial<Cycle> & { id: string }): Cycle => ({
  projectId: 'p1',
  name: over.id,
  startAt: 0,
  endAt: DAY,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('迭代状态派生', () => {
  it('isCurrentCycle：左闭右开（首尾相接的周期不会同刻双开）', () => {
    const c = cycle({ id: 'c1', startAt: 100, endAt: 200 })
    expect(isCurrentCycle(c, 99)).toBe(false)
    expect(isCurrentCycle(c, 100)).toBe(true)
    expect(isCurrentCycle(c, 199)).toBe(true)
    expect(isCurrentCycle(c, 200)).toBe(false)
  })

  it('currentCycleIds 收集全部进行中的周期（同刻多项目周期各自生效）', () => {
    const rows = [
      cycle({ id: 'past', startAt: 0, endAt: 100 }),
      cycle({ id: 'a', startAt: 100, endAt: 300 }),
      cycle({ id: 'b', startAt: 150, endAt: 400, projectId: 'p2' }),
    ]
    expect([...currentCycleIds(rows, 200)]).toEqual(['a', 'b'])
    expect([...currentCycleIds(rows, 50)]).toEqual(['past'])
    expect([...currentCycleIds(rows, 400)]).toEqual([])
  })
})

describe('cycleFilterPredicate 三态', () => {
  const rows = [
    cycle({ id: 'past', startAt: 0, endAt: 100 }),
    cycle({ id: 'live', startAt: 100, endAt: 300 }),
  ]
  const issues = [
    { cycleId: 'past' },
    { cycleId: 'live' },
    { cycleId: 'ghost' },
    { cycleId: null },
    {}, // 历史数据：无 cycleId 字段
  ]

  it('未入迭代：null 与缺失字段都算（历史数据不丢）', () => {
    expect(issues.filter(cycleFilterPredicate(NO_CYCLE, rows, 200))).toEqual([
      { cycleId: null },
      {},
    ])
  })

  it('当前迭代：只命中进行中的周期', () => {
    expect(issues.filter(cycleFilterPredicate(CURRENT_CYCLE, rows, 200))).toEqual([
      { cycleId: 'live' },
    ])
    // 没有周期在区间内 → 空集（不误落回「全部」）
    expect(issues.filter(cycleFilterPredicate(CURRENT_CYCLE, rows, 1000))).toEqual([])
  })

  it('具体周期 id：等值匹配', () => {
    expect(issues.filter(cycleFilterPredicate('past', rows, 200))).toEqual([{ cycleId: 'past' }])
    expect(issues.filter(cycleFilterPredicate('ghost', rows, 200))).toEqual([{ cycleId: 'ghost' }])
  })
})

describe('demoCycleIdFor（seed/mock 共用的确定性归属）', () => {
  const cycles = [
    cycle({ id: 'c1', startAt: 100, endAt: 200 }),
    cycle({ id: 'c2', startAt: 200, endAt: 300 }),
  ]

  it('无截止日期或 index % 7 < 3 时不入迭代', () => {
    expect(demoCycleIdFor(0, null, cycles)).toBeNull()
    expect(demoCycleIdFor(0, 250, cycles)).toBeNull()
    expect(demoCycleIdFor(1, 250, cycles)).toBeNull()
    expect(demoCycleIdFor(2, 250, cycles)).toBeNull()
    expect(demoCycleIdFor(3, 250, cycles)).toBe('c2')
  })

  it('按截止日期落入所属周期；早于最早周期归入最早', () => {
    expect(demoCycleIdFor(3, 150, cycles)).toBe('c1')
    expect(demoCycleIdFor(3, 200, cycles)).toBe('c2')
    expect(demoCycleIdFor(3, 0, cycles)).toBe('c1')
    // 晚于最末周期归入最末（尚未排期的未来需求算在当前迭代里）
    expect(demoCycleIdFor(3, 9999, cycles)).toBe('c2')
  })

  it('项目没有周期时一律未入迭代', () => {
    expect(demoCycleIdFor(0, 250, [])).toBeNull()
  })

  it('同一输入重复调用结果恒定（不消耗随机流）', () => {
    const a = Array.from({ length: 20 }, (_, i) => demoCycleIdFor(i, 150 + i, cycles))
    const b = Array.from({ length: 20 }, (_, i) => demoCycleIdFor(i, 150 + i, cycles))
    expect(a).toEqual(b)
    // 约 4/7 入迭代（i % 7 >= 3）
    expect(a.filter(Boolean).length).toBe(11)
  })

  it('侧栏周期行上限是常量（避免魔法数字散落）', () => {
    expect(CYCLE_SIDEBAR_LIMIT).toBeGreaterThan(0)
  })
})
