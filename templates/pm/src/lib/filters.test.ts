import { describe, expect, it } from 'vitest'
import { CURRENT_CYCLE, NO_CYCLE } from './cycles'
import {
  ALL_PROJECTS,
  DEFAULT_FILTERS,
  hasActiveFilters,
  normalizeFilters,
  parseFilters,
  toggleIn,
  UNASSIGNED,
} from './filters'

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
      labelFilter: [],
      search: '',
      myOnly: true,
      sortBy: 'priority',
      cycleFilter: null,
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

  it('全部项目哨兵合法保留（保存视图可存读）', () => {
    const f = normalizeFilters({ projectId: ALL_PROJECTS, statusFilter: ['todo'] })
    expect(f.projectId).toBe('__all__')
    expect(normalizeFilters(JSON.parse(JSON.stringify(f)))).toEqual(f)
    // 空串仍回退默认项目，不会被当成「全部项目」
    expect(normalizeFilters({ projectId: '' }).projectId).toBe(DEFAULT_FILTERS.projectId)
  })

  it('cycleFilter 三态：缺省/空串 → null（全部迭代），哨兵与任意 id 原样保留', () => {
    // 旧视图没有该字段
    expect(normalizeFilters({ projectId: 'project-1' }).cycleFilter).toBeNull()
    expect(normalizeFilters({ cycleFilter: null }).cycleFilter).toBeNull()
    expect(normalizeFilters({ cycleFilter: '' }).cycleFilter).toBeNull()
    expect(normalizeFilters({ cycleFilter: 42 }).cycleFilter).toBeNull()
    expect(normalizeFilters({ cycleFilter: CURRENT_CYCLE }).cycleFilter).toBe('__current__')
    expect(normalizeFilters({ cycleFilter: NO_CYCLE }).cycleFilter).toBe('__none__')
    // 周期 id 无法穷举校验：任意非空字符串保留
    expect(normalizeFilters({ cycleFilter: 'cycle-3' }).cycleFilter).toBe('cycle-3')
    // 保存视图往返不丢
    const f = normalizeFilters({ cycleFilter: 'cycle-3' })
    expect(normalizeFilters(JSON.parse(JSON.stringify(f)))).toEqual(f)
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

describe('hasActiveFilters', () => {
  it('默认筛选（仅作用域）不算生效筛选', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('任一维度非空即生效', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, statusFilter: ['todo'] })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, priorityFilter: ['urgent'] })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, assigneeFilter: ['member-1'] })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, cycleFilter: 'cycle-1' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, myOnly: true })).toBe(true)
  })

  it('项目作用域不是筛选（换项目不清筛选高亮）', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, projectId: ALL_PROJECTS })).toBe(false)
  })
})
