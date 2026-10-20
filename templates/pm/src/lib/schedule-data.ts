import { PRIORITY_TEXT } from '@/lib/colors'
import type { Issue } from '@/types'

/** 日程三档（UTC 桶起点：全天=0 点、上午=9 点、下午=14 点） */
export type ScheduleBucket = 'allday' | 'am' | 'pm'

export interface ScheduleEvent {
  id: string
  date: string
  title: string
  color?: string
  start?: string
  end?: string
}

/** 任意毫秒 → 档位（getUTCHours：0→全天、1–11→上午、≥12→下午）。
 *  读侧全函数防线：seed 旧数据/手输任意时刻都能归到合法档，落点歧义（12:00–13:59）归下午 */
export function bucketOf(dueAt: number): ScheduleBucket {
  const h = new Date(dueAt).getUTCHours()
  if (h === 0) return 'allday'
  return h < 12 ? 'am' : 'pm'
}

/** epoch → 'YYYY-MM-DD'（UTC 取日）：与甘特/资源的 toISOString 口径一致，跨视图同日不错格 */
export function utcDay(ms: number): string {
  const d = new Date(ms)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}-${day}`
}

const BUCKET_HOUR: Record<ScheduleBucket, number> = { allday: 0, am: 9, pm: 14 }

/** 'YYYY-MM-DD' + 档位 → 桶起点 epoch。日期手拆（禁 new Date('YYYY-MM-DD') 隐式解析——
 *  ES 规范按 UTC 零点，但显式 Date.UTC 让契约自证且不依赖实现行为） */
export function bucketToDueAt(date: string, b: ScheduleBucket): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, BUCKET_HOUR[b])
}

/** startAt 倒挂钳制：晚于新 dueAt 时收敛到 dueAt（不 null 化——null 会在甘特退化为 createdAt 长条） */
export function clampStartAt(startAt: number | null, dueAt: number): number | null {
  return startAt != null && startAt > dueAt ? dueAt : startAt
}

const BASE_START: Record<'am' | 'pm', number> = { am: 9 * 60, pm: 14 * 60 }
const BASE_END: Record<'am' | 'pm', number> = { am: 12 * 60, pm: 18 * 60 }

const fmtMin = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Issue → scheduler 事件：cancelled/无 dueAt 剔除（1:1 复用 issue.id）；done 灰化、
 *  未完成过期加逾期前缀（不抢优先级色）；同日同桶按序 +30min 展示偏移缓解 week 重叠
 *  （纯展示——写回恒为桶起点；偏移封顶 23:30，非法 HH:mm 会被组件 sanitize 静默丢事件） */
export function deriveScheduleEvents(
  issues: Issue[],
  labels: { am: string; pm: string; overdue: string },
): ScheduleEvent[] {
  const now = Date.now()
  const events: ScheduleEvent[] = []
  const laneOffset = new Map<string, number>()
  for (const i of issues) {
    if (i.dueAt === null || i.status === 'cancelled') continue
    const b = bucketOf(i.dueAt)
    const date = utcDay(i.dueAt)
    let title = `${i.key} ${i.title}`
    let start: string | undefined
    let end: string | undefined
    if (b !== 'allday') {
      const key = `${date}|${b}`
      const n = laneOffset.get(key) ?? 0
      laneOffset.set(key, n + 1)
      const base = BASE_START[b]
      const off = Math.min(n * 30, 23 * 60 + 30 - base)
      start = fmtMin(base + off)
      end = fmtMin(BASE_END[b])
      title = `${b === 'am' ? labels.am : labels.pm}${title}`
    }
    if (i.status !== 'done' && i.dueAt < now) title = `${labels.overdue}${title}`
    events.push({
      id: i.id,
      date,
      title,
      color: i.status === 'done' ? 'var(--pm-status-done)' : PRIORITY_TEXT[i.priority],
      start,
      end,
    })
  }
  return events
}

/** 注入回声对拍签名：按 id 排序后 id|date|start 串联。scheduler 的 set events 也派发
 *  oas-events-change，宿主注入前对拍此签名可识别「组件把同一批事件念回来」避免回环 */
export function scheduleSignature(events: ScheduleEvent[]): string {
  return [...events]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => `${e.id}|${e.date}|${e.start ?? ''}`)
    .join(';')
}
