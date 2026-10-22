import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieIssueRepository } from '@/data/dexie/issue-repo'
import type { IssueWindowFilters } from '@/data/types'
import { ALL_PROJECTS } from '@/lib/filters'
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

  /** 取 liveWindow 首个快照 */
  const windowRows = (
    repo: ReturnType<typeof createDexieIssueRepository>,
    filters: Partial<IssueWindowFilters> = {},
    currentUser = 'm1',
    limit?: number,
  ): Promise<Issue[]> =>
    new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: 'p1',
            statusFilter: [],
            assigneeFilter: [],
            priorityFilter: [],
            search: '',
            myOnly: false,
            cycleFilter: null,
            sortBy: 'updatedAt',
            ...filters,
          },
          currentUser,
          limit,
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
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
            statusFilter: [],
            assigneeFilter: ['m1'],
            priorityFilter: [],
            search: '',
            myOnly: false,
            cycleFilter: null,
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
            statusFilter: [],
            assigneeFilter: [],
            priorityFilter: [],
            search: '',
            myOnly: false,
            cycleFilter: null,
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
            statusFilter: ['todo'],
            assigneeFilter: [],
            priorityFilter: [],
            search: '',
            myOnly: false,
            cycleFilter: null,
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

  it('liveWindow 状态多选：组内 OR、updatedAt 倒序、跨项目隔离、limit 截断', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'm1', status: 'todo', updatedAt: now - 500 }),
      seedIssue(db, { id: 'm2', status: 'done', updatedAt: now - 400 }),
      seedIssue(db, { id: 'm3', status: 'backlog', updatedAt: now - 300 }),
      seedIssue(db, { id: 'm4', status: 'in_progress', updatedAt: now - 200 }),
      seedIssue(db, { id: 'm5', status: 'done', updatedAt: now - 100 }),
      seedIssue(db, { id: 'm6', status: 'todo', updatedAt: now - 10, projectId: 'p2' }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await windowRows(repo, { statusFilter: ['todo', 'done'] })
    expect(rows.map((r) => r.id)).toEqual(['m5', 'm2', 'm1'])
    // 索引分片按状态各取 limit 条，归并后仍按 updatedAt 截断
    const limited = await windowRows(repo, { statusFilter: ['todo', 'done'] }, 'm1', 2)
    expect(limited.map((r) => r.id)).toEqual(['m5', 'm2'])
  })

  it('liveWindow 组间 AND：状态集合 × 负责人集合', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'a1', status: 'todo', assigneeId: 'm1', updatedAt: now - 400 }),
      seedIssue(db, { id: 'a2', status: 'todo', assigneeId: 'm2', updatedAt: now - 300 }),
      seedIssue(db, { id: 'a3', status: 'done', assigneeId: 'm2', updatedAt: now - 200 }),
      seedIssue(db, { id: 'a4', status: 'done', assigneeId: 'm3', updatedAt: now - 100 }),
      seedIssue(db, { id: 'a5', status: 'cancelled', assigneeId: 'm1', updatedAt: now - 50 }),
    ])
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo, { statusFilter: ['todo', 'done'] })).map((r) => r.id)).toEqual([
      'a4',
      'a3',
      'a2',
      'a1',
    ])
    expect(
      (
        await windowRows(repo, {
          statusFilter: ['todo', 'done'],
          assigneeFilter: ['m1', 'm2'],
        })
      ).map((r) => r.id),
    ).toEqual(['a3', 'a2', 'a1'])
    // 负责人维度的「全部」＝空数组，不参与 AND
    expect((await windowRows(repo, { assigneeFilter: [] })).map((r) => r.id)).toEqual([
      'a5',
      'a4',
      'a3',
      'a2',
      'a1',
    ])
  })

  it('liveWindow 负责人多选支持 __none__（未分配）', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'n1', assigneeId: null, updatedAt: now - 300 }),
      seedIssue(db, { id: 'n2', assigneeId: 'm1', updatedAt: now - 200 }),
      seedIssue(db, { id: 'n3', assigneeId: 'm2', updatedAt: now - 100 }),
    ])
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo, { assigneeFilter: ['__none__'] })).map((r) => r.id)).toEqual([
      'n1',
    ])
    expect(
      (await windowRows(repo, { assigneeFilter: ['__none__', 'm2'] })).map((r) => r.id),
    ).toEqual(['n3', 'n1'])
  })

  it('liveWindow 优先级多选：组内 OR 且与状态/负责人 AND', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, {
        id: 'p1a',
        status: 'todo',
        priority: 'urgent',
        assigneeId: 'm1',
        updatedAt: now - 500,
      }),
      seedIssue(db, {
        id: 'p1b',
        status: 'todo',
        priority: 'high',
        assigneeId: 'm1',
        updatedAt: now - 400,
      }),
      seedIssue(db, {
        id: 'p1c',
        status: 'todo',
        priority: 'low',
        assigneeId: 'm1',
        updatedAt: now - 300,
      }),
      seedIssue(db, {
        id: 'p1d',
        status: 'done',
        priority: 'urgent',
        assigneeId: 'm1',
        updatedAt: now - 200,
      }),
      seedIssue(db, {
        id: 'p1e',
        status: 'todo',
        priority: 'urgent',
        assigneeId: 'm2',
        updatedAt: now - 100,
      }),
    ])
    const repo = createDexieIssueRepository(db)
    expect(
      (await windowRows(repo, { priorityFilter: ['urgent', 'high'] })).map((r) => r.id),
    ).toEqual(['p1e', 'p1d', 'p1b', 'p1a'])
    expect(
      (
        await windowRows(repo, {
          statusFilter: ['todo'],
          assigneeFilter: ['m1'],
          priorityFilter: ['urgent', 'low'],
          sortBy: 'priority',
        })
      ).map((r) => r.id),
    ).toEqual(['p1a', 'p1c'])
  })

  it('liveWindow 窗口先截断再过滤（多选维度同样适用）', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'w1', status: 'todo', assigneeId: 'm1', updatedAt: now - 300 }),
      seedIssue(db, { id: 'w2', status: 'done', assigneeId: 'm2', updatedAt: now - 200 }),
      seedIssue(db, { id: 'w3', status: 'todo', assigneeId: 'm1', updatedAt: now - 100 }),
    ])
    const repo = createDexieIssueRepository(db)
    // 窗口取最近 2 条（w3/w2），再套 m1 → 只剩 w3
    const rows = await windowRows(
      repo,
      { statusFilter: ['todo', 'done'], assigneeFilter: ['m1'] },
      'm1',
      2,
    )
    expect(rows.map((r) => r.id)).toEqual(['w3'])
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
            statusFilter: [],
            assigneeFilter: [],
            priorityFilter: [],
            search: '登录',
            myOnly: false,
            cycleFilter: null,
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
    // 搜索仍是全局动作：多选状态不参与（与单值时代一致）
    const withStatus = await windowRows(repo, {
      search: '登录',
      statusFilter: ['done', 'cancelled'],
    })
    expect(new Set(withStatus.map((r) => r.id))).toEqual(new Set(['q1', 'q2']))
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

  it('create 支持 parentId/order 透传（子任务）', async () => {
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
    const created = await repo.create({
      projectId: 'p1',
      title: '子任务',
      status: 'todo',
      priority: 'medium',
      assigneeId: null,
      reporterId: 'm1',
      parentId: 'parent-1',
      order: 42,
    })
    expect(created.parentId).toBe('parent-1')
    expect(created.order).toBe(42)
    expect(created.key).toBe('OAS-100001')
  })

  it('live 推送单条 Issue 的创建与更新', async () => {
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
    const created = await repo.create({
      projectId: 'p1',
      title: 'A',
      status: 'todo',
      priority: 'low',
      assigneeId: null,
      reporterId: 'm1',
    })
    const emissions: Array<Issue | undefined> = []
    let unsub: (() => void) | undefined
    const second = new Promise<void>((resolve) => {
      unsub = repo.live(created.id).subscribe({
        next: (v) => {
          emissions.push(v)
          if (emissions.length >= 2) resolve()
        },
      })
    })
    while (emissions.length === 0) await new Promise((r) => setTimeout(r, 5))
    expect(emissions[0]?.id).toBe(created.id)
    await repo.update(created.id, { status: 'done' })
    await second
    unsub?.()
    expect(emissions[1]?.status).toBe('done')
  })
})

