import { describe, expect, it } from 'vitest'
import type { Issue } from '@/types'
import {
  bucketOf,
  bucketToDueAt,
  clampStartAt,
  deriveScheduleEvents,
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

const labels = { am: '上午 ', pm: '下午 ', overdue: '逾期 ' }

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
          dueAt: relDay(-3, 10),
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

  it('date = UTC 日；单事件占桶首 30min 窄条 09:00–09:30 / 14:00–14:30；allday 无 start/end', () => {
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
    expect(by('a')).toMatchObject({ start: '09:00', end: '09:30' })
    expect(by('d')).toMatchObject({ start: '14:00', end: '14:30' })
    expect(by('e')?.start).toBeUndefined()
    expect(by('e')?.end).toBeUndefined()
  })

  it('同桶平铺：第 1/2/3 块 30min 窄条递增（09:00–09:30→09:30–10:00→10:00–10:30）；不同桶独立计数', () => {
    const events = deriveScheduleEvents(
      [
        issue({ id: 'a', dueAt: Date.UTC(2026, 3, 10, 9) }),
        issue({ id: 'b', dueAt: Date.UTC(2026, 3, 10, 9) }),
        issue({ id: 'c', dueAt: Date.UTC(2026, 3, 10, 11) }),
        issue({ id: 'd', dueAt: Date.UTC(2026, 3, 10, 14) }),
        issue({ id: 'e', dueAt: Date.UTC(2026, 3, 11, 9) }),
      ],
      labels,
    )
    const by = (id: string) => events.find((x) => x.id === id)
    expect(by('a')).toMatchObject({ start: '09:00', end: '09:30' })
    expect(by('b')).toMatchObject({ start: '09:30', end: '10:00' })
    expect(by('c')).toMatchObject({ start: '10:00', end: '10:30' })
    expect(by('d')).toMatchObject({ start: '14:00', end: '14:30' })
    expect(by('e')).toMatchObject({ start: '09:00', end: '09:30' })
  })

  it('平铺封顶：同桶 6 块时第 6 块占桶尾槽 11:30–12:00；8 块时第 6/7/8 块同为 11:30–12:00', () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => issue({ id: `x${i}`, dueAt: Date.UTC(2026, 3, 10, 9) }))
    const seq = (n: number) => deriveScheduleEvents(mk(n), labels).map((e) => `${e.start}-${e.end}`)
    expect(seq(1)).toEqual(['09:00-09:30'])
    expect(seq(2)).toEqual(['09:00-09:30', '09:30-10:00'])
    expect(seq(6)).toEqual([
      '09:00-09:30',
      '09:30-10:00',
      '10:00-10:30',
      '10:30-11:00',
      '11:00-11:30',
      '11:30-12:00',
    ])
    expect(seq(8)).toEqual([
      '09:00-09:30',
      '09:30-10:00',
      '10:00-10:30',
      '10:30-11:00',
      '11:00-11:30',
      '11:30-12:00',
      '11:30-12:00',
      '11:30-12:00',
    ])
  })

  it('封顶不越桶：am/pm 桶任意数量事件 start/end 均不越过桶尾（pm 第 6 块起同为 17:30–18:00）', () => {
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
      for (const e of events) {
        expect(e.start! < e.end!).toBe(true)
        expect(e.end! <= bucketEnd).toBe(true)
      }
    }
    const pm = deriveScheduleEvents(
      Array.from({ length: 6 }, (_, i) => issue({ id: `z${i}`, dueAt: Date.UTC(2026, 3, 10, 14) })),
      labels,
    )
    expect(pm[5]).toMatchObject({ start: '17:30', end: '18:00' })
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
