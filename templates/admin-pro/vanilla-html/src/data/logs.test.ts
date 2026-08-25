import { beforeEach, describe, expect, it } from 'vitest'
import { listLogs, resetLogs } from './logs'
import type { LogEntry, LogLevel } from './logs'

const LEVELS: LogLevel[] = ['info', 'warn', 'error']

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

describe('logs 数据源', () => {
  beforeEach(() => resetLogs())

  it('listLogs 返回 5000 条种子日志', async () => {
    const rows = await listLogs()
    expect(rows.length).toBe(5000)
  })

  it('日志条目包含完整字段且 id 唯一', async () => {
    const rows = await listLogs()
    const ids = new Set<string>()
    for (const r of rows) {
      expect(r.id).toMatch(/^log-\d+$/)
      expect(LEVELS).toContain(r.level)
      expect(r.operator.length).toBeGreaterThan(0)
      expect(r.action.length).toBeGreaterThan(0)
      expect(r.IP).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
      expect(Number.isFinite(new Date(r.time).getTime())).toBe(true)
      expect(ids.has(r.id)).toBe(false)
      ids.add(r.id)
    }
  })

  it('时间分布在近 7 天内', async () => {
    const rows = await listLogs()
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    for (const r of rows) {
      const t = new Date(r.time).getTime()
      expect(t).toBeGreaterThanOrEqual(sevenDaysAgo)
      expect(t).toBeLessThanOrEqual(now + 60 * 1000)
    }
  })

  it('reset 后重新生成 5000 条', async () => {
    const first = await listLogs()
    const id0 = first[0].id
    resetLogs()
    const second = await listLogs()
    expect(second.length).toBe(5000)
    expect(second[0].id).not.toBe(id0)
  })

  it('level 过滤仅返回指定级别', async () => {
    for (const level of LEVELS) {
      const rows = await listLogs({ level })
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) expect(r.level).toBe(level)
    }
  })

  it('关键词过滤同时匹配操作人/动作/IP', async () => {
    const all = await listLogs()
    const target = all.find((r) => r.level === 'info')!
    const rows = await listLogs({ keyword: target.operator })
    expect(rows.every((r) => r.operator.includes(target.operator))).toBe(true)
    const actionRows = await listLogs({ keyword: target.action })
    expect(actionRows.every((r) => r.action.includes(target.action))).toBe(true)
  })

  it('日期范围过滤落在区间内', async () => {
    const all = await listLogs()
    const dates = all.map((r) => iso(new Date(r.time))).sort()
    const start = dates[1000]
    const end = dates[2000]
    const rows = await listLogs({ dateRange: [start, end] })
    for (const r of rows) {
      const d = iso(new Date(r.time))
      expect(d >= start && d <= end).toBe(true)
    }
  })

  it('组合过滤生效', async () => {
    const all = await listLogs()
    const target = all.find((r) => r.level === 'error')!
    const d = iso(new Date(target.time))
    const rows = await listLogs({
      level: 'error',
      keyword: target.operator,
      dateRange: [d, d],
    })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.level).toBe('error')
      expect(r.operator).toContain(target.operator)
      expect(iso(new Date(r.time))).toBe(d)
    }
  })

  it('过滤不命中时返回空数组', async () => {
    const rows = await listLogs({ keyword: '不可能存在的关键字xyz' })
    expect(rows.length).toBe(0)
  })
})
