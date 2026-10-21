import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PMDatabase } from '@/db/schema'
import { createDexieRepositories } from '@/data/dexie'
import type { IssueWindowFilters, Repositories } from '@/data/types'
import type { Activity, Comment, Issue } from '@/types'
import { createApiRepositories, type ApiTransport } from './client'
import { createMockStore, handleApi, type MockStore } from './mock-server'

const FIXED = 1_700_000_000_000
const projectId = 'project-1'

const directTransport =
  (store: MockStore): ApiTransport =>
  async (method, path, query, body) =>
    handleApi(store, { method, path, query, body })

const filters = (over: Partial<IssueWindowFilters> = {}): IssueWindowFilters => ({
  projectId,
  statusFilter: [],
  assigneeFilter: [],
  priorityFilter: [],
  search: '',
  myOnly: false,
  sortBy: 'updatedAt',
  ...over,
})

function first<T>(obs: {
  subscribe(o: { next(v: T): void; error?(e: unknown): void }): () => void
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let unsub: () => void = () => {}
    const timer = setTimeout(() => {
      unsub()
      reject(new Error('observable 未推送'))
    }, 5000)
    unsub = obs.subscribe({
      next: (v) => {
        clearTimeout(timer)
        unsub()
        resolve(v)
      },
      error: (e) => {
        clearTimeout(timer)
        unsub()
        reject(e)
      },
    })
  })
}

const _sortById = <T extends { id: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.id < b.id ? -1 : 1))

