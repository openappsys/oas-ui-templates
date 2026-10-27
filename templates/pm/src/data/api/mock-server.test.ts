import { describe, expect, it } from 'vitest'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, type Cycle, type Issue } from '@/types'
import {
  MOCK_ISSUE_COUNT,
  createMockHandler,
  createMockStore,
  handleApi,
  type ApiRequest,
  type ApiResponse,
  type MockStore,
} from './mock-server'

const FIXED = 1_700_000_000_000
const DAY = 86_400_000
const ADMIN_EMAIL = 'user1@oas.dev'
const DEMO_PASSWORD = 'oas'

interface CallInit {
  query?: Record<string, string>
  body?: unknown
  /** 覆盖默认身份；null = 匿名（验 401 用） */
  authorization?: string | null
}

const req = (method: string, path: string, init: CallInit = {}): ApiRequest => ({
  method,
  path,
  query: new URLSearchParams(init.query ?? {}),
  body: init.body,
})

/** 默认以 admin 身份发请求：走真实 login 端点换 token（鉴权路径不被测试旁路） */
const bearerCache = new WeakMap<MockStore, string>()
function adminBearer(store: MockStore): string {
  const cached = bearerCache.get(store)
  if (cached) return cached
  const res = handleApi(store, {
    method: 'POST',
    path: '/api/auth/login',
    query: new URLSearchParams(),
    body: { email: ADMIN_EMAIL, password: DEMO_PASSWORD },
  })
  const bearer = `Bearer ${(res.body as { token: string }).token}`
  bearerCache.set(store, bearer)
  return bearer
}

/** 指定成员的 Bearer（走真实登录端点，验证身份隔离时不给 admin 缓存） */
function bearerFor(store: MockStore, email: string): string {
  const res = handleApi(store, {
    method: 'POST',
    path: '/api/auth/login',
    query: new URLSearchParams(),
    body: { email, password: DEMO_PASSWORD },
  })
  return `Bearer ${(res.body as { token: string }).token}`
}

const call = (store: MockStore, method: string, path: string, init: CallInit = {}): ApiResponse =>
  handleApi(store, {
    ...req(method, path, init),
    authorization: init.authorization === undefined ? adminBearer(store) : init.authorization,
  })

const items = <T>(res: ApiResponse): T[] => (res.body as { items: T[] }).items

const tables = (store: MockStore) => ({
  issues: store.issues,
  projects: store.projects,
  members: store.members,
  comments: store.comments,
  savedViews: store.savedViews,
  activities: store.activities,
  settings: store.settings,
  cycles: store.cycles,
})

const makeIssue = (over: Partial<Issue> & { id: string }): Issue => ({
  projectId: 'project-1',
  key: 'OAS-9',
  title: 'placeholder',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: null,
  reporterId: 'member-1',
  labels: [],
  startAt: null,
  dueAt: null,
  createdAt: FIXED,
  updatedAt: FIXED,
  order: 0,
  parentId: null,
  ...over,
})

describe('mock seed', () => {
  it('同参数两次播种完全相等（2K issues / 3 项目 / 8 成员）', () => {
    const a = createMockStore({ now: FIXED })
    const b = createMockStore({ now: FIXED })
    expect(a.issues).toHaveLength(MOCK_ISSUE_COUNT)
    expect(a.projects).toHaveLength(3)
    expect(a.members).toHaveLength(8)
    expect(a.cycles).toHaveLength(3)
    expect(tables(a)).toEqual(tables(b))
    expect(a.comments.length).toBeGreaterThan(0)
    expect(a.activities.length).toBeGreaterThan(0)
    expect(a.settings.length).toBeGreaterThan(0)
  })

  it('GET /api/revision 返回当前版本号', () => {
    const store = createMockStore({ now: FIXED })
    expect(call(store, 'GET', '/api/revision').body).toEqual({ revision: 0 })
  })

  it('未知路径返回 404', () => {
    const store = createMockStore({ now: FIXED })
    const res = call(store, 'GET', '/api/does-not-exist')
    expect(res.status).toBe(404)
    expect((res.body as { error: string }).error).toBeTruthy()
  })
})

