// 相对路径而非 @ 别名：vite.config.ts 直接加载 mock-server.ts，进而解析本模块——
// 配置加载阶段的别名尚未注册，裸别名会被 Node 当成包名解析失败（同 lib/filters）
import type { Cycle, Issue, IssueStatus } from '../types/index.ts'

/** 一天的毫秒数（周期区间/燃尽按天切分用） */
export const DAY_MS = 86_400_000

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

/** 周期相位（派生，无 status 字段）：now >= endAt 已结束；now ∈ [startAt, endAt) 进行中；否则未开始 */
export type CyclePhase = 'ended' | 'current' | 'upcoming'

export function cyclePhase(c: Cycle, now: number): CyclePhase {
  if (now >= c.endAt) return 'ended'
  return c.startAt <= now ? 'current' : 'upcoming'
}

/** 当前迭代（cycles 需按 startAt 倒序传入）：最新开始的那个。
 *  「全部项目」作用域下每项目各有一个当前周期，取最新的一个作为看板/燃尽的主对象 */
export function currentCycleOf(cycles: Cycle[], now: number): Cycle | undefined {
  return cycles.find((c) => isCurrentCycle(c, now))
}

/** 迭代内「未完成」口径：done / cancelled 之外都算未完成——结转只搬这些 */
export function isOpenIssue(issue: { status: IssueStatus }): boolean {
  return issue.status !== 'done' && issue.status !== 'cancelled'
}

/** 结转目标「下一周期」：同项目里 startAt 大于本周期的最早一个；并列 startAt 取先出现者 */
export function nextCycleOf(cycles: Cycle[], cycle: Cycle): Cycle | undefined {
  let best: Cycle | undefined
  for (const c of cycles) {
    if (c.id === cycle.id || c.projectId !== cycle.projectId || c.startAt <= cycle.startAt) continue
    if (!best || c.startAt < best.startAt) best = c
  }
  return best
}

/**
 * 结转批量补丁：把该周期的未完成项改挂到目标周期（null = 移出迭代）。
 * 纯函数——写库由调用方一次 updateMany（单事务）完成。
 */
export function rolloverUpdates(
  issues: Issue[],
  cycleId: string,
  targetCycleId: string | null,
): Array<{ id: string; changes: Partial<Issue> }> {
  return issues
    .filter((i) => (i.cycleId ?? null) === cycleId && isOpenIssue(i))
    .map((i) => ({ id: i.id, changes: { cycleId: targetCycleId } }))
}

/** 同项目内区间是否与本周期重叠（左闭右开，首尾相接不算重叠）；excludeId 排除自身 */
export function overlapsAnyCycle(
  cycles: Cycle[],
  projectId: string,
  startAt: number,
  endAt: number,
  excludeId?: string,
): boolean {
  return cycles.some(
    (c) =>
      c.projectId === projectId && c.id !== excludeId && c.startAt < endAt && startAt < c.endAt,
  )
}

/** 日期输入值 'YYYY-MM-DD'（本地日历）→ 当日 0 点时间戳；格式/日历日期不合法返回 null */
export function dayInputToTs(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(year, month - 1, day)
  // 溢出（如 02-30 滚到 03-02）视为非法，避免静默写错区间
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d.getTime()
}

/** 时间戳 → 本地 'YYYY-MM-DD'（date-picker 的输入值格式） */
export function tsToDayInput(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
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