describe('契约：同一份 seed 下 Dexie 与 API 输出相同', () => {
  let store: MockStore
  let db: PMDatabase
  let dexie: Repositories
  let api: Repositories

  beforeEach(async () => {
    store = createMockStore({ now: FIXED })
    db = new PMDatabase(`contract-${crypto.randomUUID()}`)
    await db.open()
    await db.issues.bulkPut(store.issues)
    await db.projects.bulkPut(store.projects)
    await db.members.bulkPut(store.members)
    await db.comments.bulkPut(store.comments)
    await db.savedViews.bulkPut(store.savedViews)
    await db.activities.bulkPut(store.activities)
    await db.settings.bulkPut(store.settings)
    dexie = createDexieRepositories(db)
    api = createApiRepositories({ transport: directTransport(store), pollMs: 10 })
  })

  it('liveWindow：两种实现输出一致的窗口（limit 截断 + updatedAt 倒序）', async () => {
    for (const limit of [undefined, 30]) {
      const a = await first(api.issues.liveWindow(filters(), 'member-1', limit))
      const d = await first(dexie.issues.liveWindow(filters(), 'member-1', limit))
      expect(a).toEqual(d)
      expect(a.length).toBe(limit ?? 500)
    }
  })

  it('liveWindow：search 全局匹配一致（无视 project/status）', async () => {
    const kw = store.issues[0].title.replace(/ #\d+$/, '')
    for (const f of [
      filters({ search: kw }),
      filters({ search: kw, statusFilter: ['done'], projectId: 'project-2' }),
      filters({ search: kw, statusFilter: ['done', 'todo'] }),
      filters({ search: 'APP-' }),
    ]) {
      const a = await first(api.issues.liveWindow(f, 'member-1', 100))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 100))
      expect(a).toEqual(d)
      expect(a.length).toBeGreaterThan(0)
    }
  })

  it('liveWindow：status/assignee/priority/myOnly 过滤一致', async () => {
    const cases = [
      filters({ statusFilter: ['in_progress'] }),
      filters({ assigneeFilter: ['member-3'] }),
      filters({ priorityFilter: ['urgent'] }),
      filters({ myOnly: true }),
      filters({ statusFilter: ['done'], priorityFilter: ['high'], assigneeFilter: ['member-2'] }),
    ]
    for (const f of cases) {
      const a = await first(api.issues.liveWindow(f, 'member-1', 60))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 60))
      expect(a).toEqual(d)
    }
  })

  it('liveWindow：多选（组内 OR / 组间 AND）与 __none__ 一致', async () => {
    const cases = [
      filters({ statusFilter: ['todo', 'in_progress'] }),
      filters({ statusFilter: ['backlog', 'done', 'cancelled'] }),
      filters({ assigneeFilter: ['member-2', 'member-4'] }),
      filters({ priorityFilter: ['urgent', 'low'] }),
      filters({
        statusFilter: ['todo', 'done'],
        assigneeFilter: ['member-1', 'member-2'],
        priorityFilter: ['high', 'medium'],
      }),
      filters({ statusFilter: ['todo', 'done'], sortBy: 'priority' }),
    ]
    for (const f of cases) {
      const a = await first(api.issues.liveWindow(f, 'member-1', 60))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 60))
      expect(a).toEqual(d)
      expect(a.length).toBeGreaterThan(0)
    }
    // __none__ = 未分配：种子窗口内必有未分配行，但数量不保证 → 只断言语义与两实现一致
    for (const assigneeFilter of [['__none__'], ['__none__', 'member-1']]) {
      const f = filters({ assigneeFilter })
      const a = await first(api.issues.liveWindow(f, 'member-1', 60))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 60))
      expect(a).toEqual(d)
      expect(a.every((i) => i.assigneeId === null || assigneeFilter.includes(i.assigneeId))).toBe(
        true,
      )
    }
  })

  it('liveWindow：sortBy priority/createdAt 在窗口内重排一致', async () => {
    for (const sortBy of ['priority', 'createdAt'] as const) {
      const a = await first(api.issues.liveWindow(filters({ sortBy }), 'member-1', 80))
      const d = await first(dexie.issues.liveWindow(filters({ sortBy }), 'member-1', 80))
      expect(a).toEqual(d)
    }
  })

  it('liveCounts 与 liveAssigneeWorkload 一致', async () => {
    expect(await first(api.issues.liveCounts('project-2'))).toEqual(
      await first(dexie.issues.liveCounts('project-2')),
    )
    expect(await first(api.issues.liveAssigneeWorkload(projectId))).toEqual(
      await first(dexie.issues.liveAssigneeWorkload(projectId)),
    )
  })

  it('liveSubIssues / liveRelationCandidates / liveByCreatedSince 一致', async () => {
    const parent = store.issues[0].id
    expect(await first(api.issues.liveSubIssues(parent))).toEqual(
      await first(dexie.issues.liveSubIssues(parent)),
    )
    expect(await first(api.issues.liveRelationCandidates(projectId, 25))).toEqual(
      await first(dexie.issues.liveRelationCandidates(projectId, 25)),
    )
    const since = FIXED - 400 * 86_400_000
    expect(await first(api.issues.liveByCreatedSince(since))).toEqual(
      await first(dexie.issues.liveByCreatedSince(since)),
    )
  })

  it('listAll / bulkGet / get / live 一致', async () => {
    expect(await api.issues.listAll(12)).toEqual(await dexie.issues.listAll(12))
    const ids = [store.issues[4].id, 'missing', store.issues[2].id]
    expect(await api.issues.bulkGet(ids)).toEqual(await dexie.issues.bulkGet(ids))
    const id = store.issues[7].id
    expect(await api.issues.get(id)).toEqual(await dexie.issues.get(id))
    expect(await api.issues.get('missing')).toBe(await dexie.issues.get('missing'))
    expect(await first(api.issues.live(id))).toEqual(await first(dexie.issues.live(id)))
    expect(await first(api.issues.live('missing'))).toBe(await first(dexie.issues.live('missing')))
  })

  it('updateMany 批量更新效果一致', async () => {
    const ids = store.issues.slice(0, 3).map((i) => i.id)
    const updates = ids.map((id) => ({ id, changes: { priority: 'low' as const } }))
    const before = store.issues[0].updatedAt
    await dexie.issues.updateMany(updates)
    await api.issues.updateMany(updates)
    const pick = (rows: Issue[]) => rows.map((r) => ({ id: r.id, priority: r.priority }))
    const apiRows = await api.issues.bulkGet(ids)
    const dexieRows = await dexie.issues.bulkGet(ids)
    expect(pick(apiRows as Issue[])).toEqual(pick(dexieRows as Issue[]))
    expect((apiRows[0] as Issue).updatedAt).toBeGreaterThan(before)
    expect((dexieRows[0] as Issue).updatedAt).toBeGreaterThan(before)
    // 批量更新把 updatedAt 抹平 → 窗口里这 3 行的先后完全由并列键规则决定
    const apiWindow = await first(api.issues.liveWindow(filters(), 'member-1', 3))
    const dexieWindow = await first(dexie.issues.liveWindow(filters(), 'member-1', 3))
    expect(apiWindow.map((r) => r.id)).toEqual(dexieWindow.map((r) => r.id))
  })

  it('bulkApply 补丁与活动一致（assignee null → to 空串）', async () => {
    const ids = store.issues.slice(0, 2).map((i) => i.id)
    const patch = { status: 'done' as const, assigneeId: null }
    await dexie.issues.bulkApply(ids, patch, 'member-4')
    await api.issues.bulkApply(ids, patch, 'member-4')

    const rows = (await api.issues.bulkGet(ids)) as Issue[]
    expect(rows.map((r) => [r.status, r.assigneeId])).toEqual(
      ((await dexie.issues.bulkGet(ids)) as Issue[]).map((r) => [r.status, r.assigneeId]),
    )

    const mine = (rows2: Activity[]) =>
      rows2
        .filter((a) => a.actorId === 'member-4' && ids.includes(a.issueId))
        .map((a) => `${a.issueId}|${a.type}|${a.field}|${a.to}`)
        .sort()
    const apiActs = await first(api.activities.liveByIssue(ids[0]))
    const dexieActs = await first(dexie.activities.liveByIssue(ids[0]))
    expect(mine(apiActs)).toEqual(mine(dexieActs))
  })

  it('bulkDelete 批量删除一致', async () => {
    const ids = store.issues.slice(5, 9).map((i) => i.id)
    const drop = [ids[0], ids[2]]
    await dexie.issues.bulkDelete(drop)
    await api.issues.bulkDelete(drop)
    expect((await api.issues.bulkGet(ids)).map((r) => Boolean(r))).toEqual([
      false,
      true,
      false,
      true,
    ])
    expect((await dexie.issues.bulkGet(ids)).map((r) => Boolean(r))).toEqual([
      false,
      true,
      false,
      true,
    ])
  })

  it('create 分配 key 与字段语义一致', async () => {
    const input = {
      projectId,
      title: '契约新建',
      status: 'todo' as const,
      priority: 'medium' as const,
      assigneeId: null,
      reporterId: 'member-1',
    }
    const a = await api.issues.create(input)
    const d = await dexie.issues.create(input)
    expect(a.key).toBe('OAS-100001')
    expect(d.key).toBe('OAS-100001')
    const a2 = await api.issues.create(input)
    const d2 = await dexie.issues.create(input)
    expect(a2.key).toBe('OAS-100002')
    expect(d2.key).toBe('OAS-100002')
    expect(a.projectId).toBe(d.projectId)
    expect(a.parentId).toBe(d.parentId)
    expect(a.labels).toEqual(d.labels)
    const ghost = await api.issues.create({ ...input, projectId: 'ghost' })
    expect(ghost.key).toBe('OAS-100001')
  })

  it('settings get/set/live 一致', async () => {
    expect(await api.settings.get('labels')).toEqual(await dexie.settings.get('labels'))
    expect(await api.settings.get('missing')).toBe(await dexie.settings.get('missing'))
    await api.settings.set('labels', ['x'])
    await dexie.settings.set('labels', ['x'])
    expect(await first(api.settings.live<string[]>('labels'))).toEqual(
      await first(dexie.settings.live<string[]>('labels')),
    )
    expect(await first(api.settings.live<string[]>('missing'))).toBe(
      await first(dexie.settings.live<string[]>('missing')),
    )
  })

  it('savedViews create/delete 与按名排序一致', async () => {
    await api.savedViews.create('b-view', { a: 1 })
    await dexie.savedViews.create('b-view', { a: 1 })
    await api.savedViews.create('a-view', { b: 2 })
    await dexie.savedViews.create('a-view', { b: 2 })
    const shape = (rows: Array<{ name: string; filters: string }>) =>
      rows.map((r) => ({ name: r.name, filters: r.filters }))
    const apiRows = await first(api.savedViews.liveAll())
    const dexieRows = await first(dexie.savedViews.liveAll())
    expect(shape(apiRows)).toEqual(shape(dexieRows))
    await api.savedViews.delete(apiRows[0].id)
    await dexie.savedViews.delete(dexieRows[0].id)
    expect(shape(await first(api.savedViews.liveAll()))).toEqual(
      shape(await first(dexie.savedViews.liveAll())),
    )
  })

  it('comments 增改删与按时间排序一致（同毫秒并列按主键序，不比顺序）', async () => {
    const issueId = store.issues[0].id
    await api.comments.add({ issueId, authorId: 'member-1', body: 'a' })
    await dexie.comments.add({ issueId, authorId: 'member-1', body: 'a' })
    await api.comments.add({ issueId, authorId: 'member-2', body: 'b' })
    await dexie.comments.add({ issueId, authorId: 'member-2', body: 'b' })
    // 新评论 id 由各自实现生成，跨实现只比内容多重集
    const shape = (rows: Comment[]) =>
      rows.map((r) => `${r.issueId}|${r.authorId}|${r.body}`).sort()
    const apiRows = await first(api.comments.liveByIssue(issueId))
    const dexieRows = await first(dexie.comments.liveByIssue(issueId))
    expect(shape(apiRows)).toEqual(shape(dexieRows))

    const apiTarget = apiRows.find((c) => c.body === 'a')
    const dexieTarget = dexieRows.find((c) => c.body === 'a')
    expect(apiTarget && dexieTarget).toBeTruthy()
    await api.comments.update(apiTarget!.id, 'edited')
    await dexie.comments.update(dexieTarget!.id, 'edited')
    expect(shape(await first(api.comments.liveByIssue(issueId)))).toEqual(
      shape(await first(dexie.comments.liveByIssue(issueId))),
    )

    await api.comments.delete(apiTarget!.id)
    await dexie.comments.delete(dexieTarget!.id)
    expect(shape(await first(api.comments.liveByIssue(issueId)))).toEqual(
      shape(await first(dexie.comments.liveByIssue(issueId))),
    )
  })

  it('activities log/liveByIssue/liveRecent 一致', async () => {
    const issueId = store.issues[0].id
    const apiBefore = await first(api.activities.liveRecent(5))
    const dexieBefore = await first(dexie.activities.liveRecent(5))
    expect(apiBefore.map((a) => a.id)).toEqual(dexieBefore.map((a) => a.id))

    await api.activities.log({
      issueId,
      actorId: 'member-2',
      type: 'status',
      field: 'status',
      from: 'todo',
      to: 'done',
    })
    await dexie.activities.log({
      issueId,
      actorId: 'member-2',
      type: 'status',
      field: 'status',
      from: 'todo',
      to: 'done',
    })
    const shape = (rows: Activity[]) =>
      rows.map((r) => `${r.issueId}|${r.actorId}|${r.type}|${r.field ?? ''}|${r.to ?? ''}`).sort()
    expect(shape(await first(api.activities.liveByIssue(issueId)))).toEqual(
      shape(await first(dexie.activities.liveByIssue(issueId))),
    )
    const apiRecent = await first(api.activities.liveRecent(5))
    const dexieRecent = await first(dexie.activities.liveRecent(5))
    expect(apiRecent[0].actorId).toBe('member-2')
    expect(dexieRecent[0].actorId).toBe('member-2')
    expect(apiRecent.slice(1).map((a) => a.id)).toEqual(dexieRecent.slice(1).map((a) => a.id))
  })

  it('projects / members 读写与守卫一致', async () => {
    expect(await api.projects.all()).toEqual(await dexie.projects.all())
    expect(await first(api.projects.liveAll())).toEqual(await first(dexie.projects.liveAll()))
    expect(await api.members.all()).toEqual(await dexie.members.all())
    expect(await first(api.members.liveAll())).toEqual(await first(dexie.members.liveAll()))

    expect(await api.projects.allocateKey(projectId)).toBe(100001)
    expect(await dexie.projects.allocateKey(projectId)).toBe(100001)
    expect(await api.projects.allocateKey(projectId)).toBe(100002)
    expect(await dexie.projects.allocateKey(projectId)).toBe(100002)

    await expect(api.projects.delete(projectId)).rejects.toThrow()
    await expect(dexie.projects.delete(projectId)).rejects.toThrow()
    await expect(api.members.update('member-1', { role: 'viewer' })).rejects.toThrow()
    await expect(dexie.members.update('member-1', { role: 'viewer' })).rejects.toThrow()

    await api.members.update('member-4', { role: 'member' })
    await dexie.members.update('member-4', { role: 'member' })
    expect((await api.members.get('member-4'))?.role).toBe(
      (await dexie.members.get('member-4'))?.role,
    )

    await api.members.delete('member-6')
    await dexie.members.delete('member-6')
    const shape = (rows: Array<{ id: string; role: string }>) =>
      rows.map((r) => ({ id: r.id, role: r.role }))
    expect(shape(await api.members.all())).toEqual(shape(await dexie.members.all()))
    expect(store.issues.filter((i) => i.assigneeId === 'member-6')).toHaveLength(0)
    expect(await db.issues.where('assigneeId').equals('member-6').count()).toBe(0)
  })

  it('admin stats/workload/health 一致', async () => {
    expect(await first(api.admin.liveGlobalStats())).toEqual(
      await first(dexie.admin.liveGlobalStats()),
    )
    const workloadShape = (
      rows: Array<{
        memberId: string
        total: number
        todo: number
        inProgress: number
        done: number
      }>,
    ) => rows.map((r) => ({ ...r }))
    expect(workloadShape(await first(api.admin.liveMemberWorkload()))).toEqual(
      workloadShape(await first(dexie.admin.liveMemberWorkload())),
    )
    const apiHealth = await first(api.admin.liveProjectHealth())
    const dexieHealth = await first(dexie.admin.liveProjectHealth())
    expect(apiHealth).toEqual(dexieHealth)
  })

  it('export 信封同构、import 跨模式往返', async () => {
    const dexieJson = JSON.parse(await dexie.admin.exportAll())
    const apiJson = JSON.parse(await api.admin.exportAll())
    expect(apiJson.app).toBe(dexieJson.app)
    expect(apiJson.version).toBe(dexieJson.version)
    expect(apiJson.tables).toEqual(dexieJson.tables)

    await dexie.admin.wipeAll()
    await api.admin.wipeAll()
    expect(await api.issues.listAll(5)).toHaveLength(0)

    await dexie.admin.importAll(JSON.stringify(dexieJson))
    await api.admin.importAll(JSON.stringify(dexieJson))
    expect(JSON.parse(await api.admin.exportAll()).tables).toEqual(
      JSON.parse(await dexie.admin.exportAll()).tables,
    )

    await expect(api.admin.importAll('not-json')).rejects.toThrow()
    await expect(dexie.admin.importAll('not-json')).rejects.toThrow()
    await expect(api.admin.importAll('{"app":"other","tables":{}}')).rejects.toThrow()
    await expect(dexie.admin.importAll('{"app":"other","tables":{}}')).rejects.toThrow()
  })

  it('api.admin.resetDemo 复位到确定性种子', async () => {
    await api.issues.bulkDelete(store.issues.slice(0, 10).map((i) => i.id))
    expect(await api.issues.listAll(5000)).toHaveLength(store.issues.length)
    await api.admin.resetDemo()
    const json = JSON.parse(await api.admin.exportAll())
    expect(json.tables.issues).toEqual(
      JSON.parse(JSON.stringify(store.seed.issues)).sort((a: Issue, b: Issue) =>
        a.id < b.id ? -1 : 1,
      ),
    )
  })
})