describe('issue window 查询语义（对齐 Dexie）', () => {
  it('search 全局匹配、无视 project/status、按主键升序', () => {
    const store = createMockStore({ now: FIXED })
    const kw = store.issues[0].title.replace(/ #\d+$/, '')
    const res = call(store, 'GET', '/api/issues', {
      query: { projectId: 'project-1', status: 'done', search: kw, limit: '10' },
    })
    const rows = items<Issue>(res)
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      expect(row.title.toLowerCase().includes(kw.toLowerCase())).toBe(true)
    }
    expect(rows.some((r) => r.projectId !== 'project-1')).toBe(true)
    expect(rows.map((r) => r.id)).toEqual([...rows.map((r) => r.id)].sort())
  })

  it('search 命中上限 2000 且按主键序截断', () => {
    const store = createMockStore({ now: FIXED })
    for (let i = 1; i <= 2005; i++) {
      store.issues.push(
        makeIssue({
          id: `zzcap-${String(i).padStart(4, '0')}`,
          title: `capcheck ${i}`,
          updatedAt: FIXED - i,
        }),
      )
    }
    const rows = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { projectId: 'project-1', search: 'capcheck' } }),
    )
    expect(rows).toHaveLength(2000)
    expect(rows[0].id).toBe('zzcap-0001')
    expect(rows[1999].id).toBe('zzcap-2000')
  })

  it('非 search 窗口先按 updatedAt 截断再过滤', () => {
    const store = createMockStore({ now: FIXED })
    const projectId = 'project-1'
    const newest = store.issues
      .filter((i) => i.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
    const target = newest.map((i) => i.assigneeId).find((id): id is string => Boolean(id))
    expect(target).toBeTruthy()
    const expected = newest.filter((i) => i.assigneeId === target).map((i) => i.id)
    expect(expected.length).toBeGreaterThan(0)
    // 先过滤后截断会多出窗口外的行——只有「先窗口再过滤」才得到 expected
    expect(
      store.issues.filter((i) => i.projectId === projectId && i.assigneeId === target).length,
    ).toBeGreaterThan(expected.length)

    const rows = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { projectId, assignee: target as string, limit: '5' },
      }),
    )
    expect(rows.map((i) => i.id)).toEqual(expected)
  })

  it('status/assignee/priority 过滤生效且保持 updatedAt 倒序', () => {
    const store = createMockStore({ now: FIXED })
    const base = { projectId: 'project-2', limit: '50' }
    const byStatus = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, status: 'in_progress' } }),
    )
    expect(byStatus.length).toBeGreaterThan(0)
    expect(byStatus.every((i) => i.status === 'in_progress' && i.projectId === 'project-2')).toBe(
      true,
    )
    expect(byStatus.map((i) => i.updatedAt)).toEqual(
      [...byStatus.map((i) => i.updatedAt)].sort((a, b) => b - a),
    )

    const byPriority = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, priority: 'urgent' } }),
    )
    expect(byPriority.length).toBeGreaterThan(0)
    expect(byPriority.every((i) => i.priority === 'urgent')).toBe(true)

    const windowIds = new Set(
      store.issues
        .filter((i) => i.projectId === 'project-2')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50)
        .map((i) => i.id),
    )
    expect(byPriority.every((i) => windowIds.has(i.id))).toBe(true)

    const mine = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { ...base, myOnly: '1', currentUser: 'member-2' },
      }),
    )
    expect(mine.every((i) => i.assigneeId === 'member-2')).toBe(true)
  })

  it('多值 query（逗号分隔）：组内 OR、组间 AND、__none__ 匹配未分配', () => {
    const store = createMockStore({ now: FIXED })
    const base = { projectId: 'project-2', limit: '50' }
    const two = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, status: 'todo,in_progress' } }),
    )
    expect(two.length).toBeGreaterThan(0)
    expect(two.every((i) => i.status === 'todo' || i.status === 'in_progress')).toBe(true)
    // 窗口语义：先按 updatedAt 在「项目 ∩ 状态集合」上截断到 limit，再套其他维度
    const expected = store.issues
      .filter(
        (i) => i.projectId === 'project-2' && (i.status === 'todo' || i.status === 'in_progress'),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1))
      .slice(0, 50)
      .map((i) => i.id)
    expect(two.map((i) => i.id)).toEqual(expected)

    const andRows = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { ...base, status: 'todo,in_progress', priority: 'urgent,high' },
      }),
    )
    expect(andRows.length).toBeGreaterThan(0)
    expect(
      andRows.every(
        (i) =>
          (i.status === 'todo' || i.status === 'in_progress') &&
          (i.priority === 'urgent' || i.priority === 'high'),
      ),
    ).toBe(true)

    const unassigned = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { ...base, assignee: '__none__,member-2' },
      }),
    )
    expect(unassigned.length).toBeGreaterThan(0)
    expect(unassigned.every((i) => i.assigneeId === null || i.assigneeId === 'member-2')).toBe(true)
  })

  it('多值 status 保持「先把项目窗口截断到 limit」的语义', () => {
    const store = createMockStore({ now: FIXED })
    const windowIds = store.issues
      .filter((i) => i.projectId === 'project-1' && (i.status === 'todo' || i.status === 'done'))
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1))
      .slice(0, 20)
      .map((i) => i.id)
    const rows = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { projectId: 'project-1', status: 'todo,done', limit: '20' },
      }),
    )
    expect(rows.map((i) => i.id)).toEqual(windowIds)
  })

  it('cycle 参数：具体周期直取整周期 / 未入迭代 / 当前迭代（哨兵仍走窗口）', () => {
    // 当前迭代按真实时钟派生：本用例用生产口径（now = 当日 0 点）播种，
    // 其余用例用固定时间做确定性比较
    const store = createMockStore()
    const base = { projectId: 'project-1', limit: '200' }

    const byCycle = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, cycle: 'cycle-2' } }),
    )
    expect(byCycle.length).toBeGreaterThan(0)
    expect(byCycle.every((i) => i.cycleId === 'cycle-2')).toBe(true)

    const noCycle = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, cycle: '__none__' } }),
    )
    expect(noCycle.length).toBeGreaterThan(0)
    expect(noCycle.every((i) => (i.cycleId ?? null) === null)).toBe(true)

    // 当前迭代由 now 派生：store 的 now = 当日 0 点 → cycle-3 覆盖 now
    const current = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, cycle: '__current__' } }),
    )
    expect(current.length).toBeGreaterThan(0)
    expect(current.every((i) => i.cycleId === 'cycle-3')).toBe(true)

    // 具体周期直取：limit=1 返回该周期最新一条（不再被窗口截成空集）
    const newestOfCycle = store.issues
      .filter((i) => i.projectId === 'project-1' && i.cycleId === 'cycle-2')
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1))[0]
    const paged = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...base, limit: '1', cycle: 'cycle-2' } }),
    )
    expect(paged.map((i) => i.id)).toEqual([newestOfCycle.id])

    // 与状态的 AND 在整周期范围内成立
    const done = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { ...base, cycle: 'cycle-2', status: 'done' },
      }),
    )
    expect(done.every((i) => i.cycleId === 'cycle-2' && i.status === 'done')).toBe(true)
  })

  it('cycle-counts：按周期聚合（null 桶在前，其后 id 升序）', () => {
    const store = createMockStore({ now: FIXED })
    const rows = items<{ cycleId: string | null; total: number; done: number; cancelled: number }>(
      call(store, 'GET', '/api/issues/cycle-counts', { query: { projectId: 'project-1' } }),
    )
    expect(rows[0]?.cycleId).toBe(null)
    const cycleIds = rows.map((r) => r.cycleId).filter((c): c is string => c !== null)
    expect(cycleIds.length).toBeGreaterThan(0)
    // 非 null 桶按 cycleId 升序
    expect(cycleIds).toEqual([...cycleIds].sort())
    // 与全表逐条统计一致（同一份数据，另一条实现路径）
    for (const row of rows) {
      const owned = store.issues.filter(
        (i) => i.projectId === 'project-1' && (i.cycleId ?? null) === row.cycleId,
      )
      expect(row.total).toBe(owned.length)
      expect(row.done).toBe(owned.filter((i) => i.status === 'done').length)
      expect(row.cancelled).toBe(owned.filter((i) => i.status === 'cancelled').length)
    }
    // 全部项目 = 跨项目并集
    const all = items<{ cycleId: string | null; total: number }>(
      call(store, 'GET', '/api/issues/cycle-counts', { query: { projectId: '__all__' } }),
    )
    expect(all.reduce((n, r) => n + r.total, 0)).toBe(store.issues.length)
    // 跨项目并集里除 null 桶外仍有具体周期桶
    expect(all.filter((r) => r.cycleId !== null).length).toBeGreaterThan(0)
  })

  it('cycle-issues：整周期 id 升序直取（与 Dexie liveCycleIssues 同序）', () => {
    const store = createMockStore({ now: FIXED })
    const rows = items<Issue>(
      call(store, 'GET', '/api/issues/cycle-issues', {
        query: { projectId: 'project-1', cycleId: 'cycle-2' },
      }),
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((i) => i.cycleId === 'cycle-2')).toBe(true)
    expect(rows.map((i) => i.id)).toEqual([...rows.map((i) => i.id)].sort())
    expect(
      items<Issue>(
        call(store, 'GET', '/api/issues/cycle-issues', {
          query: { projectId: 'project-1', cycleId: 'nope' },
        }),
      ),
    ).toEqual([])
  })

  it('projectId=__all__：跨项目窗口（无状态/多状态）与全局计数聚合', () => {
    const store = createMockStore({ now: FIXED })
    const byUpdated = (rows: Issue[]) =>
      [...rows].sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1)).map((i) => i.id)

    const rows = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { projectId: '__all__', limit: '120' } }),
    )
    expect(rows).toHaveLength(120)
    expect(new Set(rows.map((i) => i.projectId)).size).toBe(3)
    expect(rows.map((i) => i.id)).toEqual(byUpdated(store.issues).slice(0, 120))

    const statuses = ['todo', 'done'] as const
    const multi = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { projectId: '__all__', status: 'todo,done', limit: '60' },
      }),
    )
    expect(multi).toHaveLength(60)
    expect(multi.every((i) => statuses.includes(i.status as (typeof statuses)[number]))).toBe(true)
    expect(multi.map((i) => i.id)).toEqual(
      byUpdated(store.issues.filter((i) => statuses.includes(i.status as 'todo' | 'done'))).slice(
        0,
        60,
      ),
    )

    const mine = items<Issue>(
      call(store, 'GET', '/api/issues', {
        query: { projectId: '__all__', myOnly: '1', currentUser: 'member-2', limit: '80' },
      }),
    )
    expect(mine.every((i) => i.assigneeId === 'member-2')).toBe(true)
    expect(new Set(mine.map((i) => i.projectId)).size).toBeGreaterThan(1)

    const counts = call(store, 'GET', '/api/issues/counts', {
      query: { projectId: '__all__' },
    }).body as { total: number; byStatus: Record<string, number> }
    expect(counts.total).toBe(MOCK_ISSUE_COUNT)
    expect(Object.values(counts.byStatus).reduce((a, b) => a + b, 0)).toBe(MOCK_ISSUE_COUNT)

    // workload 同样聚合全项目
    const workload = items<{ memberId: string; count: number }>(
      call(store, 'GET', '/api/issues/workload', { query: { projectId: '__all__' } }),
    )
    expect(workload.reduce((sum, r) => sum + r.count, 0)).toBe(
      store.issues.filter((i) => i.assigneeId).length,
    )
  })

  it('sortBy 三态在同一窗口内重排', () => {
    const store = createMockStore({ now: FIXED })
    const query = { projectId: 'project-1', limit: '200' }
    const updated = items<Issue>(call(store, 'GET', '/api/issues', { query }))
    expect(updated.map((i) => i.updatedAt)).toEqual(
      [...updated.map((i) => i.updatedAt)].sort((a, b) => b - a),
    )

    const priority = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...query, sortBy: 'priority' } }),
    )
    expect(new Set(priority.map((i) => i.id))).toEqual(new Set(updated.map((i) => i.id)))
    const weight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    expect(priority.map((i) => weight[i.priority])).toEqual(
      priority.map((i) => weight[i.priority]).sort((a, b) => a - b),
    )

    const created = items<Issue>(
      call(store, 'GET', '/api/issues', { query: { ...query, sortBy: 'createdAt' } }),
    )
    expect(new Set(created.map((i) => i.id))).toEqual(new Set(updated.map((i) => i.id)))
    expect(created.map((i) => i.createdAt)).toEqual(
      [...created.map((i) => i.createdAt)].sort((a, b) => b - a),
    )
  })
})

