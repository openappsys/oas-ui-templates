import { describe, expect, it } from 'vitest'
import type { Issue, Member } from '@/types'
import { UNASSIGNED_ID, toResourceData } from './resource-data'

const member = (id: string, name: string): Member => ({
  id,
  name,
  email: `${id}@oas.dev`,
  avatarColor: '#0b6cff',
  role: 'member',
})

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

const members = [member('m-1', '张伟'), member('m-2', '李娜')]

describe('toResourceData 资源映射', () => {
  it('无任务资源行被过滤：只保留有任务的成员与未分配行', () => {
    const due = Date.UTC(2026, 0, 20)
    const { resources, tasks } = toResourceData(
      [member('m-1', '张伟'), member('m-2', '李娜'), member('m-3', '王强')],
      [
        issue({ id: 'a', key: 'OAS-1', dueAt: due, assigneeId: 'm-1' }),
        issue({ id: 'b', key: 'OAS-2', dueAt: due, assigneeId: null }),
      ],
      '未分配',
    )
    expect(resources).toEqual([
      { id: 'm-1', name: '张伟', capacity: 1 },
      { id: UNASSIGNED_ID, name: '未分配', capacity: 1 },
    ])
    expect(tasks).toHaveLength(2)
  })

  it('全部为空时 resources 为空数组', () => {
    const { resources } = toResourceData(members, [], '未分配')
    expect(resources).toEqual([])
  })

  it('仅收未完成且有截止日的 Issue（done/cancelled/无 dueAt 剔除）', () => {
    const due = Date.UTC(2026, 0, 20)
    const { tasks } = toResourceData(
      members,
      [
        issue({ id: 'a', key: 'OAS-1', dueAt: due }),
        issue({ id: 'b', key: 'OAS-2', dueAt: due, status: 'done' }),
        issue({ id: 'c', key: 'OAS-3', dueAt: due, status: 'cancelled' }),
        issue({ id: 'd', key: 'OAS-4', dueAt: null }),
      ],
      '未分配',
    )
    expect(tasks.map((t) => t.id)).toEqual(['a'])
  })

  it('name = key + 空格 + 标题；start 取 startAt ?? createdAt、end 取 dueAt，均为 YYYY-MM-DD', () => {
    const { tasks } = toResourceData(
      members,
      [
        issue({
          id: 'a',
          key: 'OAS-7',
          title: '修复白屏',
          startAt: Date.UTC(2026, 1, 1, 23, 59),
          dueAt: Date.UTC(2026, 2, 5),
        }),
        issue({ id: 'b', key: 'OAS-8', title: '无开始', dueAt: Date.UTC(2026, 2, 6) }),
      ],
      '未分配',
    )
    const a = tasks.find((t) => t.id === 'a')
    expect(a?.name).toBe('OAS-7 修复白屏')
    expect(a?.start).toBe('2026-02-01')
    expect(a?.end).toBe('2026-03-05')
    const b = tasks.find((t) => t.id === 'b')
    expect(b?.start).toBe('2026-01-10')
    expect(b?.end).toBe('2026-03-06')
  })

  it('assignee 映射：assigneeId → [id]；null → [__unassigned__]', () => {
    const due = Date.UTC(2026, 0, 20)
    const { tasks } = toResourceData(
      members,
      [
        issue({ id: 'a', dueAt: due, assigneeId: 'm-2' }),
        issue({ id: 'b', dueAt: due, assigneeId: null }),
      ],
      '未分配',
    )
    expect(tasks.find((t) => t.id === 'a')?.resources).toEqual(['m-2'])
    expect(tasks.find((t) => t.id === 'b')?.resources).toEqual([UNASSIGNED_ID])
  })

  it('按 end 升序排序且上限 200 条（最早截止的留下）', () => {
    const batch: Issue[] = Array.from({ length: 250 }, (_, i) =>
      issue({ id: `i-${i}`, key: `OAS-${i + 1}`, dueAt: Date.UTC(2026, 0, 1) + i * 86400000 }),
    )
    const shuffled = [...batch].reverse()
    const { tasks } = toResourceData(members, shuffled, '未分配')
    expect(tasks).toHaveLength(200)
    for (let i = 1; i < tasks.length; i++) expect(tasks[i - 1].end <= tasks[i].end).toBe(true)
    expect(tasks[0].id).toBe('i-0')
    expect(tasks[199].id).toBe('i-199')
    expect(tasks.some((t) => t.id === 'i-200')).toBe(false)
  })

  it('纯函数：不改写入参', () => {
    const src = [issue({ id: 'a', dueAt: Date.UTC(2026, 0, 20) })]
    const snapshot = JSON.stringify(src)
    toResourceData(members, src, '未分配')
    expect(JSON.stringify(src)).toBe(snapshot)
  })
})
