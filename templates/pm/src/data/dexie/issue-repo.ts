import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import type { Issue, IssuePriority, IssueStatus } from '@/types'
import { ISSUE_STATUSES } from '@/types'
import { fromLiveQuery, type Observable } from '@/data/observable'
import { cycleFilterPredicate, CURRENT_CYCLE, NO_CYCLE } from '@/lib/cycles'
import { ALL_PROJECTS, LIST_WINDOW, UNASSIGNED } from '@/lib/filters'
import { PRIORITY_WEIGHT } from '@/lib/order'
import type {
  CreateIssueInput,
  CycleIssueCount,
  IssueRepository,
  IssueWindowFilters,
  ProjectCounts,
} from '@/data/types'
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

export function createDexieIssueRepository(db: PMDatabase): IssueRepository {
  return {
    get: (id) => db.issues.get(id),

    live(id: string): Observable<Issue | undefined> {
      return fromLiveQuery(() => db.issues.get(id))
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
      await db.issues.update(id, { ...changes, updatedAt: Date.now() })
    },

    async delete(id) {
      await db.issues.delete(id)
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
        let out: Issue[]
        if (search) {
          const kw = search.toLowerCase()
          out = await db.issues
            .filter((i) => i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw))
            .limit(2000)
            .toArray()
        } else if (directCycle) {
          // 迭代直取：整周期范围内筛状态（不分片、不按 updatedAt 截断）
          const want = new Set(statuses)
          out = (await cycleOwnedRows(db, pid, directCycle)).sort(byUpdatedDesc)
          if (want.size) out = out.filter((i) => want.has(i.status))
        } else if (statuses.length === 0) {
          const source = allProjects
            ? db.issues.orderBy('updatedAt')
            : db.issues
                .where('[projectId+updatedAt]')
                .between([pid, Dexie.minKey], [pid, Dexie.maxKey])
          out = await source.reverse().limit(limit).toArray()
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
                    .limit(limit)
                    .toArray()
                : db.issues
                    .where('[projectId+status+updatedAt]')
                    .between([pid, s, Dexie.minKey], [pid, s, Dexie.maxKey])
                    .reverse()
                    .limit(limit)
                    .toArray(),
            ),
          )
          const merged = new Map<string, Issue>()
          for (const i of chunks.flat()) merged.set(i.id, i)
          out = [...merged.values()].sort(byUpdatedDesc).slice(0, limit)
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
        return {
          total,
          byStatus: Object.fromEntries(ISSUE_STATUSES.map((s, i) => [s, byStatus[i]])) as Record<
            IssueStatus,
            number
          >,
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
            total: total - sum.total,
            done: done - sum.done,
            cancelled: cancelled - sum.cancelled,
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
      return fromLiveQuery(async () => (await cycleOwnedRows(db, projectId, cycleId)).sort(byIdAsc))
    },

    liveSubIssues(parentId: string): Observable<Issue[]> {
      return fromLiveQuery(() => db.issues.where('parentId').equals(parentId).toArray())
    },

    liveRelationCandidates(projectId: string, limit: number): Observable<Issue[]> {
      return fromLiveQuery(() =>
        db.issues.where('projectId').equals(projectId).limit(limit).toArray(),
      )
    },

    liveByCreatedSince(sinceMs: number): Observable<Issue[]> {
      return fromLiveQuery(() =>
        db.issues.where('createdAt').between(sinceMs, Date.now()).toArray(),
      )
    },

    listAll(limit: number): Promise<Issue[]> {
      return db.issues.limit(limit).toArray()
    },

    liveAssigneeWorkload(projectId: string) {
      return fromLiveQuery(async () => {
        const rows =
          projectId === ALL_PROJECTS
            ? await db.issues.toArray()
            : await db.issues.where('projectId').equals(projectId).toArray()
        const map = new Map<string, number>()
        for (const i of rows) {
          if (!i.assigneeId) continue
          map.set(i.assigneeId, (map.get(i.assigneeId) ?? 0) + 1)
        }
        return [...map.entries()].map(([memberId, count]) => ({ memberId, count }))
      })
    },

    bulkGet(ids: string[]): Promise<Array<Issue | undefined>> {
      return db.issues.bulkGet(ids)
    },

    async updateMany(updates: Array<{ id: string; changes: Partial<Issue> }>): Promise<void> {
      await db.transaction('rw', db.issues, async () => {
        const now = Date.now()
        for (const u of updates) {
          await db.issues.update(u.id, { ...u.changes, updatedAt: now })
        }
      })
    },

    async bulkApply(
      ids: string[],
      patch: { status?: IssueStatus; priority?: IssuePriority; assigneeId?: string | null },
      actorId: string,
    ): Promise<void> {
      await db.transaction('rw', db.issues, db.activities, async () => {
        const now = Date.now()
        for (const id of ids) {
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
          const changes: Partial<Issue> = { updatedAt: now }
          if (patch.status) changes.status = patch.status
          if (patch.priority) changes.priority = patch.priority
          if (patch.assigneeId !== undefined) changes.assigneeId = patch.assigneeId
          await db.issues.update(id, changes)
        }
      })
    },

    async bulkDelete(ids: string[]): Promise<void> {
      await db.transaction('rw', db.issues, async () => {
        for (const id of ids) await db.issues.delete(id)
      })
    },
  }
}