describe('issue 写路径', () => {
  it('create/update/delete 各让 revision +1，失败的写不涨', () => {
    const store = createMockStore({ now: FIXED })
    const revision = () =>
      (call(store, 'GET', '/api/revision').body as { revision: number }).revision
    const r0 = revision()

    const created = call(store, 'POST', '/api/issues', {
      body: {
        projectId: 'project-1',
        title: 'REST 新建',
        status: 'todo',
        priority: 'high',
        assigneeId: null,
        reporterId: 'member-1',
      },
    })
    expect(created.status).toBe(201)
    const issue = (created.body as { issue: Issue }).issue
    expect(issue.key).toBe('OAS-100001')
    expect(revision()).toBe(r0 + 1)

    call(store, 'PATCH', `/api/issues/${issue.id}`, { body: { changes: { status: 'done' } } })
    expect(revision()).toBe(r0 + 2)
    expect(store.issues.find((i) => i.id === issue.id)?.status).toBe('done')

    expect(call(store, 'DELETE', '/api/issues/missing').status).toBe(404)
    expect(revision()).toBe(r0 + 2)

    call(store, 'DELETE', `/api/issues/${issue.id}`)
    expect(revision()).toBe(r0 + 3)
    // 软删除：行仍在库里（deletedAt 有值），GET 视同不存在
    expect(store.issues.find((i) => i.id === issue.id)?.deletedAt).toBeGreaterThan(0)
    expect(call(store, 'GET', `/api/issues/${issue.id}`).status).toBe(404)
  })

  it('PATCH /api/issues 批量更新（一次写、一次 revision）', () => {
    const store = createMockStore({ now: FIXED })
    const ids = store.issues.slice(0, 2).map((i) => i.id)
    const res = call(store, 'PATCH', '/api/issues', {
      body: { updates: ids.map((id) => ({ id, changes: { priority: 'urgent' } })) },
    })
    expect(res.status).toBe(200)
    for (const id of ids) {
      expect(store.issues.find((i) => i.id === id)?.priority).toBe('urgent')
    }
    const r = (call(store, 'GET', '/api/revision').body as { revision: number }).revision
    expect(r).toBe(1)
  })

  it('bulk-apply 写活动（assigneeId:null → to 空串）并落补丁', () => {
    const store = createMockStore({ now: FIXED })
    const ids = store.issues.slice(0, 2).map((i) => i.id)
    const res = call(store, 'POST', '/api/issues/bulk-apply', {
      body: { ids, patch: { status: 'done', assigneeId: null }, actorId: 'member-2' },
    })
    expect(res.status).toBe(200)
    for (const id of ids) {
      const row = store.issues.find((i) => i.id === id)
      expect(row?.status).toBe('done')
      expect(row?.assigneeId).toBeNull()
    }
    const acts = store.activities.filter((a) => a.actorId === 'member-2' && ids.includes(a.issueId))
    expect(acts.filter((a) => a.type === 'status' && a.to === 'done')).toHaveLength(2)
    expect(
      acts.filter((a) => a.type === 'assignee' && a.field === 'assigneeId' && a.to === ''),
    ).toHaveLength(2)
  })

  it('bulk-apply 无补丁字段时不写活动', () => {
    const store = createMockStore({ now: FIXED })
    const before = store.activities.length
    const ids = [store.issues[0].id]
    call(store, 'POST', '/api/issues/bulk-apply', { body: { ids, patch: {}, actorId: 'member-2' } })
    expect(store.activities.length).toBe(before)
  })

  it('bulk-delete 批量软删除（回收站可恢复）', () => {
    const store = createMockStore({ now: FIXED })
    const ids = store.issues.slice(0, 3).map((i) => i.id)
    call(store, 'POST', '/api/issues/bulk-delete', { body: { ids: [ids[0], ids[2]] } })
    const softRaw = (id: string) => store.issues.find((i) => i.id === id)
    expect(softRaw(ids[0])?.deletedAt).toBeGreaterThan(0)
    expect(softRaw(ids[1])?.deletedAt ?? null).toBeNull()
    expect(softRaw(ids[2])?.deletedAt).toBeGreaterThan(0)
    // 列表与 bulk 查询不再返回软删行
    const listed = call(store, 'GET', '/api/issues/bulk', {
      query: { ids: ids.join(',') },
    }).body as { items: Array<Issue | null> }
    expect(listed.items.map((r) => Boolean(r))).toEqual([false, true, false])
  })

  it('回收站：deleted=1 列出软删行；restore 恢复、purge 物理删除（仅 admin）', () => {
    const store = createMockStore({ now: FIXED })
    const id = store.issues[0].id
    call(store, 'DELETE', `/api/issues/${id}`)
    const trash = call(store, 'GET', '/api/issues', { query: { deleted: '1' } }).body as {
      items: Issue[]
    }
    expect(trash.items.map((r) => r.id)).toEqual([id])

    expect(call(store, 'POST', `/api/issues/${id}/restore`).status).toBe(200)
    expect(store.issues.find((i) => i.id === id)?.deletedAt ?? null).toBeNull()
    expect(call(store, 'GET', `/api/issues/${id}`).status).toBe(200)

    // 在库行不可永久删除（必须先软删）
    expect(call(store, 'DELETE', `/api/issues/${id}/purge`).status).toBe(409)
    call(store, 'DELETE', `/api/issues/${id}`)
    expect(call(store, 'DELETE', `/api/issues/${id}/purge`).status).toBe(200)
    expect(store.issues.some((i) => i.id === id)).toBe(false)
  })
})