describe('dexie issue repository — 全部项目作用域', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  /** 取 liveWindow 首个快照（默认全部项目作用域） */
  const windowRows = (
    repo: ReturnType<typeof createDexieIssueRepository>,
    filters: Partial<IssueWindowFilters> = {},
    currentUser = 'm1',
    limit?: number,
  ): Promise<Issue[]> =>
    new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: ALL_PROJECTS,
            statusFilter: [],
            assigneeFilter: [],
            priorityFilter: [],
            search: '',
            myOnly: false,
            cycleFilter: null,
            sortBy: 'updatedAt',
            ...filters,
          },
          currentUser,
          limit,
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
    })

  it('无状态筛选：跨项目并集按 updatedAt 倒序，limit 截断', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'x1', projectId: 'p1', updatedAt: now - 500 }),
      seedIssue(db, { id: 'x2', projectId: 'p2', updatedAt: now - 400 }),
      seedIssue(db, { id: 'x3', projectId: 'p3', updatedAt: now - 300 }),
      seedIssue(db, { id: 'x4', projectId: 'p2', updatedAt: now - 200 }),
    ])
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo)).map((r) => r.id)).toEqual(['x4', 'x3', 'x2', 'x1'])
    expect((await windowRows(repo, {}, 'm1', 2)).map((r) => r.id)).toEqual(['x4', 'x3'])
  })

  it('状态多选：组内 OR 跨项目归并后按 updatedAt 截断', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 's1', projectId: 'p1', status: 'todo', updatedAt: now - 500 }),
      seedIssue(db, { id: 's2', projectId: 'p2', status: 'done', updatedAt: now - 400 }),
      seedIssue(db, { id: 's3', projectId: 'p3', status: 'in_progress', updatedAt: now - 300 }),
      seedIssue(db, { id: 's4', projectId: 'p2', status: 'todo', updatedAt: now - 200 }),
      seedIssue(db, { id: 's5', projectId: 'p1', status: 'done', updatedAt: now - 100 }),
    ])
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo, { statusFilter: ['todo', 'done'] })).map((r) => r.id)).toEqual([
      's5',
      's4',
      's2',
      's1',
    ])
    // 分片各取 limit 条再归并：窗口外（in_progress）的行不得混入
    const limited = await windowRows(repo, { statusFilter: ['todo', 'done'] }, 'm1', 3)
    expect(limited.map((r) => r.id)).toEqual(['s5', 's4', 's2'])
    expect(limited.every((r) => r.status !== 'in_progress')).toBe(true)
  })

  it('myOnly 跨项目生效（跨项目个人工作台）', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'y1', projectId: 'p1', assigneeId: 'm1', updatedAt: now - 400 }),
      seedIssue(db, { id: 'y2', projectId: 'p2', assigneeId: 'm1', updatedAt: now - 300 }),
      seedIssue(db, { id: 'y3', projectId: 'p3', assigneeId: 'm2', updatedAt: now - 200 }),
      seedIssue(db, { id: 'y4', projectId: 'p2', assigneeId: 'm1', updatedAt: now - 100 }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await windowRows(repo, { myOnly: true }, 'm1')
    expect(rows.map((r) => r.id)).toEqual(['y4', 'y2', 'y1'])
    expect(new Set(rows.map((r) => r.projectId)).size).toBe(2)
  })

  it('窗口先截断再过滤（全部项目同样适用）+ 排序在窗口内重排', async () => {
    const now = 1_000_000
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'w1', projectId: 'p1', priority: 'low', updatedAt: now - 500 }),
      seedIssue(db, { id: 'w2', projectId: 'p2', priority: 'urgent', updatedAt: now - 200 }),
      seedIssue(db, { id: 'w3', projectId: 'p1', priority: 'high', updatedAt: now - 100 }),
    ])
    const repo = createDexieIssueRepository(db)
    // 窗口取最近 2 条（w3/w2），再套 low → 空集
    expect(await windowRows(repo, { priorityFilter: ['low'] }, 'm1', 2)).toEqual([])
    expect((await windowRows(repo, { sortBy: 'priority' })).map((r) => r.id)).toEqual([
      'w2',
      'w3',
      'w1',
    ])
  })

  it('search 仍是全表匹配（全部项目下等同全局）', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'q1', projectId: 'p1', title: '修复登录白屏' }),
      seedIssue(db, { id: 'q2', projectId: 'p2', title: '修复登录白屏' }),
      seedIssue(db, { id: 'q3', projectId: 'p3', title: '无关标题' }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await windowRows(repo, { search: '登录' })
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(['q1', 'q2']))
  })

  it('liveCounts 聚合全项目计数', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'c1', projectId: 'p1', status: 'todo' }),
      seedIssue(db, { id: 'c2', projectId: 'p2', status: 'todo' }),
      seedIssue(db, { id: 'c3', projectId: 'p3', status: 'done' }),
      seedIssue(db, { id: 'c4', projectId: 'p2', status: 'cancelled' }),
    ])
    const repo = createDexieIssueRepository(db)
    const counts = await new Promise<{ total: number; byStatus: Record<string, number> }>(
      (resolve) => {
        const unsub = repo.liveCounts(ALL_PROJECTS).subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
      },
    )
    expect(counts.total).toBe(4)
    expect(counts.byStatus.todo).toBe(2)
    expect(counts.byStatus.done).toBe(1)
    expect(counts.byStatus.cancelled).toBe(1)
    expect(counts.byStatus.in_progress).toBe(0)
  })

  it('liveAssigneeWorkload 聚合全项目（仪表盘不因全部项目而空图）', async () => {
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'k1', projectId: 'p1', assigneeId: 'm1' }),
      seedIssue(db, { id: 'k2', projectId: 'p2', assigneeId: 'm1' }),
      seedIssue(db, { id: 'k3', projectId: 'p3', assigneeId: 'm2' }),
      seedIssue(db, { id: 'k4', projectId: 'p2', assigneeId: null }),
    ])
    const repo = createDexieIssueRepository(db)
    const rows = await new Promise<Array<{ memberId: string; count: number }>>((resolve) => {
      const unsub = repo.liveAssigneeWorkload(ALL_PROJECTS).subscribe({
        next: (v) => {
          resolve(v)
          unsub()
        },
      })
    })
    const map = new Map(rows.map((r) => [r.memberId, r.count]))
    expect(map.get('m1')).toBe(2)
    expect(map.get('m2')).toBe(1)
    expect(map.size).toBe(2)
  })
})

