import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, normalizeFilters, parseFilters, toggleIn, UNASSIGNED } from './filters'

describe('normalizeFilters', () => {
  it('旧单值结构归一为单元素数组', () => {
    expect(
      normalizeFilters({
        projectId: 'project-2',
        statusFilter: 'todo',
        assigneeFilter: 'member-3',
        priorityFilter: 'urgent',
        myOnly: true,
        sortBy: 'priority',
      }),
    ).toEqual({
      projectId: 'project-2',
      statusFilter: ['todo'],
      assigneeFilter: ['member-3'],
      priorityFilter: ['urgent'],
      search: '',
      myOnly: true,
      sortBy: 'priority',
    })
  })

  it('旧 null / 缺失字段归一为空数组（＝该维度不限）', () => {
    expect(
      normalizeFilters({
        projectId: 'project-1',
        statusFilter: null,
        assigneeFilter: null,
        priorityFilter: null,
      }),
    ).toEqual(DEFAULT_FILTERS)
    expect(normalizeFilters({})).toEqual(DEFAULT_FILTERS)
  })

  it('新结构原样保留（含 __none__ 未分配）', () => {
    const f = normalizeFilters({
      projectId: 'project-3',
      statusFilter: ['todo', 'done'],
      assigneeFilter: [UNASSIGNED, 'member-2'],
      priorityFilter: ['high', 'low'],
      myOnly: false,
      sortBy: 'createdAt',
    })
    expect(f.statusFilter).toEqual(['todo', 'done'])
    expect(f.assigneeFilter).toEqual(['__none__', 'member-2'])
    expect(f.priorityFilter).toEqual(['high', 'low'])
    expect(f.sortBy).toBe('createdAt')
  })

  it('非法值丢弃、重复值去重、非字符串忽略', () => {
    const f = normalizeFilters({
      statusFilter: ['todo', 'bogus', 'todo', 42, null, 'done'],
      priorityFilter: ['urgent', 'nope'],
      assigneeFilter: ['member-1', 'member-1', '', 7],
      sortBy: 'random',
      myOnly: 'yes',
    })
    expect(f.statusFilter).toEqual(['todo', 'done'])
    expect(f.priorityFilter).toEqual(['urgent'])
    expect(f.assigneeFilter).toEqual(['member-1'])
    expect(f.sortBy).toBe('updatedAt')
    expect(f.myOnly).toBe(false)
  })

  it('非对象输入退化为默认值', () => {
    for (const raw of [null, undefined, 'x', 42, ['todo'], true]) {
      expect(normalizeFilters(raw)).toEqual(DEFAULT_FILTERS)
    }
  })
})

describe('parseFilters', () => {
  it('JSON 损坏返回 null（调用方保持当前筛选）', () => {
    expect(parseFilters('{oops')).toBeNull()
  })

  it('合法 JSON 走归一（旧视图可直接应用）', () => {
    expect(parseFilters(JSON.stringify({ statusFilter: 'done', priorityFilter: null }))).toEqual({
      ...DEFAULT_FILTERS,
      statusFilter: ['done'],
    })
  })
})

describe('toggleIn', () => {
  it('未选中追加、已选中移除（保持点击顺序）', () => {
    const a = toggleIn<string>([], 'todo')
    expect(a).toEqual(['todo'])
    const b = toggleIn(a, 'done')
    expect(b).toEqual(['todo', 'done'])
    expect(toggleIn(b, 'todo')).toEqual(['done'])
  })
})