describe('派生查询与聚合', () => {
  it('counts 统计全项目各状态与各优先级', () => {
    const store = createMockStore({ now: FIXED })
    const body = call(store, 'GET', '/api/issues/counts', {
      query: { projectId: 'project-1' },
    }).body as {
      total: number
      byStatus: Record<string, number>
      byPriority: Record<string, number>
    }
    const rows = store.issues.filter((i) => i.projectId === 'project-1')
    expect(body.total).toBe(rows.length)
    expect(Object.keys(body.byStatus)).toEqual(ISSUE_STATUSES)
    for (const s of ISSUE_STATUSES) {
      expect(body.byStatus[s]).toBe(rows.filter((i) => i.status === s).length)
    }
    // 优先级同口径（全量、按项目作用域），Dexie 侧 liveCounts.byPriority 与之一致
    expect(Object.keys(body.byPriority)).toEqual(ISSUE_PRIORITIES)
    for (const p of ISSUE_PRIORITIES) {
      expect(body.byPriority[p]).toBe(rows.filter((i) => i.priority === p).length)
    }
    expect(Object.values(body.byPriority).reduce((a, b) => a + b, 0)).toBe(body.total)
  })

  it('workload 按成员计数且跳过未分配', () => {
    const store = createMockStore({ now: FIXED })
    const rows = items<{ memberId: string; count: number }>(
      call(store, 'GET', '/api/issues/workload', { query: { projectId: 'project-2' } }),
    )
    const assigned = store.issues.filter((i) => i.projectId === 'project-2' && i.assigneeId)
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(assigned.length)
    expect(rows.every((r) => r.memberId)).toBe(true)
  })

  it('sub-issues / relation-candidates / bulkGet / listAll / created-trend', () => {
    const store = createMockStore({ now: FIXED })
    const parent = store.issues[0]
    const subs = items<Issue>(call(store, 'GET', `/api/issues/${parent.id}/sub-issues`))
    expect(subs.length).toBeGreaterThan(0)
    expect(subs.every((i) => i.parentId === parent.id)).toBe(true)

    const candidates = items<Issue>(
      call(store, 'GET', '/api/issues/relation-candidates', {
        query: { projectId: 'project-1', limit: '7' },
      }),
    )
    expect(candidates).toHaveLength(7)
    expect(candidates.every((i) => i.projectId === 'project-1')).toBe(true)
    expect(candidates.map((i) => i.id)).toEqual([...candidates.map((i) => i.id)].sort())

    const [a, b] = [store.issues[3], store.issues[1]]
    const bulk = items<Issue | null>(
      call(store, 'GET', '/api/issues/bulk', { query: { ids: `${a.id},missing,${b.id}` } }),
    )
    expect(bulk).toHaveLength(3)
    expect(bulk[0]?.id).toBe(a.id)
    expect(bulk[1]).toBeNull()
    expect(bulk[2]?.id).toBe(b.id)

    const all = items<Issue>(call(store, 'GET', '/api/issues/all', { query: { limit: '4' } }))
    expect(all).toHaveLength(4)
    expect(all.map((i) => i.id)).toEqual([...all.map((i) => i.id)].sort())

    const since = FIXED - 30 * DAY
    const trend = items<{ day: string; count: number }>(
      call(store, 'GET', '/api/issues/created-trend', { query: { since: String(since) } }),
    )
    expect(trend.length).toBeGreaterThan(0)
    expect(trend.reduce((sum, r) => sum + r.count, 0)).toBeGreaterThan(0)
    expect(trend.map((r) => r.day)).toEqual([...trend.map((r) => r.day)].sort())
    // 计数与原始行数对得上（与 created-since 旧口径同总和；notDeleted = deletedAt 缺失/null）
    const raw = store.issues.filter(
      (i) => i.deletedAt == null && i.createdAt >= since && i.createdAt <= FIXED,
    )
    expect(trend.reduce((sum, r) => sum + r.count, 0)).toBe(raw.length)
  })
})

