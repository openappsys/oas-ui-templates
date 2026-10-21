import { describe, expect, it } from 'vitest'
import type { Issue } from '@/types'
import {
  bucketOf,
  bucketToDueAt,
  clampStartAt,
  deriveScheduleEvents,
  dueAtWithTime,
  hhmmOf,
  isBucketMoment,
  scheduleSignature,
  utcDay,
  type ScheduleEvent,
} from './schedule-data'

const issue = (over: Partial<Issue>): Issue => ({
  id: 'i-1',
  projectId: 'project-1',
  key: 'OAS-1',
  title: '标题',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: 'm-1',
  reporterId: 'm-1',
  labels: [],
  startAt: null,
  dueAt: null,
  createdAt: Date.UTC(2026, 0, 10),
  updatedAt: Date.UTC(2026, 0, 10),
  order: 0,
  ...over,
})

const labels = { am: '上午 ', pm: '下午 ', overdue: '逾期 ', more: (n: number) => `+${n} 项` }

/** 相对当前时刻的 UTC 日（负数=过去），桶时刻由调用方给 */
const relDay = (addDays: number, hour: number) => {
  const n = new Date()
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + addDays, hour)
}

describe('bucketOf 档位派生（getUTCHours 口径）', () => {
  it('UTC 小时边界：0→allday、1/11→am、12/14/23→pm', () => {
    expect(bucketOf(Date.UTC(2026, 0, 15, 0))).toBe('allday')
    expect(bucketOf(Date.UTC(2026, 0, 15, 0, 30))).toBe('allday')
    expect(bucketOf(Date.UTC(2026, 0, 15, 1))).toBe('am')
    expect(bucketOf(Date.UTC(2026, 0, 15, 11))).toBe('am')
    expect(bucketOf(Date.UTC(2026, 0, 15, 11, 59))).toBe('am')
    expect(bucketOf(Date.UTC(2026, 0, 15, 12))).toBe('pm')
    expect(bucketOf(Date.UTC(2026, 0, 15, 14))).toBe('pm')
    expect(bucketOf(Date.UTC(2026, 0, 15, 23))).toBe('pm')
    expect(bucketOf(Date.UTC(2026, 0, 15, 23, 59))).toBe('pm')
  })
})

describe('utcDay / bucketToDueAt 往返（UTC 全链）', () => {
  it('utcDay 取 UTC 日：UTC+8 本地零点时间戳不漂一天', () => {
    // 2026-01-15 16:00Z 在 UTC+8 即 01-16 00:00 本地——本地零点解析会得到 01-16，契约要求 UTC 日
    expect(utcDay(Date.UTC(2026, 0, 15, 16))).toBe('2026-01-15')
    expect(utcDay(Date.UTC(2026, 0, 15, 23, 59))).toBe('2026-01-15')
    expect(utcDay(Date.UTC(2026, 0, 16, 0))).toBe('2026-01-16')
  })

  it('bucketToDueAt 产 UTC 0/9/14 时桶起点', () => {
    expect(bucketToDueAt('2026-03-07', 'allday')).toBe(Date.UTC(2026, 2, 7, 0))
    expect(bucketToDueAt('2026-03-07', 'am')).toBe(Date.UTC(2026, 2, 7, 9))
    expect(bucketToDueAt('2026-03-07', 'pm')).toBe(Date.UTC(2026, 2, 7, 14))
  })

  it('月/年/闰日边界往返恒等：utcDay(bucketToDueAt(d, b)) === d 且桶复原', () => {
    for (const d of ['2026-01-01', '2025-12-31', '2028-02-29', '2026-12-31']) {
      for (const b of ['allday', 'am', 'pm'] as const) {
        const ms = bucketToDueAt(d, b)
        expect(utcDay(ms)).toBe(d)
        expect(bucketOf(ms)).toBe(b)
      }
    }
  })
})

