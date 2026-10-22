// 相对路径而非 @ 别名：vite.config.ts 直接加载 mock-server.ts，进而解析本模块——
// 配置加载阶段的别名尚未注册，裸别名会被 Node 当成包名解析失败（同 lib/filters）
import type { Cycle } from '../types/index.ts'

/** 迭代筛选的「当前迭代」哨兵：周期 id 不会取此值。
 *  不落 status 字段——当前迭代由 now ∈ [startAt, endAt) 派生，时钟推进即自动换挡 */
export const CURRENT_CYCLE = '__current__'

/** 迭代筛选中「未入迭代」的哨兵 */
export const NO_CYCLE = '__none__'

/** 每个项目的侧栏最多列出的周期行数（更多周期留给阶段 2 的管理端） */
export const CYCLE_SIDEBAR_LIMIT = 6

/** 当前迭代：startAt <= now < endAt（区间左闭右开，首尾相接的周期不会同刻双开） */
export function isCurrentCycle(c: Cycle, now: number): boolean {
  return c.startAt <= now && now < c.endAt
}

/** 当前迭代之间的判定：两种数据源（Dexie/API）与 seed 共用同一派生口径 */
export function currentCycleIds(cycles: Cycle[], now: number): Set<string> {
  return new Set(cycles.filter((c) => isCurrentCycle(c, now)).map((c) => c.id))
}

/**
 * 迭代筛选 → Issue 谓词。
 * 三个分支对应 Filters.cycleFilter 的三态：未入迭代 / 当前迭代 / 具体周期。
 * 历史 Issue 可能没有 cycleId 字段，一律按 null（未入迭代）处理。
 */
export function cycleFilterPredicate(
  cycleFilter: string,
  cycles: Cycle[],
  now: number,
): (issue: { cycleId?: string | null }) => boolean {
  if (cycleFilter === NO_CYCLE) return (issue) => (issue.cycleId ?? null) === null
  if (cycleFilter === CURRENT_CYCLE) {
    const ids = currentCycleIds(cycles, now)
    return (issue) => issue.cycleId != null && ids.has(issue.cycleId)
  }
  return (issue) => issue.cycleId === cycleFilter
}

/**
 * 演示数据的确定性迭代归属（seed 与 API mock 共用，保证两种数据源同分布）：
 * 无截止日期或 index % 7 < 3 的样本留在「未入迭代」（约 57% 入迭代），其余按截止日期
 * 落入所属周期，早于最早周期的需求归入最早周期（旧需求视为已排期过）。
 * 只读 index 与 dueAt，不消耗随机流——多抽一次 rand 会平移整条流、撞飞 e2e 锚定的 issue id。
 * 取模 7（而非 5）：日程演示组的逾期样本是 j%5===4，用 5 会让它们整体落进「未入迭代」。
 * cycles 需按 startAt 升序传入。
 */
export function demoCycleIdFor(
  index: number,
  dueAt: number | null,
  cyclesAsc: Cycle[],
): string | null {
  if (dueAt === null || cyclesAsc.length === 0 || index % 7 < 3) return null
  let hit = cyclesAsc[0]
  for (const c of cyclesAsc) if (c.startAt <= dueAt) hit = c
  return hit.id
}
