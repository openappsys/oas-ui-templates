import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, parseFilters } from './filters'
import {
  DEMO_SAVED_VIEWS,
  byCreatedDesc,
  demoSavedViewFilters,
  demoSavedViewRows,
} from './saved-views'

const NOW = 1_700_000_000_000

describe('示例保存视图', () => {
  it('两个视图：我 + 进行中 / 紧急高 + 待办积压', () => {
    const rows = demoSavedViewRows(NOW)
    expect(rows.map((r) => r.id)).toEqual(['view-demo-1', 'view-demo-2'])

    const mine = parseFilters(rows[0]!.filters)
    expect(mine?.myOnly).toBe(true)
    expect(mine?.statusFilter).toEqual(['in_progress'])
    expect(mine?.priorityFilter).toEqual([])

    const high = parseFilters(rows[1]!.filters)
    expect(high?.myOnly).toBe(false)
    expect(high?.priorityFilter).toEqual(['urgent', 'high'])
    expect(high?.statusFilter).toEqual(['todo', 'backlog'])
  })

  it('其余字段取 DEFAULT_FILTERS，search 不进视图', () => {
    const raw = JSON.parse(demoSavedViewFilters({ statusFilter: ['todo'] })) as Record<
      string,
      unknown
    >
    const { search: _search, ...rest } = DEFAULT_FILTERS
    expect(raw).toEqual({ ...rest, statusFilter: ['todo'] })
    expect('search' in raw).toBe(false)
  })

  it('创建时刻按天回推：第二个视图更新', () => {
    const rows = demoSavedViewRows(NOW)
    expect(rows[0]!.createdAt).toBe(NOW - 2 * 86_400_000)
    expect(rows[1]!.createdAt).toBe(NOW - 86_400_000)
    // 名称纯中文（与其它 seed 数据一致，避免侧栏截断）
    expect(DEMO_SAVED_VIEWS.every((v) => v.name.length > 0 && !v.name.includes(' / '))).toBe(true)
  })
})

describe('byCreatedDesc', () => {
  const rows = demoSavedViewRows(NOW)

  it('按创建时间倒序（最近在前）', () => {
    expect(byCreatedDesc(rows).map((r) => r.id)).toEqual(['view-demo-2', 'view-demo-1'])
  })

  it('不修改入参，空/未就绪返回空数组', () => {
    const input = [...rows]
    byCreatedDesc(input)
    expect(input.map((r) => r.id)).toEqual(['view-demo-1', 'view-demo-2'])
    expect(byCreatedDesc(undefined)).toEqual([])
  })
})