describe('clampStartAt 倒挂钳制', () => {
  it('三态：null 透传 / startAt≤dueAt 原样 / startAt>dueAt 收敛到 dueAt', () => {
    const due = Date.UTC(2026, 2, 7, 14)
    expect(clampStartAt(null, due)).toBeNull()
    expect(clampStartAt(Date.UTC(2026, 2, 1), due)).toBe(Date.UTC(2026, 2, 1))
    expect(clampStartAt(Date.UTC(2026, 2, 9), due)).toBe(due)
    expect(clampStartAt(due, due)).toBe(due)
  })
})

describe('deriveScheduleEvents 映射', () => {
  it('跳过 cancelled 与无 dueAt；done 不跳；id 与 issue 1:1', () => {
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', key: 'OAS-1', dueAt: relDay(3, 9) }),
        issue({ id: 'b', key: 'OAS-2', dueAt: null }),
        issue({ id: 'c', key: 'OAS-3', status: 'cancelled', dueAt: relDay(3, 9) }),
        issue({ id: 'd', key: 'OAS-4', status: 'done', dueAt: relDay(4, 0) }),
      ],
      labels,
    )
    expect(events.map((e) => e.id)).toEqual(['a', 'd'])
  })

  it('标题前缀：am/pm 桶前缀在前；未完成且过期加逾期前缀；allday 无桶前缀；done 过期不加逾期', () => {
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', key: 'OAS-1', title: '修复白屏', dueAt: relDay(3, 9) }),
        issue({ id: 'b', key: 'OAS-2', title: '过期上午', dueAt: relDay(-3, 9) }),
        issue({ id: 'c', key: 'OAS-3', title: '过期全天', dueAt: relDay(-3, 0) }),
        issue({ id: 'd', key: 'OAS-4', title: '未来全天', dueAt: relDay(5, 0) }),
        issue({ id: 'e', key: 'OAS-5', title: '过期下午', dueAt: relDay(-3, 14) }),
        issue({
          id: 'f',
          key: 'OAS-6',
          title: '过期已完成',
          status: 'done',
          dueAt: relDay(-3, 9),
        }),
      ],
      labels,
    )
    const by = (id: string) => events.find((e) => e.id === id)
    expect(by('a')?.title).toBe('上午 OAS-1 修复白屏')
    expect(by('b')?.title).toBe('逾期 上午 OAS-2 过期上午')
    expect(by('c')?.title).toBe('逾期 OAS-3 过期全天')
    expect(by('d')?.title).toBe('OAS-4 未来全天')
    expect(by('e')?.title).toBe('逾期 下午 OAS-5 过期下午')
    expect(by('f')?.title).toBe('上午 OAS-6 过期已完成')
  })

  it('date = UTC 日；单事件占桶首 60min 块 09:00–10:00 / 14:00–15:00；allday 无 start/end', () => {
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', dueAt: Date.UTC(2026, 3, 10, 9) }),
        issue({ id: 'd', dueAt: Date.UTC(2026, 3, 10, 14) }),
        issue({ id: 'e', dueAt: Date.UTC(2026, 3, 10, 0) }),
      ],
      labels,
    )
    const by = (id: string) => events.find((x) => x.id === id)
    expect(by('a')?.date).toBe('2026-04-10')
    expect(by('a')).toMatchObject({ start: '09:00', end: '10:00' })
    expect(by('d')).toMatchObject({ start: '14:00', end: '15:00' })
    expect(by('e')?.start).toBeUndefined()
    expect(by('e')?.end).toBeUndefined()
  })

  it('同桶平铺：第 1/2/3 块 60min 递增（09:00–10:00→10:00–11:00→11:00–12:00）；不同桶独立计数', () => {
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', dueAt: Date.UTC(2026, 3, 10, 9) }),
        issue({ id: 'b', dueAt: Date.UTC(2026, 3, 10, 9) }),
        issue({ id: 'c', dueAt: Date.UTC(2026, 3, 10, 9) }),
        issue({ id: 'd', dueAt: Date.UTC(2026, 3, 10, 14) }),
        issue({ id: 'e', dueAt: Date.UTC(2026, 3, 11, 9) }),
      ],
      labels,
    )
    const by = (id: string) => events.find((x) => x.id === id)
    expect(by('a')).toMatchObject({ start: '09:00', end: '10:00' })
    expect(by('b')).toMatchObject({ start: '10:00', end: '11:00' })
    expect(by('c')).toMatchObject({ start: '11:00', end: '12:00' })
    expect(by('d')).toMatchObject({ start: '14:00', end: '15:00' })
    expect(by('e')).toMatchObject({ start: '09:00', end: '10:00' })
  })

  it('组内 3 块无封顶块：全为真实 issue id 且占满 3 槽', () => {
    const events = deriveScheduleEvents(
      Array.from({ length: 3 }, (_, i) => issue({ id: `t${i}`, dueAt: Date.UTC(2026, 3, 10, 14) })),
      labels,
    )
    expect(events.map((e) => `${e.id}:${e.start}-${e.end}`)).toEqual([
      't0:14:00-15:00',
      't1:15:00-16:00',
      't2:16:00-17:00',
    ])
    expect(events.some((e) => e.id.startsWith('__more__'))).toBe(false)
  })

  it('组内 4/8 块（pm 桶）：前 3 块平铺 + 第 4 槽合成封顶块（17:00–18:00，+1 项 / +5 项）', () => {
    const day = utcDay(relDay(5, 14))
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => issue({ id: `x${i}`, dueAt: relDay(5, 14) }))
    const seq = (n: number) =>
      deriveScheduleEvents(mk(n), labels).map((e) => `${e.id}|${e.start}-${e.end}|${e.title}`)
    expect(seq(1)).toEqual(['x0|14:00-15:00|下午 OAS-1 标题'])
    expect(seq(3).map((s) => s.split('|')[1])).toEqual([
      '14:00-15:00',
      '15:00-16:00',
      '16:00-17:00',
    ])
    expect(seq(4)).toEqual([
      'x0|14:00-15:00|下午 OAS-1 标题',
      'x1|15:00-16:00|下午 OAS-1 标题',
      'x2|16:00-17:00|下午 OAS-1 标题',
      `__more__${day}__pm|17:00-18:00|+1 项`,
    ])
    const eight = seq(8)
    expect(eight).toHaveLength(4)
    expect(eight[3]).toBe(`__more__${day}__pm|17:00-18:00|+5 项`)
  })

  it('am 桶仅 3 槽：组内超 3 块时真实块让位 2 块（09/10 槽），封顶块独占 11:00–12:00 不叠印', () => {
    const day = utcDay(relDay(6, 9))
    const events = deriveScheduleEvents(
      Array.from({ length: 5 }, (_, i) => issue({ id: `a${i}`, dueAt: relDay(6, 9) })),
      labels,
    )
    expect(events.map((e) => `${e.id}|${e.start}-${e.end}|${e.title}`)).toEqual([
      'a0|09:00-10:00|上午 OAS-1 标题',
      'a1|10:00-11:00|上午 OAS-1 标题',
      `__more__${day}__am|11:00-12:00|+3 项`,
    ])
  })

  it('labels.more 回调生效：N 透传且同组确定性 id（date+bucket）', () => {
    const seen: number[] = []
    const custom = {
      ...labels,
      more: (n: number) => {
        seen.push(n)
        return `更多 ${n}`
      },
    }
    const pmDay = utcDay(relDay(5, 14))
    const amDay = utcDay(relDay(8, 9))
    const events = deriveScheduleEvents(
      [
        ...Array.from({ length: 6 }, (_, i) => issue({ id: `m${i}`, dueAt: relDay(5, 14) })),
        ...Array.from({ length: 4 }, (_, i) => issue({ id: `n${i}`, dueAt: relDay(8, 9) })),
      ],
      custom,
    )
    const mores = events.filter((e) => e.id.startsWith('__more__'))
    expect(mores.map((e) => `${e.id}=${e.title}`)).toEqual([
      `__more__${pmDay}__pm=更多 3`,
      `__more__${amDay}__am=更多 2`,
    ])
    expect(seen).toEqual([3, 2])
  })

  it('封顶不越桶不叠印：am/pm 桶各 10 块，start/end 均在桶内且任意两块区间不重叠', () => {
    for (const [hour, bucketEnd] of [
      [9, '12:00'],
      [14, '18:00'],
    ] as const) {
      const events = deriveScheduleEvents(
        Array.from({ length: 10 }, (_, i) =>
          issue({ id: `y${i}`, dueAt: Date.UTC(2026, 3, 10, hour) }),
        ),
        labels,
      )
      const spans = events.map((e) => [e.start!, e.end!] as const).sort()
      for (const [s, e] of spans) {
        expect(s < e).toBe(true)
        expect(e <= bucketEnd).toBe(true)
      }
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i]![0] >= spans[i - 1]![1]).toBe(true)
      }
      expect(events.filter((e) => e.id.startsWith('__more__'))).toHaveLength(1)
    }
  })

  it('配色：done → 灰 token；其余按优先级 token', () => {
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', status: 'done', priority: 'urgent', dueAt: relDay(3, 9) }),
        issue({ id: 'b', status: 'todo', priority: 'urgent', dueAt: relDay(3, 9) }),
        issue({ id: 'c', status: 'in_progress', priority: 'low', dueAt: relDay(3, 9) }),
      ],
      labels,
    )
    const by = (id: string) => events.find((x) => x.id === id)
    expect(by('a')?.color).toBe('var(--pm-status-done)')
    expect(by('b')?.color).toBe('var(--pm-priority-urgent)')
    expect(by('c')?.color).toBe('var(--pm-priority-low)')
  })

  it('纯函数：不改写入参', () => {
    const src = [issue({ id: 'a', dueAt: Date.UTC(2026, 3, 10, 9) })]
    const snapshot = JSON.stringify(src)
    deriveScheduleEvents(src, labels)
    expect(JSON.stringify(src)).toBe(snapshot)
  })
})

