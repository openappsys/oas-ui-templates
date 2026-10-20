import { describe, expect, it } from 'vitest'
import { ISSUE_STATUSES, type Issue } from '@/types'
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

const req = (
  method: string,
  path: string,
  init: { query?: Record<string, string>; body?: unknown } = {},
): ApiRequest => ({
  method,
  path,
  query: new URLSearchParams(init.query ?? {}),
  body: init.body,
})

const call = (
  store: MockStore,
  method: string,
  path: string,
  init: { query?: Record<string, string>; body?: unknown } = {},
): ApiResponse => handleApi(store, req(method, path, init))

const items = <T>(res: ApiResponse): T[] => (res.body as { items: T[] }).items

const tables = (store: MockStore) => ({
  issues: store.issues,
  projects: store.projects,
  members: store.members,
  comments: store.comments,
  savedViews: store.savedViews,
  activities: store.activities,
  settings: store.settings,
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
    expect(store.issues.some((i) => i.id === issue.id)).toBe(false)
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

  it('bulk-delete 批量删除', () => {
    const store = createMockStore({ now: FIXED })
    const ids = store.issues.slice(0, 3).map((i) => i.id)
    call(store, 'POST', '/api/issues/bulk-delete', { body: { ids: [ids[0], ids[2]] } })
    expect(store.issues.some((i) => i.id === ids[0])).toBe(false)
    expect(store.issues.some((i) => i.id === ids[1])).toBe(true)
    expect(store.issues.some((i) => i.id === ids[2])).toBe(false)
  })
})

describe('派生查询与聚合', () => {
  it('counts 统计全项目各状态', () => {
    const store = createMockStore({ now: FIXED })
    const body = call(store, 'GET', '/api/issues/counts', {
      query: { projectId: 'project-1' },
    }).body as { total: number; byStatus: Record<string, number> }
    const rows = store.issues.filter((i) => i.projectId === 'project-1')
    expect(body.total).toBe(rows.length)
    expect(Object.keys(body.byStatus)).toEqual(ISSUE_STATUSES)
    for (const s of ISSUE_STATUSES) {
      expect(body.byStatus[s]).toBe(rows.filter((i) => i.status === s).length)
    }
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

  it('sub-issues / relation-candidates / bulkGet / listAll / created-since', () => {
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
    const recent = items<Issue>(
      call(store, 'GET', '/api/issues/created-since', { query: { since: String(since) } }),
    )
    expect(recent.length).toBeGreaterThan(0)
    expect(recent.every((i) => i.createdAt >= since)).toBe(true)
    expect(recent.map((i) => i.createdAt)).toEqual(
      [...recent.map((i) => i.createdAt)].sort((x, y) => x - y),
    )
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
  it('export 信封含 7 张表与元信息', () => {
    const store = createMockStore({ now: FIXED })
    const body = call(store, 'GET', '/api/admin/export').body as {
      app: string
      version: number
      exportedAt: number
      tables: Record<string, unknown[]>
    }
    expect(body.app).toBe('oas-pm')
    expect(body.version).toBe(6)
    expect(typeof body.exportedAt).toBe('number')
    expect(Object.keys(body.tables).sort()).toEqual([
      'activities',
      'comments',
      'issues',
      'members',
      'projects',
      'savedViews',
      'settings',
    ])
    expect(body.tables.issues).toHaveLength(MOCK_ISSUE_COUNT)
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
    const handle = createMockHandler()
    const r = (body: unknown) => body as { revision: number }
    const first = r(handle(req('GET', '/api/revision')).body).revision
    handle(req('POST', '/api/issues/bulk-delete', { body: { ids: ['nope'] } }))
    expect(r(handle(req('GET', '/api/revision')).body).revision).toBe(first + 1)
    handle(req('POST', '/api/admin/reset'))
    expect(r(handle(req('GET', '/api/revision')).body).revision).toBe(first + 2)
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

  it('saved-views 创建按名排序、可删除', () => {
    const store = createMockStore({ now: FIXED })
    call(store, 'POST', '/api/saved-views', { body: { name: 'b-view', filters: { a: 1 } } })
    call(store, 'POST', '/api/saved-views', { body: { name: 'a-view', filters: { b: 2 } } })
    const all = items<{ id: string; name: string; filters: string }>(
      call(store, 'GET', '/api/saved-views'),
    )
    expect(all.map((v) => v.name)).toEqual(['a-view', 'b-view'])
    expect(all[0].filters).toBe(JSON.stringify({ b: 2 }))
    call(store, 'DELETE', `/api/saved-views/${all[0].id}`)
    expect(items(call(store, 'GET', '/api/saved-views')).length).toBe(1)
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
