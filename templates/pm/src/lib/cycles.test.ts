import { describe, expect, it } from 'vitest'
import {
  CYCLE_SIDEBAR_LIMIT,
  CURRENT_CYCLE,
  NO_CYCLE,
  currentCycleIds,
  currentCycleOf,
  cycleFilterPredicate,
  cyclePhase,
  dayInputToTs,
  demoCycleIdFor,
  isCurrentCycle,
  isOpenIssue,
  nextCycleOf,
  overlapsAnyCycle,
  rolloverUpdates,
  tsToDayInput,
} from './cycles'
import type { Cycle, Issue } from '@/types'

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

describe('周期相位与结转语义', () => {
  const now = 10_000

  it('cyclePhase：endAt 到点即已结束，startAt 前为未开始', () => {
    expect(cyclePhase(cycle({ id: 'a', startAt: 0, endAt: now }), now)).toBe('ended')
    expect(cyclePhase(cycle({ id: 'b', startAt: 0, endAt: now + 1 }), now)).toBe('current')
    expect(cyclePhase(cycle({ id: 'c', startAt: now, endAt: now + 1 }), now)).toBe('current')
    expect(cyclePhase(cycle({ id: 'd', startAt: now + 1, endAt: now + 2 }), now)).toBe('upcoming')
  })

  it('currentCycleOf：倒序列表里取最新开始的当前周期', () => {
    const rows = [
      cycle({ id: 'next', startAt: 20_000, endAt: 30_000 }),
      cycle({ id: 'live', startAt: 5_000, endAt: 15_000 }),
      cycle({ id: 'past', startAt: 0, endAt: 4_000 }),
    ]
    expect(currentCycleOf(rows, now)?.id).toBe('live')
    expect(currentCycleOf(rows, 40_000)).toBeUndefined()
  })

  it('isOpenIssue：done / cancelled 之外都算未完成', () => {
    expect(isOpenIssue({ status: 'todo' })).toBe(true)
    expect(isOpenIssue({ status: 'in_progress' })).toBe(true)
    expect(isOpenIssue({ status: 'backlog' })).toBe(true)
    expect(isOpenIssue({ status: 'done' })).toBe(false)
    expect(isOpenIssue({ status: 'cancelled' })).toBe(false)
  })

  it('nextCycleOf：同项目里 startAt 更大的最近一个；跨项目/并列不误选', () => {
    const current = cycle({ id: 'c2', startAt: 200, endAt: 300 })
    const rows = [
      cycle({ id: 'c3', startAt: 300, endAt: 400 }),
      cycle({ id: 'c4', startAt: 500, endAt: 600 }),
      current,
      cycle({ id: 'c1', startAt: 100, endAt: 200 }),
      cycle({ id: 'other-p2', startAt: 250, endAt: 350, projectId: 'p2' }),
    ]
    expect(nextCycleOf(rows, current)?.id).toBe('c3')
    // 最后一个周期没有下一周期
    expect(nextCycleOf(rows, rows[1])).toBeUndefined()
    expect(nextCycleOf([], current)).toBeUndefined()
  })

  it('rolloverUpdates：只搬该周期的未完成项，done/cancelled 与其他周期不动', () => {
    const issues = [
      { id: 'a', cycleId: 'c2', status: 'todo' },
      { id: 'b', cycleId: 'c2', status: 'in_progress' },
      { id: 'c', cycleId: 'c2', status: 'done' },
      { id: 'd', cycleId: 'c2', status: 'cancelled' },
      { id: 'e', cycleId: 'c3', status: 'todo' },
      { id: 'f', cycleId: null, status: 'todo' },
    ] as unknown as Issue[]
    expect(rolloverUpdates(issues, 'c2', 'c3')).toEqual([
      { id: 'a', changes: { cycleId: 'c3' } },
      { id: 'b', changes: { cycleId: 'c3' } },
    ])
    // 目标 null = 移出迭代
    expect(rolloverUpdates(issues, 'c2', null).map((u) => u.changes.cycleId)).toEqual([null, null])
    // 周期无未完成项 → 空批（不产生空写事务）
    expect(rolloverUpdates(issues, 'c1', 'c2')).toEqual([])
  })

  it('overlapsAnyCycle：左闭右开，首尾相接不算重叠；排除自身', () => {
    const rows = [
      cycle({ id: 'a', startAt: 0, endAt: 100 }),
      cycle({ id: 'b', startAt: 200, endAt: 300, projectId: 'p2' }),
    ]
    expect(overlapsAnyCycle(rows, 'p1', 50, 150)).toBe(true)
    expect(overlapsAnyCycle(rows, 'p1', 100, 200)).toBe(false)
    expect(overlapsAnyCycle(rows, 'p1', 0, 100, 'a')).toBe(false)
    // 跨项目不算重叠
    expect(overlapsAnyCycle(rows, 'p3', 0, 1000)).toBe(false)
  })
})

describe('日期输入往返', () => {
  it('dayInputToTs / tsToDayInput 为本地日历且可往返', () => {
    const ts = dayInputToTs('2026-03-05')
    expect(ts).not.toBeNull()
    expect(tsToDayInput(ts as number)).toBe('2026-03-05')
    const d = new Date(ts as number)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 5, 0])
  })

  it('非法输入返回 null（格式错、日历越界）', () => {
    expect(dayInputToTs('')).toBeNull()
    expect(dayInputToTs('2026-3-5')).toBeNull()
    expect(dayInputToTs('2026-02-30')).toBeNull()
    expect(dayInputToTs('abc')).toBeNull()
  })
})
