import type { Cycle, Issue } from '@/types'

export interface BurndownData {
  labels: string[]
  actual: number[]
  ideal: number[]
}

export interface VelocityPoint {
  label: string
  value: number
}

/** 本地日 0 点：燃尽按自然日切分，避免 UTC 日界与页面显示的日期错开一天 */
function startOfLocalDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addLocalDays(ts: number, n: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** 周期覆盖的自然日（含首尾）：startAt 当日 ~ endAt 当日，至少 1 天 */
export function cycleDays(cycle: Cycle): number[] {
  const first = startOfLocalDay(cycle.startAt)
  const last = startOfLocalDay(cycle.endAt)
  const days: number[] = []
  for (let t = first; t <= last; t = addLocalDays(t, 1)) days.push(t)
  return days.length > 0 ? days : [first]
}

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

/**
 * 燃尽：每日「剩余未完成数」= 周期内 total − 当日结束前已完成数（按 Issue.completedAt）。
 * 简化口径：done 但缺 completedAt 的历史数据视为在周期最后一天完成（口径写在任务书里，
 * 非真实完成日——这样不会把历史遗留的 done 全部堆到首日造成断崖）。
 * 理想线：从 total 线性降到 0，横轴同为周期自然日；未来日期沿用今日的剩余数（平台段）。
 */
export function buildBurndown(cycle: Cycle, issues: Issue[], total?: number): BurndownData {
  const count = total ?? issues.length
  const days = cycleDays(cycle)
  const fallback = cycle.endAt
  const completedAt = issues
    .filter((i) => i.status === 'done')
    .map((i) => i.completedAt ?? fallback)

  const actual = days.map((dayStart) => {
    const dayEnd = addLocalDays(dayStart, 1)
    let done = 0
    for (const t of completedAt) if (t < dayEnd) done += 1
    return Math.max(0, count - done)
  })

  const n = days.length
  const ideal = days.map((_, i) => (n === 1 ? 0 : Math.round((count * (n - 1 - i)) / (n - 1))))

  return { labels: days.map(dayLabel), actual, ideal }
}

/**
 * 近 6 期完成量：已结束周期（endAt <= now）按 startAt 倒序取 6 个，输出按时间升序
 * （柱图横轴从左到右是时间推进）。计数缺失按 0（周期刚建、还没工作项）。
 */
export function buildVelocity(
  cycles: Cycle[],
  counts: ReadonlyArray<{ cycleId: string | null; done: number }>,
  now: number,
): VelocityPoint[] {
  const doneByCycle = new Map(counts.map((r) => [r.cycleId, r.done]))
  const ended = cycles
    .filter((c) => c.endAt <= now)
    .sort((a, b) => b.startAt - a.startAt || (a.id < b.id ? 1 : -1))
    .slice(0, 6)
    .reverse()
  return ended.map((c) => ({ label: c.name, value: doneByCycle.get(c.id) ?? 0 }))
}