describe('isBucketMoment / hhmmOf / dueAtWithTime（UTC 全链）', () => {
  it('isBucketMoment 六态：UTC 0:00/9:00/14:00 为真；0:30/10:30/23:59 为假', () => {
    expect(isBucketMoment(Date.UTC(2026, 0, 15, 0, 0))).toBe(true)
    expect(isBucketMoment(Date.UTC(2026, 0, 15, 9, 0))).toBe(true)
    expect(isBucketMoment(Date.UTC(2026, 0, 15, 14, 0))).toBe(true)
    expect(isBucketMoment(Date.UTC(2026, 0, 15, 0, 30))).toBe(false)
    expect(isBucketMoment(Date.UTC(2026, 0, 15, 10, 30))).toBe(false)
    expect(isBucketMoment(Date.UTC(2026, 0, 15, 23, 59))).toBe(false)
  })

  it('hhmmOf 补零与 UTC 口径：0:30→00:30、9:05→09:05、23:59→23:59（UTC+8 零点不漂）', () => {
    expect(hhmmOf(Date.UTC(2026, 0, 16, 0, 30))).toBe('00:30')
    expect(hhmmOf(Date.UTC(2026, 0, 16, 9, 5))).toBe('09:05')
    expect(hhmmOf(Date.UTC(2026, 0, 16, 23, 59))).toBe('23:59')
  })

  it('dueAtWithTime 手拆 Date.UTC 往返：utcDay/hhmmOf 复原，月界不漂', () => {
    const ms = dueAtWithTime('2026-03-07', 10, 30)
    expect(ms).toBe(Date.UTC(2026, 2, 7, 10, 30))
    expect(utcDay(ms)).toBe('2026-03-07')
    expect(hhmmOf(ms)).toBe('10:30')
    expect(isBucketMoment(ms)).toBe(false)
    expect(isBucketMoment(dueAtWithTime('2026-03-07', 9, 0))).toBe(true)
    expect(utcDay(dueAtWithTime('2026-12-31', 23, 45))).toBe('2026-12-31')
  })
})

