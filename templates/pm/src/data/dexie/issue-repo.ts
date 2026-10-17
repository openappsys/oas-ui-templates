import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import type { Issue, IssuePriority, IssueStatus } from '@/types'
import { ISSUE_STATUSES } from '@/types'
import { fromLiveQuery, type Observable } from '@/data/observable'
import type {
  CreateIssueInput,
  IssueRepository,
  IssueWindowFilters,
  ProjectCounts,
} from '@/data/types'
import { allocateProjectKey } from './project-repo'

const LIST_WINDOW = 500
const PRIORITY_WEIGHT: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

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

    liveWindow(filters: IssueWindowFilters, currentUser: string): Observable<Issue[]> {
      return fromLiveQuery(async () => {
        const items = filters.statusFilter
          ? await db.issues
              .where('[projectId+status+updatedAt]')
              .between(
                [filters.projectId, filters.statusFilter, Dexie.minKey],
                [filters.projectId, filters.statusFilter, Dexie.maxKey],
              )
              .reverse()
              .limit(LIST_WINDOW)
              .toArray()
          : await db.issues
              .where('[projectId+updatedAt]')
              .between([filters.projectId, Dexie.minKey], [filters.projectId, Dexie.maxKey])
              .reverse()
              .limit(LIST_WINDOW)
              .toArray()
        let out = items
        if (filters.search.trim()) {
          const kw = filters.search.trim().toLowerCase()
          out = await db.issues
            .filter((i) => i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw))
            .limit(2000)
            .toArray()
        }
        if (filters.assigneeFilter) out = out.filter((i) => i.assigneeId === filters.assigneeFilter)
        if (filters.myOnly) out = out.filter((i) => i.assigneeId === currentUser)
        if (filters.priorityFilter) out = out.filter((i) => i.priority === filters.priorityFilter)
        if (filters.sortBy === 'priority') {
          out = [...out].sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
        } else if (filters.sortBy === 'createdAt') {
          out = [...out].sort((a, b) => b.createdAt - a.createdAt)
        }
        return out
      })
    },

    liveCounts(projectId: string): Observable<ProjectCounts> {
      return fromLiveQuery(async () => {
        const [total, ...byStatus] = await Promise.all([
          db.issues.where('projectId').equals(projectId).count(),
          ...ISSUE_STATUSES.map((s: IssueStatus) =>
            db.issues.where('[projectId+status]').equals([projectId, s]).count(),
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
        const rows = await db.issues.where('projectId').equals(projectId).toArray()
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
