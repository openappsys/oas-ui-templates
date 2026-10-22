import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PMDatabase } from '@/db/schema'
import { createDexieRepositories } from '@/data/dexie'
import type { IssueWindowFilters, Repositories } from '@/data/types'
import { CURRENT_CYCLE, NO_CYCLE } from '@/lib/cycles'
import { ALL_PROJECTS, LIST_WINDOW } from '@/lib/filters'
import type { Activity, Comment, Issue, Notification } from '@/types'
import { createApiRepositories, type ApiTransport } from './client'
import { createMockStore, handleApi, type MockStore } from './mock-server'

const FIXED = 1_700_000_000_000
const projectId = 'project-1'

const ADMIN_EMAIL = 'user1@oas.dev'
const DEMO_PASSWORD = 'oas'

/** 直连 handler 的映射层补上 Bearer：契约测试默认以 admin 身份跑（鉴权路径真实生效） */
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

const directTransport =
  (store: MockStore): ApiTransport =>
  async (method, path, query, body) =>
    handleApi(store, {
      method,
      path,
      query,
      body,
      // client 传下来的 token 可能是 null（测试不注入会话）；契约测试固定用 admin token
      authorization: adminBearer(store),
    })

const filters = (over: Partial<IssueWindowFilters> = {}): IssueWindowFilters => ({
  projectId,
  statusFilter: [],
  assigneeFilter: [],
  priorityFilter: [],
  search: '',
  myOnly: false,
  cycleFilter: null,
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
    await db.cycles.bulkPut(store.cycles)
    dexie = createDexieRepositories(db)
    api = createApiRepositories({ transport: directTransport(store), pollMs: 10 })
  })

  it('liveWindow：两种实现输出一致的窗口（limit 截断 + updatedAt 倒序）', async () => {
    for (const limit of [undefined, 30]) {
      const a = await first(api.issues.liveWindow(filters(), 'member-1', limit))
      const d = await first(dexie.issues.liveWindow(filters(), 'member-1', limit))
      expect(a).toEqual(d)
      expect(a.length).toBe(limit ?? LIST_WINDOW)
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

  it('全部项目哨兵：窗口/计数/工作量跨项目聚合一致', async () => {
    const cases = [
      filters({ projectId: ALL_PROJECTS }),
      filters({ projectId: ALL_PROJECTS, statusFilter: ['todo', 'done'] }),
      filters({ projectId: ALL_PROJECTS, statusFilter: ['backlog', 'in_progress', 'cancelled'] }),
      filters({ projectId: ALL_PROJECTS, myOnly: true }),
      filters({ projectId: ALL_PROJECTS, statusFilter: ['in_progress'], sortBy: 'priority' }),
      filters({
        projectId: ALL_PROJECTS,
        priorityFilter: ['urgent', 'low'],
        assigneeFilter: ['member-2', 'member-4'],
      }),
    ]
    for (const f of cases) {
      const a = await first(api.issues.liveWindow(f, 'member-1', 60))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 60))
      expect(a).toEqual(d)
      expect(a.length).toBeGreaterThan(0)
    }
    // 全项目窗口铺满 500 条：两实现同序、且必含多个项目（跨项目并集）
    const apiAll = await first(
      api.issues.liveWindow(filters({ projectId: ALL_PROJECTS }), 'member-1'),
    )
    const dexieAll = await first(
      dexie.issues.liveWindow(filters({ projectId: ALL_PROJECTS }), 'member-1'),
    )
    expect(apiAll).toEqual(dexieAll)
    expect(apiAll.length).toBe(LIST_WINDOW)
    expect(new Set(apiAll.map((i) => i.projectId)).size).toBeGreaterThan(1)

    const counts = await first(dexie.issues.liveCounts(ALL_PROJECTS))
    expect(await first(api.issues.liveCounts(ALL_PROJECTS))).toEqual(counts)
    expect(counts.total).toBe(store.issues.length)
    expect(await first(api.issues.liveAssigneeWorkload(ALL_PROJECTS))).toEqual(
      await first(dexie.issues.liveAssigneeWorkload(ALL_PROJECTS)),
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

  it('cycles liveAll 一致（startAt 倒序），CRUD 语义对齐', async () => {
    const shape = (
      rows: Array<{ projectId: string; name: string; startAt: number; endAt: number }>,
    ) => rows.map((r) => `${r.projectId}|${r.name}|${r.startAt}|${r.endAt}`)
    expect(shape(await first(api.cycles.liveAll(projectId)))).toEqual(
      shape(await first(dexie.cycles.liveAll(projectId))),
    )
    expect(shape(await first(api.cycles.liveAll(ALL_PROJECTS)))).toEqual(
      shape(await first(dexie.cycles.liveAll(ALL_PROJECTS))),
    )

    const input = { projectId: 'project-2', name: 'API 周期', startAt: 1, endAt: 2, goal: 'g' }
    const apiCycle = await api.cycles.create(input)
    const dexieCycle = await dexie.cycles.create(input)
    // id 与 createdAt/updatedAt 由各自实现取当刻时钟（可能不同毫秒），跨实现只比业务字段
    const stable = (c: typeof apiCycle) => ({
      projectId: c.projectId,
      name: c.name,
      startAt: c.startAt,
      endAt: c.endAt,
      goal: c.goal,
    })
    expect(stable(apiCycle)).toEqual(stable(dexieCycle))
    expect((await first(api.cycles.liveAll('project-2'))).length).toBe(1)
    expect((await first(dexie.cycles.liveAll('project-2'))).length).toBe(1)

    await api.cycles.update(apiCycle.id, { name: '改' })
    await dexie.cycles.update(dexieCycle.id, { name: '改' })
    expect(shape(await first(api.cycles.liveAll('project-2')))).toEqual(
      shape(await first(dexie.cycles.liveAll('project-2'))),
    )

    await api.cycles.delete(apiCycle.id)
    await dexie.cycles.delete(dexieCycle.id)
    expect(await first(api.cycles.liveAll('project-2'))).toEqual([])
    expect(await first(dexie.cycles.liveAll('project-2'))).toEqual([])
  })

  it('liveWindow cycleFilter 一致：具体周期 / 未入迭代 / 当前迭代', async () => {
    const now = Date.now()
    const liveCycle = {
      id: 'cycle-live',
      projectId,
      name: 'Live',
      startAt: now - 3_600_000,
      endAt: now + 86_400_000,
      createdAt: now,
      updatedAt: now,
    }
    await db.cycles.add(liveCycle)
    store.cycles.push(structuredClone(liveCycle))
    // 取窗口内的几条 Issue 挂到「当前」周期（两种实现同一批）
    const picked = store.issues
      .filter((i) => i.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 4)
    const pickedIds = new Set(picked.map((i) => i.id))
    await db.issues.bulkPut(picked.map((i) => ({ ...i, cycleId: liveCycle.id })))
    for (const row of store.issues) if (pickedIds.has(row.id)) row.cycleId = liveCycle.id

    const cases = [
      filters({ cycleFilter: 'cycle-2' }),
      filters({ cycleFilter: NO_CYCLE }),
      filters({ cycleFilter: CURRENT_CYCLE }),
      filters({ cycleFilter: CURRENT_CYCLE, statusFilter: ['done'] }),
      filters({ cycleFilter: NO_CYCLE, projectId: ALL_PROJECTS }),
      filters({ cycleFilter: 'cycle-2', projectId: ALL_PROJECTS }),
    ]
    for (const f of cases) {
      const a = await first(api.issues.liveWindow(f, 'member-1', 200))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 200))
      expect(a).toEqual(d)
    }
    // 当前迭代确实命中挂载的 4 条
    const current = await first(
      api.issues.liveWindow(filters({ cycleFilter: CURRENT_CYCLE }), 'member-1', 200),
    )
    expect(current.map((i) => i.id).sort()).toEqual(picked.map((i) => i.id).sort())
  })

  it('liveWindow 具体周期直取一致：整周期 + 小 limit 分页（不受 updatedAt 窗口截断）', async () => {
    for (const limit of [undefined, 3]) {
      for (const f of [
        filters({ cycleFilter: 'cycle-2' }),
        filters({ cycleFilter: 'cycle-2', statusFilter: ['done'] }),
        filters({ cycleFilter: 'cycle-2', statusFilter: ['todo', 'done'] }),
        filters({ cycleFilter: 'cycle-2', assigneeFilter: ['member-2'] }),
        filters({ cycleFilter: 'cycle-2', priorityFilter: ['high'] }),
        filters({ cycleFilter: 'cycle-2', projectId: ALL_PROJECTS }),
        filters({ cycleFilter: 'cycle-2', sortBy: 'priority' }),
        filters({ cycleFilter: 'cycle-2', sortBy: 'createdAt' }),
      ]) {
        const a = await first(api.issues.liveWindow(f, 'member-1', limit))
        const d = await first(dexie.issues.liveWindow(f, 'member-1', limit))
        expect(a).toEqual(d)
      }
    }
    // 直取的是「该周期全部工作项」而非窗口切片：条数 = min(limit, 周期条数)
    const expected = store.issues.filter((i) => i.cycleId === 'cycle-2').length
    const all = await first(api.issues.liveWindow(filters({ cycleFilter: 'cycle-2' }), 'member-1'))
    expect(all.length).toBe(Math.min(500, expected))
  })

  it('liveCycleCounts 一致：按周期聚合（含未入迭代桶），两种数据源同序同值', async () => {
    for (const pid of [projectId, ALL_PROJECTS, 'project-2']) {
      expect(await first(api.issues.liveCycleCounts(pid))).toEqual(
        await first(dexie.issues.liveCycleCounts(pid)),
      )
    }
    const rows = await first(dexie.issues.liveCycleCounts(projectId))
    expect(rows[0]?.cycleId).toBe(null)
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(
      store.issues.filter((i) => i.projectId === projectId).length,
    )
  })

  it('liveCycleIssues 一致：整周期 id 升序（缺失周期返回空）', async () => {
    for (const [pid, cid] of [
      [projectId, 'cycle-2'],
      [projectId, 'cycle-3'],
      [ALL_PROJECTS, 'cycle-2'],
      [projectId, 'ghost'],
    ] as const) {
      expect(await first(api.issues.liveCycleIssues(pid, cid))).toEqual(
        await first(dexie.issues.liveCycleIssues(pid, cid)),
      )
    }
    expect(
      (await first(dexie.issues.liveCycleIssues(projectId, 'cycle-2'))).length,
    ).toBeGreaterThan(0)
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

  it('notifications 一致：评论/活动写路径生成同一组通知，读态语义一致', async () => {
    const issue = store.issues[0]
    // 负责人先设为 member-1：普通评论 → comment，@提及 → mention
    issue.assigneeId = 'member-1'
    await db.issues.update(issue.id, { assigneeId: 'member-1' })
    for (const body of ['@张伟 请确认', '进度如何']) {
      await api.comments.add({ issueId: issue.id, authorId: 'member-2', body })
      await dexie.comments.add({ issueId: issue.id, authorId: 'member-2', body })
    }
    // 解除指派 → 指派给 member-1：assigned；再关闭：status
    issue.assigneeId = null
    await db.issues.update(issue.id, { assigneeId: null })
    await api.activities.log({
      issueId: issue.id,
      actorId: 'member-2',
      type: 'assignee',
      to: 'member-1',
    })
    await dexie.activities.log({
      issueId: issue.id,
      actorId: 'member-2',
      type: 'assignee',
      to: 'member-1',
    })
    issue.assigneeId = 'member-1'
    await db.issues.update(issue.id, { assigneeId: 'member-1' })
    await api.activities.log({ issueId: issue.id, actorId: 'member-2', type: 'status', to: 'done' })
    await dexie.activities.log({
      issueId: issue.id,
      actorId: 'member-2',
      type: 'status',
      to: 'done',
    })

    // API 身份固定为 admin（member-1）：只比较 member-1 视角；同毫秒并列按 id 兜底 → 比多重集
    const shape = (rows: Notification[]) =>
      rows
        .map(
          (r) =>
            `${r.memberId}|${r.type}|${r.issueId ?? ''}|${r.actorId ?? ''}|${r.message ?? ''}|${r.readAt === null}`,
        )
        .sort()
    const apiRows = await first(api.notifications.liveFor('member-1', 50))
    const dexieRows = await first(dexie.notifications.liveFor('member-1', 50))
    expect(apiRows.every((r) => r.memberId === 'member-1')).toBe(true)
    expect(apiRows).toHaveLength(4)
    expect(shape(apiRows)).toEqual(shape(dexieRows))
    expect(shape(dexieRows)).toEqual([
      'member-1|assigned|' + issue.id + '|member-2||true',
      'member-1|comment|' + issue.id + '|member-2|进度如何|true',
      'member-1|mention|' + issue.id + '|member-2|@张伟 请确认|true',
      'member-1|status|' + issue.id + '|member-2|done|true',
    ])

    expect(await first(api.notifications.unreadCount('member-1'))).toBe(4)
    expect(await first(dexie.notifications.unreadCount('member-1'))).toBe(4)

    await api.notifications.markRead(apiRows[0].id)
    await dexie.notifications.markRead(dexieRows.find((r) => r.type === apiRows[0].type)!.id)
    expect(await first(api.notifications.unreadCount('member-1'))).toBe(3)
    expect(await first(dexie.notifications.unreadCount('member-1'))).toBe(3)

    await api.notifications.markAllRead('member-1')
    await dexie.notifications.markAllRead('member-1')
    expect(await first(api.notifications.unreadCount('member-1'))).toBe(0)
    expect(await first(dexie.notifications.unreadCount('member-1'))).toBe(0)
  })

  it('软删除 / 恢复 / 永久删除（含回收站列表）双实现一致', async () => {
    const ids = store.issues.slice(10, 13).map((i) => i.id)
    // 两侧同一批行软删：deletedAt 时间戳因实现各自取 now，比较时归一
    for (const id of ids) {
      await dexie.issues.delete(id)
      await api.issues.delete(id)
    }
    // 软删行对外视同不存在
    for (const id of ids) {
      expect(await api.issues.get(id)).toBe(await dexie.issues.get(id))
      expect(await api.issues.get(id)).toBeUndefined()
    }
    const strip = (rows: Issue[]) => rows.map((r) => ({ ...r, deletedAt: r.deletedAt ? 1 : 0 }))
    expect(strip(await first(api.issues.liveTrash()))).toEqual(
      strip(await first(dexie.issues.liveTrash())),
    )
    expect((await first(api.issues.liveTrash())).map((r) => r.id).sort()).toEqual([...ids].sort())
    // 计数/窗口同步排除软删行
    expect(await first(api.issues.liveCounts(projectId))).toEqual(
      await first(dexie.issues.liveCounts(projectId)),
    )
    expect(await first(api.issues.liveCycleCounts(ALL_PROJECTS))).toEqual(
      await first(dexie.issues.liveCycleCounts(ALL_PROJECTS)),
    )

    // 恢复：回到窗口，回收站清空
    for (const id of ids.slice(0, 2)) {
      await dexie.issues.restore(id)
      await api.issues.restore(id)
    }
    expect((await first(api.issues.liveTrash())).map((r) => r.id)).toEqual([ids[2]])
    expect(await api.issues.get(ids[0])).toEqual(await dexie.issues.get(ids[0]))

    // 永久删除：物理删除后不再是软删行
    await dexie.issues.purge(ids[2])
    await api.issues.purge(ids[2])
    expect(await first(api.issues.liveTrash())).toEqual([])
    expect(await api.issues.get(ids[2])).toBe(await dexie.issues.get(ids[2]))
  })

  it('回收站行不出现在搜索/子任务/关联候选/创建趋势/工作量里', async () => {
    const target = store.issues.find((i) => i.projectId === projectId)!
    await dexie.issues.delete(target.id)
    await api.issues.delete(target.id)
    const kw = target.title.replace(/ #\d+$/, '')
    for (const f of [filters({ search: kw }), filters({ search: target.key })]) {
      const a = await first(api.issues.liveWindow(f, 'member-1', 100))
      const d = await first(dexie.issues.liveWindow(f, 'member-1', 100))
      expect(a).toEqual(d)
      expect(a.some((r) => r.id === target.id)).toBe(false)
    }
    expect(await first(api.issues.liveRelationCandidates(projectId, 50))).toEqual(
      await first(dexie.issues.liveRelationCandidates(projectId, 50)),
    )
    expect(await first(api.issues.liveByCreatedSince(FIXED - 400 * 86_400_000))).toEqual(
      await first(dexie.issues.liveByCreatedSince(FIXED - 400 * 86_400_000)),
    )
    expect(await first(api.issues.liveAssigneeWorkload(projectId))).toEqual(
      await first(dexie.issues.liveAssigneeWorkload(projectId)),
    )
    expect(await first(api.admin.liveGlobalStats())).toEqual(
      await first(dexie.admin.liveGlobalStats()),
    )
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
    const drop = store.issues.slice(0, 10).map((i) => i.id)
    await api.issues.bulkDelete(drop)
    // 软删除后行仍在库里，但对外列表少 10 条
    expect(await api.issues.listAll(5000)).toHaveLength(store.issues.length - 10)
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
      return handleApi(store, { method, path, query, body, authorization: adminBearer(store) })
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
      authorization: adminBearer(store),
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
      authorization: adminBearer(store),
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