describe('项目/成员守卫', () => {
  it('非空项目不可删除；最后一名管理员不可降级或移除', () => {
    const store = createMockStore({ now: FIXED })
    const del = call(store, 'DELETE', '/api/projects/project-1')
    expect(del.status).toBe(409)
    expect(store.projects.some((p) => p.id === 'project-1')).toBe(true)

    const demote = call(store, 'PATCH', '/api/members/member-1', {
      body: { changes: { role: 'viewer' } },
    })
    expect(demote.status).toBe(409)
    expect(store.members.find((m) => m.id === 'member-1')?.role).toBe('admin')

    const remove = call(store, 'DELETE', '/api/members/member-1')
    expect(remove.status).toBe(409)
  })

  it('移除非管理员成员时清空其名下 Issue 的负责人', () => {
    const store = createMockStore({ now: FIXED })
    const target = store.issues.find((i) => i.assigneeId === 'member-5')
    expect(target).toBeTruthy()
    expect(call(store, 'DELETE', '/api/members/member-5').status).toBe(200)
    expect(store.members.some((m) => m.id === 'member-5')).toBe(false)
    expect(store.issues.filter((i) => i.assigneeId === 'member-5')).toHaveLength(0)
  })
})

describe('备份信封与 reset', () => {
  it('export 信封含 10 版元信息与 13 张表', () => {
    const store = createMockStore({ now: FIXED })
    const body = call(store, 'GET', '/api/admin/export').body as {
      app: string
      version: number
      exportedAt: number
      tables: Record<string, unknown[]>
    }
    expect(body.app).toBe('oas-pm')
    expect(body.version).toBe(10)
    expect(typeof body.exportedAt).toBe('number')
    expect(Object.keys(body.tables).sort()).toEqual([
      'activities',
      'audit',
      'comments',
      'cycles',
      'issues',
      'members',
      'notifications',
      'projectMembers',
      'projectRoles',
      'projects',
      'roles',
      'savedViews',
      'settings',
    ])
    expect(body.tables.issues).toHaveLength(MOCK_ISSUE_COUNT)
    expect(body.tables.cycles).toHaveLength(3)
  })

  it('import 整体替换 store，非法 JSON 返回 400', () => {
    const store = createMockStore({ now: FIXED })
    const exported = JSON.stringify(call(store, 'GET', '/api/admin/export').body)
    call(store, 'POST', '/api/admin/wipe')
    expect(store.issues).toHaveLength(0)
    const res = call(store, 'POST', '/api/admin/import', { body: { json: exported } })
    expect(res.status).toBe(200)
    expect(store.issues).toHaveLength(MOCK_ISSUE_COUNT)
    expect(store.projects).toHaveLength(3)

    const bad = call(store, 'POST', '/api/admin/import', { body: { json: 'not-json' } })
    expect(bad.status).toBe(400)
    expect(store.issues).toHaveLength(MOCK_ISSUE_COUNT)
  })

  it('reset 恢复确定性种子（两次 reset 输出相等）', () => {
    const store = createMockStore({ now: FIXED })
    const first = (call(store, 'GET', '/api/admin/export').body as { tables: unknown }).tables

    call(store, 'DELETE', `/api/issues/${store.issues[0].id}`)
    call(store, 'PATCH', '/api/settings/labels', { body: { value: ['only'] } })
    call(store, 'POST', '/api/admin/reset')
    const second = (call(store, 'GET', '/api/admin/export').body as { tables: unknown }).tables
    call(store, 'POST', '/api/admin/reset')
    const third = (call(store, 'GET', '/api/admin/export').body as { tables: unknown }).tables

    expect(second).toEqual(first)
    expect(third).toEqual(second)
    expect(store.issues).toHaveLength(MOCK_ISSUE_COUNT)
    const labels = store.settings.find((s) => s.key === 'labels')?.value as string[] | undefined
    expect(labels?.length ?? 0).toBeGreaterThan(1)
  })

  it('createMockHandler 复用同一 store（reset 跨请求生效）', () => {
    const handler = createMockHandler()
    const login = handler({
      method: 'POST',
      path: '/api/auth/login',
      query: new URLSearchParams(),
      body: { email: ADMIN_EMAIL, password: DEMO_PASSWORD },
    })
    const auth = `Bearer ${(login.body as { token: string }).token}`
    const send = (method: string, path: string, body?: unknown) =>
      handler({
        method,
        path,
        query: new URLSearchParams(),
        body,
        authorization: auth,
      })
    const r = (body: unknown) => body as { revision: number }
    const first = r(send('GET', '/api/revision').body).revision
    send('POST', '/api/issues/bulk-delete', { ids: ['nope'] })
    expect(r(send('GET', '/api/revision').body).revision).toBe(first + 1)
    send('POST', '/api/admin/reset')
    expect(r(send('GET', '/api/revision').body).revision).toBe(first + 2)
  })
})

