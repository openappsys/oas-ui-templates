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

const TILE_MIN = 60
const MAX_TILE = 3
/** 桶内容纳的 60min 槽数（am 09–12=3 / pm 14–18=4） */
const BUCKET_SLOTS: Record<'am' | 'pm', number> = {
  am: (BASE_END.am - BASE_START.am) / TILE_MIN,
  pm: (BASE_END.pm - BASE_START.pm) / TILE_MIN,
}
const MORE_COLOR = 'var(--pm-status-backlog)'

/** Issue → scheduler 事件：cancelled/无 dueAt 剔除（1:1 复用 issue.id）；done 灰化、
 *  未完成过期加逾期前缀（不抢优先级色）；同日同桶按 60min 块竖排平铺，组内超 3 块时
 *  尾部槽位合成一个 +N 封顶块（id __more__date__bucket，muted 色，占桶尾 60min——
 *  am 桶仅 3 槽故真实块让位到 2 块，永不叠印永不越桶；纯展示——写回恒为桶起点；
 *  全天档无 start/end 不参与平铺） */
export function deriveScheduleEvents(
  issues: Issue[],
  labels: { am: string; pm: string; overdue: string; more: (n: number) => string },
): ScheduleEvent[] {
  const now = Date.now()
  const events: ScheduleEvent[] = []
  const groupSize = new Map<string, number>()
  for (const i of issues) {
    if (i.dueAt === null || i.status === 'cancelled') continue
    const b = bucketOf(i.dueAt)
    if (b === 'allday') continue
    const key = `${utcDay(i.dueAt)}|${b}`
    groupSize.set(key, (groupSize.get(key) ?? 0) + 1)
  }
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
      const total = groupSize.get(key) ?? 0
      const shown = total > MAX_TILE ? Math.min(MAX_TILE, BUCKET_SLOTS[b] - 1) : total
      if (n >= shown) {
        if (n === shown) {
          events.push({
            id: `__more__${date}__${b}`,
            date,
            title: labels.more(total - shown),
            color: MORE_COLOR,
            start: fmtMin(BASE_END[b] - TILE_MIN),
            end: fmtMin(BASE_END[b]),
          })
        }
        continue
      }
      const s = BASE_START[b] + n * TILE_MIN
      start = fmtMin(s)
      end = fmtMin(s + TILE_MIN)
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

/** 注入回声对拍签名：按 id 排序后 id|date|start|end|title|color 完整体串联。scheduler 的
 *  set events 也派发 oas-events-change，宿主注入前对拍此签名可识别「组件把同一批事件念回来」
 *  避免回环；完整体口径保证标题/配色变化（抽屉改标题/转 done/改优先级）不被守卫挡成陈旧 chip */
export function scheduleSignature(events: ScheduleEvent[]): string {
  return [...events]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => `${e.id}|${e.date}|${e.start ?? ''}|${e.end ?? ''}|${e.title}|${e.color ?? ''}`)
    .join(';')
}