describe('dexie issue repository — 迭代筛选', () => {
  let db: PMDatabase
  const DAY = 86_400_000

  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  /** 项目 p1 三个周期：已结束 / 进行中（含 now）/ 未开始；p2 一个进行中周期 */
  const seedCycles = async () => {
    const now = Date.now()
    await db.cycles.bulkAdd([
      {
        id: 'c-past',
        projectId: 'p1',
        name: 'Past',
        startAt: now - 28 * DAY,
        endAt: now - 14 * DAY,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c-live',
        projectId: 'p1',
        name: 'Live',
        startAt: now - 7 * DAY,
        endAt: now + 7 * DAY,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c-next',
        projectId: 'p1',
        name: 'Next',
        startAt: now + 7 * DAY,
        endAt: now + 21 * DAY,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c-live-p2',
        projectId: 'p2',
        name: 'Live p2',
        startAt: now - 1 * DAY,
        endAt: now + 1 * DAY,
        createdAt: 0,
        updatedAt: 0,
      },
    ])
  }

  /** 取 liveWindow 首个快照（默认 p1 作用域） */
  const windowRows = (
    repo: ReturnType<typeof createDexieIssueRepository>,
    filters: Partial<IssueWindowFilters> = {},
    limit?: number,
  ): Promise<Issue[]> =>
    new Promise<Issue[]>((resolve) => {
      const unsub = repo
        .liveWindow(
          {
            projectId: 'p1',
            statusFilter: [],
            assigneeFilter: [],
            priorityFilter: [],
            search: '',
            myOnly: false,
            sortBy: 'updatedAt',
            cycleFilter: null,
            ...filters,
          },
          'm1',
          limit,
        )
        .subscribe({
          next: (v) => {
            resolve(v)
            unsub()
          },
        })
    })

  const seedIssues = async () => {
    const base = Date.now()
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'i-past', cycleId: 'c-past', updatedAt: base - 600 }),
      seedIssue(db, { id: 'i-live', cycleId: 'c-live', updatedAt: base - 500 }),
      seedIssue(db, { id: 'i-none', cycleId: null, updatedAt: base - 400 }),
      // 历史数据：v9 之前写入的行没有 cycleId 字段，按未入迭代处理
      seedIssue(db, { id: 'i-legacy', cycleId: undefined, updatedAt: base - 300 }),
      seedIssue(db, {
        id: 'i-live-p2',
        projectId: 'p2',
        cycleId: 'c-live-p2',
        updatedAt: base - 200,
      }),
      seedIssue(db, { id: 'i-next', cycleId: 'c-next', updatedAt: base - 100 }),
    ])
  }

  it('具体周期 id：等值匹配（组内语义），与状态/负责人 AND', async () => {
    await seedCycles()
    await seedIssues()
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo, { cycleFilter: 'c-past' })).map((r) => r.id)).toEqual(['i-past'])
    expect((await windowRows(repo, { cycleFilter: 'c-live' })).map((r) => r.id)).toEqual(['i-live'])
    // 与状态维度的 AND：i-live 是 todo，筛 done 后为空
    expect(await windowRows(repo, { cycleFilter: 'c-live', statusFilter: ['done'] })).toEqual([])
    expect(
      (await windowRows(repo, { cycleFilter: 'c-live', statusFilter: ['todo'] })).map((r) => r.id),
    ).toEqual(['i-live'])
  })

  it('未入迭代：null 与缺失字段都命中', async () => {
    await seedCycles()
    await seedIssues()
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo, { cycleFilter: '__none__' })).map((r) => r.id)).toEqual([
      'i-legacy',
      'i-none',
    ])
  })

  it('当前迭代：由 now 派生（只有覆盖当前时刻的周期命中）', async () => {
    await seedCycles()
    await seedIssues()
    const repo = createDexieIssueRepository(db)
    expect((await windowRows(repo, { cycleFilter: '__current__' })).map((r) => r.id)).toEqual([
      'i-live',
    ])
  })

  it('全部项目作用域：迭代筛选照常生效（当前迭代跨项目并集）', async () => {
    await seedCycles()
    await seedIssues()
    const repo = createDexieIssueRepository(db)
    expect(
      (await windowRows(repo, { projectId: ALL_PROJECTS, cycleFilter: '__current__' })).map(
        (r) => r.id,
      ),
    ).toEqual(['i-live-p2', 'i-live'])
    expect(
      (await windowRows(repo, { projectId: ALL_PROJECTS, cycleFilter: '__none__' })).map(
        (r) => r.id,
      ),
    ).toEqual(['i-legacy', 'i-none'])
  })

  it('窗口先截断再按迭代过滤（与负责人/优先级同口径）', async () => {
    await seedCycles()
    await seedIssues()
    const repo = createDexieIssueRepository(db)
    // 最近 2 条（i-next / i-live-p2）里没有 c-past 的成员 → 空集
    expect(await windowRows(repo, { cycleFilter: 'c-past' }, 2)).toEqual([])
  })
})