describe('deriveScheduleEvents 精确时刻（非桶时刻）', () => {
  it('精确时刻事件：start=HH:mm、end=+30min，标题 HH:mm 前缀替代桶前缀', () => {
    const events = deriveScheduleEvents(
      [issue({ id: 'a', key: 'OAS-1', title: '上线窗口', dueAt: relDay(3, 10) + 30 * 60000 })],
      labels,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ start: '10:30', end: '11:00' })
    expect(events[0]!.title).toBe('10:30 OAS-1 上线窗口')
  })

  it('同刻不再错位：同（日, 时刻）第 1/2/3 块全部落在真实 start，区间相同（并排交给组件车道）', () => {
    const at = relDay(4, 15) + 45 * 60000
    const events = deriveScheduleEvents(
      [issue({ id: 'a', dueAt: at }), issue({ id: 'b', dueAt: at }), issue({ id: 'c', dueAt: at })],
      labels,
    )
    const by = (id: string) => events.find((e) => e.id === id)
    for (const id of ['a', 'b', 'c']) {
      expect(by(id)).toMatchObject({ start: '15:45', end: '16:15' })
    }
    expect(by('a')?.title).toBe('15:45 OAS-1 标题')
  })

  it('不同刻不错开：同日 10:30 与 15:45 各占真实时刻', () => {
    const day = relDay(4, 0)
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', dueAt: day + 10 * 3600000 + 30 * 60000 }),
        issue({ id: 'b', dueAt: day + 15 * 3600000 + 45 * 60000 }),
      ],
      labels,
    )
    const by = (id: string) => events.find((e) => e.id === id)
    expect(by('a')).toMatchObject({ start: '10:30', end: '11:00' })
    expect(by('b')).toMatchObject({ start: '15:45', end: '16:15' })
  })

  it('混合组：2 桶事件 + 3 精确事件不出 __more__（精确事件不计桶 groupSize）', () => {
    const day = relDay(5, 0)
    const events = deriveScheduleEvents(
      [
        issue({ id: 'b0', dueAt: day + 9 * 3600000 }),
        issue({ id: 'b1', dueAt: day + 9 * 3600000 }),
        issue({ id: 'p0', dueAt: day + 10 * 3600000 + 30 * 60000 }),
        issue({ id: 'p1', dueAt: day + 15 * 3600000 + 45 * 60000 }),
        issue({ id: 'p2', dueAt: day + 16 * 3600000 + 20 * 60000 }),
      ],
      labels,
    )
    expect(events.some((e) => e.id.startsWith('__more__'))).toBe(false)
    expect(events).toHaveLength(5)
    const by = (id: string) => events.find((e) => e.id === id)
    // 桶事件维持 60min 平铺与桶前缀；精确事件占真实时刻且带 HH:mm 前缀
    expect(by('b0')).toMatchObject({ start: '09:00', end: '10:00' })
    expect(by('b1')).toMatchObject({ start: '10:00', end: '11:00' })
    expect(by('p2')).toMatchObject({ start: '16:20', end: '16:50' })
  })

  it('前缀互斥：精确事件无桶前缀、桶事件无时刻前缀；全天无前缀不变', () => {
    const day = relDay(6, 0)
    const events = deriveScheduleEvents(
      [
        issue({ id: 'p', key: 'OAS-1', title: '精确', dueAt: day + 10 * 3600000 + 30 * 60000 }),
        issue({ id: 'b', key: 'OAS-2', title: '桶', dueAt: day + 9 * 3600000 }),
        issue({ id: 'a', key: 'OAS-3', title: '全天', dueAt: day }),
      ],
      labels,
    )
    const by = (id: string) => events.find((e) => e.id === id)
    expect(by('p')?.title).toBe('10:30 OAS-1 精确')
    expect(by('p')?.title.startsWith('上午 ')).toBe(false)
    expect(by('b')?.title).toBe('上午 OAS-2 桶')
    expect(/^\d{2}:\d{2} /.test(by('b')?.title ?? '')).toBe(false)
    expect(by('a')?.title).toBe('OAS-3 全天')
    expect(by('a')?.start).toBeUndefined()
  })

  it('逾期前缀仍在最前：逾期 10:30 OAS-1 …', () => {
    const past = relDay(-3, 0) + 10 * 3600000 + 30 * 60000
    const events = deriveScheduleEvents(
      [issue({ id: 'a', key: 'OAS-1', title: '迟', dueAt: past })],
      labels,
    )
    expect(events[0]?.title).toBe('逾期 10:30 OAS-1 迟')
  })
})