describe('迭代（cycles）端点', () => {
  it('GET 按 startAt 倒序；projectId 缺省/__all__ 为跨项目并集', () => {
    const store = createMockStore({ now: FIXED })
    const rows = items<Cycle>(
      call(store, 'GET', '/api/cycles', { query: { projectId: 'project-1' } }),
    )
    expect(rows.map((c) => c.id)).toEqual(['cycle-3', 'cycle-2', 'cycle-1'])
    expect(rows.every((c) => c.projectId === 'project-1')).toBe(true)
    expect(items<Cycle>(call(store, 'GET', '/api/cycles')).map((c) => c.id)).toEqual([
      'cycle-3',
      'cycle-2',
      'cycle-1',
    ])
    expect(
      items<Cycle>(call(store, 'GET', '/api/cycles', { query: { projectId: 'project-2' } })),
    ).toEqual([])
  })

  it('POST 创建、PATCH 改字段并盖 updatedAt、DELETE 解除 Issue 归属', () => {
    const store = createMockStore({ now: FIXED })
    const created = call(store, 'POST', '/api/cycles', {
      body: { projectId: 'project-2', name: 'C-new', startAt: 10, endAt: 20, goal: 'g' },
    })
    expect(created.status).toBe(201)
    const cycle = (created.body as { cycle: Cycle }).cycle
    expect(cycle.id).toBeTruthy()
    expect(store.cycles.some((c) => c.id === cycle.id)).toBe(true)
    const revision = store.revision

    call(store, 'PATCH', `/api/cycles/${cycle.id}`, { body: { changes: { name: 'C-renamed' } } })
    const patched = store.cycles.find((c) => c.id === cycle.id)
    expect(patched?.name).toBe('C-renamed')
    expect(patched?.updatedAt).toBeGreaterThan(0)
    expect(store.revision).toBe(revision + 1)

    // 归属解除：Issue 保留、cycleId 置空
    const owned = store.issues.filter((i) => i.cycleId === 'cycle-2').slice(0, 5)
    expect(owned.length).toBeGreaterThan(0)
    const total = store.issues.length
    const res = call(store, 'DELETE', '/api/cycles/cycle-2')
    expect(res.status).toBe(200)
    expect(store.issues.length).toBe(total)
    expect(store.issues.filter((i) => i.cycleId === 'cycle-2')).toEqual([])
    expect(owned.every((i) => i.cycleId === null)).toBe(true)
    expect(store.cycles.some((c) => c.id === 'cycle-2')).toBe(false)
  })

  it('未知周期 404；DELETE 后 revision 递增', () => {
    const store = createMockStore({ now: FIXED })
    expect(call(store, 'GET', '/api/cycles/nope').status).toBe(404)
    expect(call(store, 'PATCH', '/api/cycles/nope', { body: { changes: {} } }).status).toBe(404)
    const before = store.revision
    call(store, 'DELETE', '/api/cycles/cycle-1')
    expect(store.revision).toBe(before + 1)
  })
})

