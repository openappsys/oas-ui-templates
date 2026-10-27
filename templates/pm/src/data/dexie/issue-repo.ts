import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import type { Issue, IssuePriority, IssueStatus } from '@/types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/types'
import { fromLiveQuery, type Observable } from '@/data/observable'
import { cycleFilterPredicate, CURRENT_CYCLE, NO_CYCLE } from '@/lib/cycles'
import { ALL_PROJECTS, LIST_WINDOW, UNASSIGNED } from '@/lib/filters'
import { issueChangeNotificationDrafts } from '@/lib/notify'
import { PRIORITY_WEIGHT } from '@/lib/order'
import type {
  CreateIssueInput,
  CreatedDayCount,
  CycleIssueCount,
  IssueRepository,
  IssueWindowFilters,
  ProjectCounts,
} from '@/data/types'
import { insertNotificationDrafts } from './notify-write'
import { allocateProjectKey } from './project-repo'

/** updatedAt 倒序，并列时按 id 倒序——与 API 实现（mock-server 的 byUpdatedDesc）同一条并列规则，
 *  否则多状态归并后并列键的先后会在两种数据源间漂移 */
function byUpdatedDesc(a: Issue, b: Issue): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

function byIdAsc(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function byIdDesc(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/** 迭代直取：[projectId+cycleId]（跨项目作用域走单列 cycleId）。
 *  已结束周期的工作项 updatedAt 可能很旧，走 updatedAt 窗口会被整段截断——直取索引才是
 *  「点已结束迭代空列表」的修法；窗口语义只保留给「当前迭代 / 未入迭代 / 不限」 */
function cycleOwnedRows(db: PMDatabase, projectId: string, cycleId: string): Promise<Issue[]> {
  if (projectId === ALL_PROJECTS) return db.issues.where('cycleId').equals(cycleId).toArray()
  return db.issues.where('[projectId+cycleId]').equals([projectId, cycleId]).toArray()
}

/** 具体周期 id（区别于 '__current__' / '__none__' 两个哨兵） */
function concreteCycle(cycleFilter: string | null): string | null {
  if (!cycleFilter || cycleFilter === CURRENT_CYCLE || cycleFilter === NO_CYCLE) return null
  return cycleFilter
}

/** 软删除唯一谓词：deletedAt 缺失或 null 即在库可见。历史行无该字段，一律按「未删除」处理。
 *  Dexie 与 mock-server 共用这套语义，漏用即两数据源分叉 */
export function notDeleted(row: Pick<Issue, 'deletedAt'>): boolean {
  return row.deletedAt == null
}

/** 已删除 id 集合。走 deletedAt 索引：IndexedDB 不索引 null/undefined，索引里只剩软删行，
 *  10W 行库里也只读回收站这一小撮——不用为全局排除去扫全表 */
async function deletedIds(db: PMDatabase): Promise<Set<string>> {
  const rows = await db.issues.where('deletedAt').above(0).toArray()
  return new Set(rows.map((i) => i.id))
}

/** 剔除已删除行（deleted 为空集合时原样返回，省一次拷贝） */
function alive(rows: Issue[], deleted: Set<string>): Issue[] {
  return deleted.size === 0 ? rows : rows.filter((r) => !deleted.has(r.id))
}

export function createDexieIssueRepository(db: PMDatabase): IssueRepository {
  return {
    // 已删除行对外视同不存在（详情/通知目标校验走这里），回收站另有 liveTrash
    get: async (id) => {
      const row = await db.issues.get(id)
      return row && notDeleted(row) ? row : undefined
    },

    live(id: string): Observable<Issue | undefined> {
      return fromLiveQuery(async () => {
        const row = await db.issues.get(id)
        return row && notDeleted(row) ? row : undefined
      })
    },

    async create(input: CreateIssueInput): Promise<Issue> {
      const { keyNum, projectKey } = await allocateProjectKey(db, input.projectId)
      const issue: Issue = {
        id: nanoid(),
        projectId: input.projectId,
        key: `${projectKey}-${keyNum}`,
        title: input.title,
        description: '',
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        reporterId: input.reporterId,
        parentId: input.parentId ?? null,
        labels: [],
        startAt: null,
        dueAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: input.order ?? Date.now(),
        cycleId: null,
      }
      await db.issues.add(issue)
      return issue
    },

    async update(id, changes) {
      const row = await db.issues.get(id)
      if (!row || !notDeleted(row)) return
      await db.issues.update(id, { ...changes, updatedAt: Date.now() })
    },

    /** 软删除：只写 deletedAt，行留在库里供回收站恢复。updatedAt 不动——
     *  恢复后回到原来的排序位置，不会因删除动作跳到列表头部 */
    async delete(id) {
      const row = await db.issues.get(id)
      if (!row || !notDeleted(row)) return
      await db.issues.update(id, { deletedAt: Date.now() })
    },

    async restore(id) {
      await db.issues.update(id, { deletedAt: null })
    },

    /** 永久删除：仅回收站内可用（物理删除，不可恢复）；级联清评论/活动/通知并解除子任务挂载 */
    async purge(id) {
      await db.transaction(
        'rw',
        db.issues,
        db.comments,
        db.activities,
        db.notifications,
        async () => {
          const row = await db.issues.get(id)
          if (!row || notDeleted(row)) return
          await db.issues.delete(id)
          await db.comments.where('issueId').equals(id).delete()
          await db.activities.where('issueId').equals(id).delete()
          const notifs = await db.notifications.toArray()
          const stale = notifs.filter((n) => n.issueId === id).map((n) => n.id)
          if (stale.length > 0) await db.notifications.bulkDelete(stale)
          await db.issues.where('parentId').equals(id).modify({ parentId: null })
          // 清理其他 Issue 的 relations 指向（无索引，purge 低频可接受全表过滤）
          const referring = await db.issues
            .filter((i) => (i.relations ?? []).some((r) => r.targetId === id))
            .toArray()
          for (const r of referring) {
            await db.issues.update(r.id, {
              relations: (r.relations ?? []).filter((x) => x.targetId !== id),
            })
          }
        },
      )
    },

    liveTrash(): Observable<Issue[]> {
      return fromLiveQuery(async () => {
        const rows = await db.issues.where('deletedAt').above(0).toArray()
        // 删除时间倒序；同刻（同一毫秒内连续删）按 id 倒序——与 mock-server 的 byDeletedDesc 同序
        return rows.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0) || byIdDesc(a, b))
      })
    },

    liveWindow(
      filters: IssueWindowFilters,
      currentUser: string,
      limit: number = LIST_WINDOW,
    ): Observable<Issue[]> {
      return fromLiveQuery(async () => {
        const pid = filters.projectId
        // 全部项目作用域：跨项目窗口。无状态筛选走全局 updatedAt 索引；
        // 有状态筛选走 [status+updatedAt]，逐状态各取 limit 条再归并（同项目内语义）
        const allProjects = pid === ALL_PROJECTS
        const statuses = filters.statusFilter
        const search = filters.search.trim()
        const directCycle = concreteCycle(filters.cycleFilter)
        const deleted = await deletedIds(db)
        // 已删除行不占窗口名额：多取 deleted.size 条再剔回 limit
        const pad = limit + deleted.size
        let out: Issue[]
        if (search) {
          const kw = search.toLowerCase()
          out = await db.issues
            .filter(
              (i) =>
                notDeleted(i) &&
                (i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw)),
            )
            .limit(2000)
            .toArray()
        } else if (directCycle) {
          // 迭代直取：整周期范围内筛状态（不分片、不按 updatedAt 截断）
          const want = new Set(statuses)
          out = alive(await cycleOwnedRows(db, pid, directCycle), deleted).sort(byUpdatedDesc)
          if (want.size) out = out.filter((i) => want.has(i.status))
        } else if (statuses.length === 0) {
          const source = allProjects
            ? db.issues.orderBy('updatedAt')
            : db.issues
                .where('[projectId+updatedAt]')
                .between([pid, Dexie.minKey], [pid, Dexie.maxKey])
          out = alive(await source.reverse().limit(pad).toArray(), deleted).slice(0, limit)
        } else {
          // 复合索引单次只能表达一个状态：逐状态各取最近 limit 条再归并。
          // 并集按 updatedAt 的前 limit 条必然落在这 n 份分片内（每片已按该索引倒序）。
          const chunks = await Promise.all(
            statuses.map((s) =>
              allProjects
                ? db.issues
                    .where('[status+updatedAt]')
                    .between([s, Dexie.minKey], [s, Dexie.maxKey])
                    .reverse()
                    .limit(pad)
                    .toArray()
                : db.issues
                    .where('[projectId+status+updatedAt]')
                    .between([pid, s, Dexie.minKey], [pid, s, Dexie.maxKey])
                    .reverse()
                    .limit(pad)
                    .toArray(),
            ),
          )
          const merged = new Map<string, Issue>()
          for (const i of chunks.flat()) merged.set(i.id, i)
          out = alive([...merged.values()].sort(byUpdatedDesc), deleted).slice(0, limit)
        }
        if (filters.assigneeFilter.length) {
          const want = new Set(filters.assigneeFilter)
          out = out.filter((i) => want.has(i.assigneeId ?? UNASSIGNED))
        }
        if (filters.myOnly) out = out.filter((i) => i.assigneeId === currentUser)
        if (filters.priorityFilter.length) {
          const want = new Set(filters.priorityFilter)
          out = out.filter((i) => want.has(i.priority))
        }
        if (filters.labelFilter?.length) {
          const want = new Set(filters.labelFilter)
          out = out.filter((i) => (i.labels ?? []).some((l) => want.has(l)))
        }
        if (filters.cycleFilter) {
          // 当前迭代需要周期区间——同一次查询里读 cycles 表，liveQuery 会跟踪该读取，
          // 周期起止被改后窗口自动重算。具体周期 id 已在上面直取，这里再过滤等于空操作
          const cycles =
            filters.cycleFilter === CURRENT_CYCLE
              ? allProjects
                ? await db.cycles.toArray()
                : await db.cycles.where('projectId').equals(pid).toArray()
              : []
          out = out.filter(cycleFilterPredicate(filters.cycleFilter, cycles, Date.now()))
        }
        if (filters.sortBy === 'priority') {
          out = [...out].sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
        } else if (filters.sortBy === 'createdAt') {
          out = [...out].sort((a, b) => b.createdAt - a.createdAt)
        }
        // 直取路径在「筛选 + 排序」后分页（列表滚动续载即放大 limit）；
        // 搜索分支沿用 2000 上限不分页，窗口分支已在取数时截断
        if (directCycle && !search) out = out.slice(0, limit)
        return out
      })
    },

    liveCounts(projectId: string): Observable<ProjectCounts> {
      return fromLiveQuery(async () => {
        // 全部项目：全局计数（单列 status 索引）；否则项目内计数（复合索引）
        const allProjects = projectId === ALL_PROJECTS
        const [total, ...byStatus] = await Promise.all([
          allProjects ? db.issues.count() : db.issues.where('projectId').equals(projectId).count(),
          ...ISSUE_STATUSES.map((s: IssueStatus) =>
            allProjects
              ? db.issues.where('status').equals(s).count()
              : db.issues.where('[projectId+status]').equals([projectId, s]).count(),
          ),
        ])
        // 优先级计数同口径（[projectId+priority] / priority 索引），一处查询里并行取
        const byPriorityRows = await Promise.all(
          ISSUE_PRIORITIES.map((p: IssuePriority) =>
            allProjects
              ? db.issues.where('priority').equals(p).count()
              : db.issues.where('[projectId+priority]').equals([projectId, p]).count(),
          ),
        )
        // 索引计数含软删行：从 deletedAt 索引取回软删行（只有这一小撮）再逐状态扣减，
        // 比逐状态 filter 全表便宜两个数量级（10W 行）
        const deleted = (await db.issues.where('deletedAt').above(0).toArray()).filter(
          (i) => allProjects || i.projectId === projectId,
        )
        const deletedByStatus = new Map<IssueStatus, number>()
        const deletedByPriority = new Map<IssuePriority, number>()
        for (const i of deleted) {
          deletedByStatus.set(i.status, (deletedByStatus.get(i.status) ?? 0) + 1)
          deletedByPriority.set(i.priority, (deletedByPriority.get(i.priority) ?? 0) + 1)
        }
        return {
          total: total - deleted.length,
          byStatus: Object.fromEntries(
            ISSUE_STATUSES.map((s, i) => [s, byStatus[i] - (deletedByStatus.get(s) ?? 0)]),
          ) as Record<IssueStatus, number>,
          byPriority: Object.fromEntries(
            ISSUE_PRIORITIES.map((p, i) => [
              p,
              byPriorityRows[i] - (deletedByPriority.get(p) ?? 0),
            ]),
          ) as Record<IssuePriority, number>,
        }
      })
    },

    /** 按周期聚合计数：每周期一次 [projectId+cycleId] 索引范围游标（不扫全项目）；
     *  未入迭代桶 = 项目总量 − 各周期之和（总量走既有索引计数）。
     *  与 API 实现同口径：total = 0 的周期不出现在结果里 */
    liveCycleCounts(projectId: string): Observable<CycleIssueCount[]> {
      return fromLiveQuery(async () => {
        const allProjects = projectId === ALL_PROJECTS
        // 读 cycles 表：周期增删时 liveQuery 自动重算
        const cycles = allProjects
          ? await db.cycles.toArray()
          : await db.cycles.where('projectId').equals(projectId).toArray()
        const perCycle = await Promise.all(
          cycles.map(async (cycle) => {
            const acc = { total: 0, done: 0, cancelled: 0 }
            await db.issues
              .where('[projectId+cycleId]')
              .equals([cycle.projectId, cycle.id])
              .each((issue) => {
                if (!notDeleted(issue)) return
                acc.total += 1
                if (issue.status === 'done') acc.done += 1
                else if (issue.status === 'cancelled') acc.cancelled += 1
              })
            return { cycleId: cycle.id as string | null, ...acc }
          }),
        )
        const [total, done, cancelled] = await Promise.all([
          allProjects ? db.issues.count() : db.issues.where('projectId').equals(projectId).count(),
          allProjects
            ? db.issues.where('status').equals('done').count()
            : db.issues.where('[projectId+status]').equals([projectId, 'done']).count(),
          allProjects
            ? db.issues.where('status').equals('cancelled').count()
            : db.issues.where('[projectId+status]').equals([projectId, 'cancelled']).count(),
        ])
        // 总量同样扣掉软删行（perCycle 已逐行跳过，两侧口径一致才能正确派生「未入迭代」桶）
        const deleted = (await db.issues.where('deletedAt').above(0).toArray()).filter(
          (i) => allProjects || i.projectId === projectId,
        )
        const aliveTotal = total - deleted.length
        const aliveDone = done - deleted.filter((i) => i.status === 'done').length
        const aliveCancelled = cancelled - deleted.filter((i) => i.status === 'cancelled').length
        const sum = perCycle.reduce(
          (a, r) => ({
            total: a.total + r.total,
            done: a.done + r.done,
            cancelled: a.cancelled + r.cancelled,
          }),
          { total: 0, done: 0, cancelled: 0 },
        )
        const rows: CycleIssueCount[] = [
          {
            cycleId: null,
            total: aliveTotal - sum.total,
            done: aliveDone - sum.done,
            cancelled: aliveCancelled - sum.cancelled,
          },
          ...perCycle,
        ].filter((r) => r.total > 0)
        // null 桶在前（未入迭代不是周期），其余 cycleId 升序——与 API 实现同一排序口径
        return rows.sort((a, b) => {
          const ka = a.cycleId ?? ''
          const kb = b.cycleId ?? ''
          return ka < kb ? -1 : ka > kb ? 1 : 0
        })
      })
    },

    liveCycleIssues(projectId: string, cycleId: string): Observable<Issue[]> {
      return fromLiveQuery(async () => {
        const deleted = await deletedIds(db)
        return alive(await cycleOwnedRows(db, projectId, cycleId), deleted).sort(byIdAsc)
      })
    },

    liveSubIssues(parentId: string): Observable<Issue[]> {
      return fromLiveQuery(async () =>
        (await db.issues.where('parentId').equals(parentId).toArray()).filter(notDeleted),
      )
    },

    liveRelationCandidates(projectId: string, limit: number): Observable<Issue[]> {
      return fromLiveQuery(async () => {
        const deleted = await deletedIds(db)
        const rows = await db.issues
          .where('projectId')
          .equals(projectId)
          .limit(limit + deleted.size)
          .toArray()
        return alive(rows, deleted).slice(0, limit)
      })
    },

    /** 创建趋势：createdAt 索引 .keys() 只读索引键（不物化完整行——10 万行场景从「行深克隆+GC」
     *  降为「数字数组」），按天分桶；软删行是小集合，单独读取后按 createdAt 逐日扣除
     *  （索引键序列无法按 id 过滤）。day 键与视图坐标轴同源：UTC 'MM-DD' */
    liveCreatedDailyCounts(sinceMs: number): Observable<CreatedDayCount[]> {
      return fromLiveQuery(async () => {
        const [keys, deletedRows] = await Promise.all([
          db.issues.where('createdAt').between(sinceMs, Date.now(), true, true).keys(),
          db.issues.where('deletedAt').above(0).toArray(),
        ])
        const dayOf = (ms: number) => new Date(ms).toISOString().slice(5, 10)
        const counts = new Map<string, number>()
        for (const k of keys) {
          const day = dayOf(k as number)
          counts.set(day, (counts.get(day) ?? 0) + 1)
        }
        for (const row of deletedRows) {
          if (row.createdAt < sinceMs) continue
          const day = dayOf(row.createdAt)
          if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) - 1)
        }
        return [...counts.entries()]
          .filter(([, count]) => count > 0)
          .map(([day, count]) => ({ day, count }))
          .sort((a, b) => (a.day < b.day ? -1 : 1))
      })
    },

    async listAll(limit: number): Promise<Issue[]> {
      const deleted = await deletedIds(db)
      const rows = await db.issues.limit(limit + deleted.size).toArray()
      return alive(rows, deleted).slice(0, limit)
    },

    liveAssigneeWorkload(projectId: string) {
      return fromLiveQuery(async () => {
        // 注意：这里不能用 each() 游标——真实 IndexedDB 下 liveQuery + 表遍历有回归
        // （侧栏成员计数为空，fake-indexeddb 单测无法复现，见 sidebar S3）。
        // toArray 一次性物化后聚合是已验证正确的行为；内存峰值可接受（仅管理员页订阅）。
        const rows =
          projectId === ALL_PROJECTS
            ? await db.issues.toArray()
            : await db.issues.where('projectId').equals(projectId).toArray()
        const map = new Map<string, number>()
        for (const i of rows) {
          if (!notDeleted(i)) continue
          if (!i.assigneeId) continue
          map.set(i.assigneeId, (map.get(i.assigneeId) ?? 0) + 1)
        }
        return [...map.entries()].map(([memberId, count]) => ({ memberId, count }))
      })
    },

    /** 子任务进度：parentId 索引只遍历有父的行（小子集），聚合出每个父的 done/total */
    liveSubProgress(projectId: string) {
      return fromLiveQuery(async () => {
        // parentId 索引不含 null 行：天然只遍历子任务（小子集），物化无压力
        const rows = await db.issues.where('parentId').above('').toArray()
        const map = new Map<string, { done: number; total: number }>()
        for (const i of rows) {
          if (!notDeleted(i) || !i.parentId) continue
          if (projectId !== ALL_PROJECTS && i.projectId !== projectId) continue
          const e = map.get(i.parentId) ?? { done: 0, total: 0 }
          e.total++
          if (i.status === 'done') e.done++
          map.set(i.parentId, e)
        }
        return [...map.entries()].map(([parentId, p]) => ({ parentId, ...p }))
      })
    },

    async bulkGet(ids: string[]): Promise<Array<Issue | undefined>> {
      const rows = await db.issues.bulkGet(ids)
      // 软删行视同不存在（通知面板据此显示「Issue 已删除」占位）
      return rows.map((row) => (row && notDeleted(row) ? row : undefined))
    },

    async updateMany(updates: Array<{ id: string; changes: Partial<Issue> }>): Promise<void> {
      await db.transaction('rw', db.issues, async () => {
        const now = Date.now()
        for (const u of updates) {
          const row = await db.issues.get(u.id)
          if (!row || !notDeleted(row)) continue
          await db.issues.update(u.id, { ...u.changes, updatedAt: now })
        }
      })
    },

    async bulkApply(
      ids: string[],
      patch: { status?: IssueStatus; priority?: IssuePriority; assigneeId?: string | null },
      actorId: string,
    ): Promise<void> {
      await db.transaction('rw', db.issues, db.activities, db.notifications, async () => {
        const now = Date.now()
        for (const id of ids) {
          // 通知规则需要变更前的负责人/状态（活动先写、字段后写，与单条编辑路径同序）
          const prior = await db.issues.get(id)
          // 已删除行不参与批量改写：删除后残留的选中集不该把行「写活」
          if (!prior || !notDeleted(prior)) continue
          const acts: Array<Promise<unknown>> = []
          if (patch.status) {
            acts.push(
              db.activities.add({
                id: nanoid(),
                issueId: id,
                actorId,
                type: 'status',
                field: 'status',
                to: patch.status,
                createdAt: now,
              }),
            )
          }
          if (patch.priority) {
            acts.push(
              db.activities.add({
                id: nanoid(),
                issueId: id,
                actorId,
                type: 'priority',
                field: 'priority',
                to: patch.priority,
                createdAt: now,
              }),
            )
          }
          if (patch.assigneeId !== undefined) {
            acts.push(
              db.activities.add({
                id: nanoid(),
                issueId: id,
                actorId,
                type: 'assignee',
                field: 'assigneeId',
                to: patch.assigneeId ?? '',
                createdAt: now,
              }),
            )
          }
          await Promise.all(acts)
          if (prior) {
            // 批量指派/关闭也走同一套规则：自己触发的不通知自己，解除指派不通知
            await insertNotificationDrafts(
              db,
              issueChangeNotificationDrafts({
                issueId: id,
                actorId,
                prevAssigneeId: prior.assigneeId,
                nextAssigneeId: 'assigneeId' in patch ? (patch.assigneeId ?? null) : undefined,
                prevStatus: prior.status,
                nextStatus: patch.status,
              }),
            )
          }
          const changes: Partial<Issue> = { updatedAt: now }
          if (patch.status) {
            changes.status = patch.status
            changes.completedAt = patch.status === 'done' ? now : null
          }
          if (patch.priority) changes.priority = patch.priority
          if (patch.assigneeId !== undefined) changes.assigneeId = patch.assigneeId
          await db.issues.update(id, changes)
        }
      })
    },

    async bulkDelete(ids: string[]): Promise<void> {
      await db.transaction('rw', db.issues, async () => {
        const now = Date.now()
        for (const id of ids) {
          const row = await db.issues.get(id)
          // 批量删除与单条删除同口径：软删除，回收站可恢复
          if (!row || !notDeleted(row)) continue
          await db.issues.update(id, { deletedAt: now })
        }
      })
    },
  }
}