describe('deriveScheduleEvents 精确同刻组封顶与跨午夜守卫', () => {
  it('同刻 1/3/4/8 块完整序列：前 3 块同一真实区间；第 4 块合成 __more__ 封顶块（8 块 → +5 项）', () => {
    const base = relDay(7, 16) + 18 * 60000
    const day = utcDay(base)
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => issue({ id: `p${i}`, dueAt: base }))
    const seq = (n: number) =>
      deriveScheduleEvents(mk(n), labels).map(
        (e) => `${e.id}|${e.start ?? '全天'}-${e.end ?? ''}|${e.title}`,
      )
    expect(seq(1)).toEqual(['p0|16:18-16:48|16:18 OAS-1 标题'])
    expect(seq(3).map((s) => s.split('|')[1])).toEqual([
      '16:18-16:48',
      '16:18-16:48',
      '16:18-16:48',
    ])
    expect(seq(4)).toEqual([
      'p0|16:18-16:48|16:18 OAS-1 标题',
      'p1|16:18-16:48|16:18 OAS-1 标题',
      'p2|16:18-16:48|16:18 OAS-1 标题',
      `__more__${day}__x:16:18|17:48-18:18|+1 项`,
    ])
    const eight = seq(8)
    expect(eight).toHaveLength(4)
    expect(eight[3]).toBe(`__more__${day}__x:16:18|17:48-18:18|+5 项`)
  })

  it('封顶块配色沿用 muted token；组内恰好 3 块不出封顶块', () => {
    const base = relDay(7, 15) + 45 * 60000
    const four = deriveScheduleEvents(
      Array.from({ length: 4 }, (_, i) => issue({ id: `c${i}`, dueAt: base })),
      labels,
    )
    const cap = four.find((e) => e.id.startsWith('__more__'))
    expect(cap?.color).toBe('var(--pm-status-backlog)')
    const three = deriveScheduleEvents(
      Array.from({ length: 3 }, (_, i) => issue({ id: `c${i}`, dueAt: base })),
      labels,
    )
    expect(three.some((e) => e.id.startsWith('__more__'))).toBe(false)
  })

  it("同刻 start='23:45'：3 块同区间且 end 钳 24:00；第 4 块封顶位置越 24:00 → 落全天带（无 start/end）", () => {
    const base = relDay(8, 23) + 45 * 60000
    const day = utcDay(base)
    const events = deriveScheduleEvents(
      Array.from({ length: 5 }, (_, i) => issue({ id: `m${i}`, dueAt: base })),
      labels,
    )
    const by = (id: string) => events.find((e) => e.id === id)
    for (const id of ['m0', 'm1', 'm2']) {
      expect(by(id)).toMatchObject({ start: '23:45', end: '24:00' })
    }
    expect(by('m0')?.title).toBe('23:45 OAS-1 标题')
    const cap = by(`__more__${day}__x:23:45`)
    expect(cap?.title).toBe('+2 项')
    expect(cap?.start).toBeUndefined()
    expect(cap?.end).toBeUndefined()
  })

  it("start='16:18' × 10 块：无墙无越界——3 块同区间 + 1 封顶块（+7 项），封顶块不越 24:00", () => {
    const base = relDay(9, 16) + 18 * 60000
    const events = deriveScheduleEvents(
      Array.from({ length: 10 }, (_, i) => issue({ id: `w${i}`, dueAt: base })),
      labels,
    )
    expect(events).toHaveLength(4)
    expect(events.filter((e) => e.id.startsWith('__more__'))).toHaveLength(1)
    expect(events[3]?.title).toBe('+7 项')
    const spans = events.map((e) => [e.start!, e.end!] as const)
    // 前 3 块同刻（组件并排），封顶块排在它们下方且不越 24:00
    expect(spans.slice(0, 3)).toEqual([
      ['16:18', '16:48'],
      ['16:18', '16:48'],
      ['16:18', '16:48'],
    ])
    expect(spans[3]![0] >= spans[2]![1]).toBe(true)
    for (const [s, e] of spans) {
      expect(s < e).toBe(true)
      expect(e <= '24:00').toBe(true)
    }
  })

  it('混合组：4 个精确同刻事件触发精确封顶，同日同桶 2 事件平铺不变且桶组不出封顶（口径不变）', () => {
    const day0 = relDay(10, 0)
    const date = utcDay(day0)
    const at = day0 + 9 * 3600000 + 30 * 60000
    const events = deriveScheduleEvents(
      [
        issue({ id: 'b0', dueAt: day0 + 9 * 3600000 }),
        issue({ id: 'b1', dueAt: day0 + 9 * 3600000 }),
        ...Array.from({ length: 4 }, (_, i) => issue({ id: `p${i}`, dueAt: at })),
      ],
      labels,
    )
    const by = (id: string) => events.find((e) => e.id === id)
    expect(by('b0')).toMatchObject({ start: '09:00', end: '10:00' })
    expect(by('b1')).toMatchObject({ start: '10:00', end: '11:00' })
    expect(by(`__more__${date}__am`)).toBeUndefined()
    expect(by(`__more__${date}__x:09:30`)?.title).toBe('+1 项')
    // 同刻前 3 块共享真实区间（并排由组件承担）
    expect(by('p0')).toMatchObject({ start: '09:30', end: '10:00' })
    expect(by('p1')).toMatchObject({ start: '09:30', end: '10:00' })
    expect(by('p2')).toMatchObject({ start: '09:30', end: '10:00' })
    expect(by('p3')).toBeUndefined()
  })

  it('labels.more 回调透传：精确封顶块 N = 总数−3，同组确定性 id（date+HH:mm）', () => {
    const seen: number[] = []
    const custom = {
      ...labels,
      more: (n: number) => {
        seen.push(n)
        return `更多 ${n}`
      },
    }
    const base = relDay(11, 10) + 30 * 60000
    const day = utcDay(base)
    const events = deriveScheduleEvents(
      Array.from({ length: 6 }, (_, i) => issue({ id: `q${i}`, dueAt: base })),
      custom,
    )
    const mores = events.filter((e) => e.id.startsWith('__more__'))
    expect(mores.map((e) => `${e.id}=${e.title}`)).toEqual([`__more__${day}__x:10:30=更多 3`])
    expect(seen).toEqual([3])
  })
})