describe('设置与评论/活动/视图', () => {
  it('settings get/put 往返，缺失返回 found:false', () => {
    const store = createMockStore({ now: FIXED })
    expect(call(store, 'GET', '/api/settings/labels').body).toEqual({
      found: true,
      value: store.settings.find((s) => s.key === 'labels')?.value,
    })
    expect(call(store, 'GET', '/api/settings/missing').body).toEqual({ found: false, value: null })
    call(store, 'PUT', '/api/settings/labels', { body: { value: ['x'] } })
    expect(call(store, 'GET', '/api/settings/labels').body).toEqual({
      found: true,
      value: ['x'],
    })
  })

  it('comments 按 issueId 升序返回并可增改删', () => {
    const store = createMockStore({ now: FIXED })
    const issueId = store.comments[0].issueId
    const add = call(store, 'POST', '/api/comments', {
      body: { issueId, authorId: 'member-1', body: 'hi' },
    })
    expect(add.status).toBe(201)
    const id = (add.body as { comment: { id: string } }).comment.id
    const list = items<{ id: string; body: string; createdAt: number }>(
      call(store, 'GET', '/api/comments', { query: { issueId } }),
    )
    expect(list.some((c) => c.id === id)).toBe(true)
    expect(list.map((c) => c.createdAt)).toEqual(
      [...list.map((c) => c.createdAt)].sort((a, b) => a - b),
    )
    call(store, 'PATCH', `/api/comments/${id}`, { body: { body: 'yo' } })
    expect(store.comments.find((c) => c.id === id)?.body).toBe('yo')
    call(store, 'DELETE', `/api/comments/${id}`)
    expect(store.comments.some((c) => c.id === id)).toBe(false)
  })

  it('comments 线程：parentId 存直接父评论、未知父 404、删根级联整棵子树', () => {
    const store = createMockStore({ now: FIXED })
    const root = store.comments[0]
    const addReply = (parentId: string, body: string) =>
      call(store, 'POST', '/api/comments', {
        body: { issueId: root.issueId, authorId: 'member-1', body, parentId },
      })
    expect(addReply(root.id, 'r1').status).toBe(201)
    const reply = store.comments.find((c) => c.body === 'r1')!
    expect(reply.parentId).toBe(root.id)

    // 深层回复：parentId 存直接父（真实树）
    expect(addReply(reply.id, 'r2').status).toBe(201)
    const reply2 = store.comments.find((c) => c.body === 'r2')!
    expect(reply2.parentId).toBe(reply.id)

    // 父评论不存在 / 跨 Issue 的父 → 404
    expect(addReply('comment-nope', 'x').status).toBe(404)
    const otherIssueComment = store.comments.find((c) => c.issueId !== root.issueId)
    if (otherIssueComment) {
      expect(addReply(otherIssueComment.id, 'x').status).toBe(404)
    }

    // 删根级联删整棵子树
    call(store, 'DELETE', `/api/comments/${root.id}`)
    expect(store.comments.some((c) => c.id === reply.id)).toBe(false)
    expect(store.comments.some((c) => c.id === reply2.id)).toBe(false)
  })

  it('activities 按 issue 倒序、recent 按 createdAt 倒序截断', () => {
    const store = createMockStore({ now: FIXED })
    const issueId = store.activities[0].issueId
    const byIssue = items<{ createdAt: number }>(
      call(store, 'GET', '/api/activities', { query: { issueId } }),
    )
    expect(byIssue.length).toBeGreaterThan(0)
    expect(byIssue.map((a) => a.createdAt)).toEqual(
      [...byIssue.map((a) => a.createdAt)].sort((a, b) => b - a),
    )
    const recent = items<{ createdAt: number }>(
      call(store, 'GET', '/api/activities', { query: { recent: '5' } }),
    )
    expect(recent).toHaveLength(5)
    expect(recent.map((a) => a.createdAt)).toEqual(
      [...recent.map((a) => a.createdAt)].sort((a, b) => b - a),
    )
  })

  it('saved-views 创建按名排序、可删除（示例视图随 seed 预置）', () => {
    const store = createMockStore({ now: FIXED })
    const seeded = items<{ name: string }>(call(store, 'GET', '/api/saved-views'))
    expect(seeded.map((v) => v.name)).toContain('我的进行中')
    expect(seeded.map((v) => v.name)).toContain('高优先级待办')
    call(store, 'POST', '/api/saved-views', { body: { name: 'b-view', filters: { a: 1 } } })
    call(store, 'POST', '/api/saved-views', { body: { name: 'a-view', filters: { b: 2 } } })
    const all = items<{ id: string; name: string; filters: string }>(
      call(store, 'GET', '/api/saved-views'),
    )
    expect(all).toHaveLength(seeded.length + 2)
    // 创建的两条按名相邻（a-view 在 b-view 前），示例视图不干扰该次序
    const created = all.filter((v) => v.name === 'a-view' || v.name === 'b-view')
    expect(created.map((v) => v.name)).toEqual(['a-view', 'b-view'])
    expect(created[0]?.filters).toBe(JSON.stringify({ b: 2 }))
    call(store, 'DELETE', `/api/saved-views/${created[0]?.id}`)
    expect(items(call(store, 'GET', '/api/saved-views'))).toHaveLength(seeded.length + 1)
  })
})