describe('Observable：轮询推送', () => {
  const waitFor = async (check: () => boolean, label: string) => {
    const deadline = Date.now() + 3000
    while (!check()) {
      if (Date.now() > deadline) throw new Error(`超时：${label}`)
      await new Promise((r) => setTimeout(r, 5))
    }
  }

  it('订阅即推一次；revision 未变不重取；变化后推送；退订停轮', async () => {
    const store = createMockStore({ now: FIXED })
    const calls: string[] = []
    const transport: ApiTransport = async (method, path, query, body) => {
      calls.push(`${method} ${path}`)
      return handleApi(store, { method, path, query, body })
    }
    const api = createApiRepositories({ transport, pollMs: 15 })

    const seen: number[] = []
    const unsub = api.issues.liveCounts(projectId).subscribe({
      next: (v) => seen.push(v.byStatus.done),
    })
    await waitFor(() => seen.length === 1, '首次推送')

    const countCalls = () => calls.filter((c) => c === 'GET /api/issues/counts').length
    expect(countCalls()).toBe(1)
    await new Promise((r) => setTimeout(r, 90))
    expect(countCalls()).toBe(1)

    const target = store.issues.find((i) => i.projectId === projectId && i.status !== 'done')
    expect(target).toBeTruthy()
    handleApi(store, {
      method: 'PATCH',
      path: `/api/issues/${target?.id}`,
      query: new URLSearchParams(),
      body: { changes: { status: 'done' } },
    })
    await waitFor(() => seen.length === 2, '再次推送')
    expect(seen[1]).toBe((seen[0] ?? 0) + 1)
    expect(countCalls()).toBe(2)

    unsub()
    const callsAtUnsub = countCalls()
    handleApi(store, {
      method: 'PATCH',
      path: `/api/issues/${target?.id}`,
      query: new URLSearchParams(),
      body: { changes: { status: 'todo' } },
    })
    await new Promise((r) => setTimeout(r, 90))
    expect(countCalls()).toBe(callsAtUnsub)
    expect(seen).toHaveLength(2)
  })

  it('错误传播：请求失败时调用 observer.error', async () => {
    const api = createApiRepositories({
      transport: async () => {
        throw new Error('offline')
      },
      pollMs: 15,
    })
    const err = await new Promise<unknown>((resolve) => {
      api.issues.liveCounts(projectId).subscribe({
        next: () => undefined,
        error: (e) => resolve(e),
      })
    })
    expect((err as Error).message).toBe('offline')
  })
})
