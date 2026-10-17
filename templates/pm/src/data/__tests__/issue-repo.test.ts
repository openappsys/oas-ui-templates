import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieIssueRepository } from '@/data/dexie/issue-repo'
import type { Issue } from '@/types'

function seedIssue(_db: PMDatabase, over: Partial<Issue> = {}): Issue {
  return {
    id: over.id ?? crypto.randomUUID(),
    projectId: 'p1',
    key: 'OAS-1',
    title: 't',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    reporterId: 'm1',
    labels: [],
    startAt: null,
    dueAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    order: 0,
    ...over,
  }
}

describe('dexie issue repository', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  it('create 分配严格递增 key 并落库', async () => {
    await db.projects.add({
      id: 'p1',
      name: 'P',
      key: 'OAS',
      description: '',
      leadId: 'm1',
      createdAt: 0,
      nextKeyNum: 100001,
    })
    const repo = createDexieIssueRepository(db)
    const a = await repo.create({
      projectId: 'p1',
      title: 'A',
      status: 'todo',
      priority: 'low',
      assigneeId: null,
      reporterId: 'm1',
    })
    const b = await repo.create({
      projectId: 'p1',
      title: 'B',
      status: 'todo',
      priority: 'low',
      assigneeId: null,
      reporterId: 'm1',
    })
    expect(a.key).toBe('OAS-100001')
    expect(b.key).toBe('OAS-100002')
  })

  it('create 项目不存在时回退 OAS key（沿用 App 语义）', async () => {
    const repo = createDexieIssueRepository(db)
    const created = await repo.create({
      projectId: 'ghost',
      title: 'X',
      status: 'todo',
      priority: 'low',
      assigneeId: null,
      reporterId: 'm1',
    })
    expect(created.key).toBe('OAS-100001')
  })

  it('update/delete 生效', async () => {
    const it0 = seedIssue(db, { id: 'i1' })
    await db.issues.add(it0)
    const repo = createDexieIssueRepository(db)
    await repo.update('i1', { status: 'done' })
    expect((await repo.get('i1'))?.status).toBe('done')
    await repo.delete('i1')
    expect(await repo.get('i1')).toBeUndefined()
  })

  it('liveCounts 统计全项目各状态计数', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'a', status: 'todo' }),
      seedIssue(db, { id: 'b', status: 'todo' }),
      seedIssue(db, { id: 'c', status: 'done' }),
      seedIssue(db, { id: 'd', status: 'done', projectId: 'p2' }),
    ])
    const repo = createDexieIssueRepository(db)
    const counts = await new Promise<{ total: number; byStatus: Record<string, number> }>(
      (resolve) => {
        const unsub = repo.liveCounts('p1').subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
      },
    )
    expect(counts.total).toBe(3)
    expect(counts.byStatus.todo).toBe(2)
    expect(counts.byStatus.done).toBe(1)
  })

  it('liveWindow 无状态筛选走 [projectId+updatedAt] 窗口且 myOnly/优先级筛选生效', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'w1', updatedAt: now - 1000, assigneeId: 'm1', priority: 'low' }),
      seedIssue(db, { id: 'w2', updatedAt: now - 500, assigneeId: 'm2', priority: 'urgent' }),
      seedIssue(db, {
        id: 'w3',
        updatedAt: now - 100,
        assigneeId: 'm1',
        priority: 'high',
        projectId: 'p2',
      }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: 'p1',
            statusFilter: null,
            assigneeFilter: 'm1',
            priorityFilter: null,
            search: '',
            myOnly: false,
            sortBy: 'updatedAt',
          },
          'm1',
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
    })
    expect(rows.map((r) => r.id)).toEqual(['w1'])
  })

  it('liveWindow sortBy=priority 按权重升序', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 's1', updatedAt: now - 300, priority: 'low' }),
      seedIssue(db, { id: 's2', updatedAt: now - 200, priority: 'urgent' }),
      seedIssue(db, { id: 's3', updatedAt: now - 100, priority: 'high' }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: 'p1',
            statusFilter: null,
            assigneeFilter: null,
            priorityFilter: null,
            search: '',
            myOnly: false,
            sortBy: 'priority',
          },
          'm1',
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
    })
    expect(rows.map((r) => r.priority)).toEqual(['urgent', 'high', 'low'])
  })

  it('liveWindow statusFilter 走复合索引且按 updatedAt 倒序、跨项目隔离', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 't1', status: 'todo', updatedAt: now - 300 }),
      seedIssue(db, { id: 't2', status: 'todo', updatedAt: now - 100 }),
      seedIssue(db, { id: 't3', status: 'done', updatedAt: now - 50 }),
      seedIssue(db, { id: 't4', status: 'todo', updatedAt: now - 10, projectId: 'p2' }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: 'p1',
            statusFilter: 'todo',
            assigneeFilter: null,
            priorityFilter: null,
            search: '',
            myOnly: false,
            sortBy: 'updatedAt',
          },
          'm1',
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
    })
    expect(rows.map((r) => r.id)).toEqual(['t2', 't1'])
  })

  it('liveWindow search 跨项目全表匹配（沿用 App 语义）', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'q1', title: '修复登录白屏' }),
      seedIssue(db, { id: 'q2', title: '修复登录白屏', projectId: 'p2' }),
      seedIssue(db, { id: 'q3', title: '无关标题' }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: 'p1',
            statusFilter: null,
            assigneeFilter: null,
            priorityFilter: null,
            search: '登录',
            myOnly: false,
            sortBy: 'updatedAt',
          },
          'm1',
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
    })
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(['q1', 'q2']))
  })

  it('bulkGet 返回与入参对齐的数组（含 undefined 洞）', async () => {
    await db.issues.bulkAdd([seedIssue(db, { id: 'g1' }), seedIssue(db, { id: 'g2' })])
    const repo = createDexieIssueRepository(db)
    const rows = await repo.bulkGet(['g2', 'missing', 'g1'])
    expect(rows.length).toBe(3)
    expect(rows[0]?.id).toBe('g2')
    expect(rows[1]).toBeUndefined()
    expect(rows[2]?.id).toBe('g1')
  })

  it('updateMany 单事务批量更新并盖 updatedAt', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'u1', status: 'todo' }),
      seedIssue(db, { id: 'u2', status: 'todo' }),
    ])
    const repo = createDexieIssueRepository(db)
    await repo.updateMany([
      { id: 'u1', changes: { status: 'done' } },
      { id: 'u2', changes: { priority: 'urgent' } },
    ])
    expect((await repo.get('u1'))?.status).toBe('done')
    expect((await repo.get('u2'))?.priority).toBe('urgent')
    expect((await repo.get('u1'))!.updatedAt).toBeGreaterThan(1000)
  })

  it('bulkApply 事务内写活动并落补丁（assignee null 化）', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'b1', status: 'todo' }),
      seedIssue(db, { id: 'b2', status: 'todo' }),
    ])
    const repo = createDexieIssueRepository(db)
    await repo.bulkApply(['b1', 'b2'], { status: 'done', assigneeId: null }, 'm9')
    for (const id of ['b1', 'b2']) {
      expect((await repo.get(id))?.status).toBe('done')
      expect((await repo.get(id))?.assigneeId).toBeNull()
    }
    const acts = await db.activities.toArray()
    expect(acts.length).toBe(4)
    expect(acts.filter((a) => a.type === 'status' && a.to === 'done').length).toBe(2)
    expect(
      acts.filter((a) => a.type === 'assignee' && a.field === 'assigneeId' && a.to === '').length,
    ).toBe(2)
    expect(acts.every((a) => a.actorId === 'm9')).toBe(true)
  })

  it('bulkApply 无补丁字段时不写活动', async () => {
    await db.issues.bulkAdd([seedIssue(db, { id: 'n1' })])
    const repo = createDexieIssueRepository(db)
    await repo.bulkApply(['n1'], {}, 'm9')
    expect((await db.activities.toArray()).length).toBe(0)
  })

  it('bulkDelete 批量删除', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'd1' }),
      seedIssue(db, { id: 'd2' }),
      seedIssue(db, { id: 'd3' }),
    ])
    const repo = createDexieIssueRepository(db)
    await repo.bulkDelete(['d1', 'd3'])
    expect(await repo.get('d1')).toBeUndefined()
    expect(await repo.get('d2')).toBeDefined()
    expect(await repo.get('d3')).toBeUndefined()
  })

  it('liveAssigneeWorkload 按成员计数且跳过未分配', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'k1', assigneeId: 'm1' }),
      seedIssue(db, { id: 'k2', assigneeId: 'm1' }),
      seedIssue(db, { id: 'k3', assigneeId: 'm2' }),
      seedIssue(db, { id: 'k4', assigneeId: null }),
      seedIssue(db, { id: 'k5', assigneeId: 'm1', projectId: 'p2' }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await new Promise<Array<{ memberId: string; count: number }>>((resolve) => {
      const unsub = repo.liveAssigneeWorkload('p1').subscribe({
        next: (v) => {
          resolve(v)
          unsub()
        },
      })
    })
    const map = new Map(rows.map((r) => [r.memberId, r.count]))
    expect(map.get('m1')).toBe(2)
    expect(map.get('m2')).toBe(1)
    expect(rows.some((r) => r.memberId === '')).toBe(false)
  })
})