describe('scheduleSignature 回声对拍签名', () => {
  const ev = (id: string, date: string, start?: string): ScheduleEvent => ({
    id,
    date,
    title: `T-${id}`,
    start,
  })

  it('同输入两次相等；顺序无关（按 id 排序）', () => {
    const a = [
      ev('a', '2026-01-01'),
      ev('b', '2026-01-02', '09:00'),
      ev('c', '2026-01-03', '14:30'),
    ]
    expect(scheduleSignature(a)).toBe(scheduleSignature([...a].reverse()))
  })

  it('date/start/end 变化 → 签名变化', () => {
    const base = [ev('a', '2026-01-02', '09:00')]
    expect(scheduleSignature([ev('a', '2026-01-03', '09:00')])).not.toBe(scheduleSignature(base))
    expect(scheduleSignature([ev('a', '2026-01-02', '09:30')])).not.toBe(scheduleSignature(base))
    expect(scheduleSignature([ev('a', '2026-01-02')])).not.toBe(scheduleSignature(base))
    expect(
      scheduleSignature([
        { id: 'a', date: '2026-01-02', title: 'T-a', start: '09:00', end: '10:00' },
      ]),
    ).not.toBe(scheduleSignature(base))
  })

  it('title 变化 → 签名变化（防陈旧 chip 文案）', () => {
    const base = [ev('a', '2026-01-02', '09:00')]
    expect(
      scheduleSignature([{ id: 'a', date: '2026-01-02', title: '改名', start: '09:00' }]),
    ).not.toBe(scheduleSignature(base))
  })

  it('color 变化 → 签名变化（转 done/改优先级后 chip 配色跟进）', () => {
    const base = [ev('a', '2026-01-02', '09:00')]
    expect(
      scheduleSignature([
        {
          id: 'a',
          date: '2026-01-02',
          title: 'T-a',
          start: '09:00',
          color: 'var(--pm-status-done)',
        },
      ]),
    ).not.toBe(scheduleSignature(base))
  })
})