describe('站内通知', () => {
  const noticeRows = (res: ApiResponse) =>
    (res.body as { items: Array<Record<string, unknown>> }).items

  const asMember1 = 'user1@oas.dev'
  const asMember2 = 'user2@oas.dev'
  const asViewer = 'user4@oas.dev'

  it('评论提及：按 Bearer 身份隔离，未被提及者看不到', () => {
    const store = createMockStore({ now: FIXED })
    const issueId = store.issues[0].id
    store.issues[0].assigneeId = 'member-1'
    const add = call(store, 'POST', '/api/comments', {
      authorization: bearerFor(store, asMember2),
      body: { issueId, authorId: 'member-2', body: '@张伟 请确认' },
    })
    expect(add.status).toBe(201)

    const mine = noticeRows(
      call(store, 'GET', '/api/notifications', { authorization: bearerFor(store, asMember1) }),
    )
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({
      memberId: 'member-1',
      type: 'mention',
      issueId,
      actorId: 'member-2',
      message: '@张伟 请确认',
      readAt: null,
    })
    expect(
      noticeRows(
        call(store, 'GET', '/api/notifications', { authorization: bearerFor(store, asMember2) }),
      ),
    ).toEqual([])
    expect(
      noticeRows(
        call(store, 'GET', '/api/notifications', { authorization: bearerFor(store, asViewer) }),
      ),
    ).toEqual([])
  })

  it('活动日志驱动：指派给他人 → assigned，关闭类状态 → status，非关闭状态不通知', () => {
    const store = createMockStore({ now: FIXED })
    const issue = store.issues[0]
    issue.assigneeId = null
    const log = (entry: Record<string, unknown>) =>
      call(store, 'POST', '/api/activities', {
        body: { issueId: issue.id, actorId: 'member-2', ...entry },
      })
    log({ type: 'assignee', to: 'member-1' })
    issue.assigneeId = 'member-1'
    log({ type: 'status', to: 'done' })
    log({ type: 'status', to: 'in_progress' })
    // 自己指派给自己：不通知
    log({ type: 'assignee', to: 'member-2' })
    // 详情抽屉按字段名写 assigneeId：也要认（先解除负责人）
    issue.assigneeId = null
    log({ type: 'assigneeId', to: 'member-1' })

    expect(store.notifications.map((n) => `${n.type}:${n.memberId}:${n.message ?? ''}`)).toEqual([
      'assigned:member-1:',
      'status:member-1:done',
      'assigned:member-1:',
    ])
  })

  it('已读：只能标本人通知（他人 id → 404），read-all 只清本人', () => {
    const store = createMockStore({ now: FIXED })
    store.notifications.push(
      { id: 'n1', memberId: 'member-1', type: 'system', readAt: null, createdAt: 1 },
      { id: 'n2', memberId: 'member-1', type: 'system', readAt: null, createdAt: 2 },
      { id: 'n3', memberId: 'member-2', type: 'system', readAt: null, createdAt: 3 },
    )
    const m1 = bearerFor(store, asMember1)
    const m2 = bearerFor(store, asMember2)

    expect(call(store, 'POST', '/api/notifications/n1/read', { authorization: m1 }).status).toBe(
      200,
    )
    expect(store.notifications.find((n) => n.id === 'n1')?.readAt).not.toBeNull()
    expect(call(store, 'POST', '/api/notifications/n3/read', { authorization: m1 }).status).toBe(
      404,
    )
    expect(store.notifications.find((n) => n.id === 'n3')?.readAt).toBeNull()

    expect(call(store, 'POST', '/api/notifications/read-all', { authorization: m1 }).status).toBe(
      200,
    )
    expect(
      store.notifications.filter((n) => n.memberId === 'member-1').every((n) => n.readAt !== null),
    ).toBe(true)
    expect(store.notifications.find((n) => n.id === 'n3')?.readAt).toBeNull()
    expect(
      noticeRows(call(store, 'GET', '/api/notifications', { authorization: m2 })),
    ).toHaveLength(1)
  })

  it('列表倒序 + limit 截断；写方法不合法返回 405', () => {
    const store = createMockStore({ now: FIXED })
    for (let i = 1; i <= 5; i += 1) {
      store.notifications.push({
        id: `n${i}`,
        memberId: 'member-1',
        type: 'system',
        readAt: null,
        createdAt: i,
      })
    }
    const res = call(store, 'GET', '/api/notifications', { query: { limit: '2' } })
    expect(noticeRows(res).map((n) => n.id)).toEqual(['n5', 'n4'])
    expect(call(store, 'PUT', '/api/notifications').status).toBe(405)
    expect(call(store, 'GET', '/api/notifications/n1/read').status).toBe(405)
  })
})

describe('admin 聚合', () => {
  it('stats/workload/health 与 store 对账', () => {
    const store = createMockStore({ now: FIXED })
    const stats = call(store, 'GET', '/api/admin/stats').body as {
      projects: number
      members: number
      issues: number
      done: number
    }
    expect(stats.projects).toBe(3)
    expect(stats.members).toBe(8)
    expect(stats.issues).toBe(MOCK_ISSUE_COUNT)
    expect(stats.done).toBe(store.issues.filter((i) => i.status === 'done').length)

    const workload = items<{ memberId: string; total: number; todo: number; done: number }>(
      call(store, 'GET', '/api/admin/workload'),
    )
    expect(workload.map((w) => w.memberId)).toEqual(store.members.map((m) => m.id))
    const m1 = workload[0]
    expect(m1.total).toBe(store.issues.filter((i) => i.assigneeId === m1.memberId).length)
    expect(m1.done).toBe(
      store.issues.filter((i) => i.assigneeId === m1.memberId && i.status === 'done').length,
    )

    const health = items<{
      projectId: string
      total: number
      overdue: number
      unassigned: number
      stale: number
    }>(call(store, 'GET', '/api/admin/health'))
    expect(health.map((h) => h.projectId)).toEqual(['project-1', 'project-2', 'project-3'])
    const now = Date.now()
    const open = store.issues.filter(
      (i) => i.projectId === 'project-1' && i.status !== 'done' && i.status !== 'cancelled',
    )
    const h1 = health[0]
    expect(h1.total).toBe(store.issues.filter((i) => i.projectId === 'project-1').length)
    expect(h1.overdue).toBe(open.filter((i) => i.dueAt !== null && i.dueAt < now).length)
    expect(h1.unassigned).toBe(open.filter((i) => !i.assigneeId).length)
    expect(h1.stale).toBe(open.filter((i) => i.updatedAt < now - 14 * DAY).length)
  })
})
