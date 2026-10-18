import type { Table } from 'dexie'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { AdminRepository, GlobalStats, MemberWorkload, ProjectHealth } from '@/data/types'
import type { IssueStatus } from '@/types'

export function createDexieAdminRepository(db: PMDatabase): AdminRepository {
  const allTables: Table[] = [
    db.issues,
    db.projects,
    db.members,
    db.comments,
    db.savedViews,
    db.activities,
    db.settings,
  ]
  const wipeAll = () =>
    db.transaction('rw', allTables, async () => {
      for (const t of allTables) await t.clear()
    })
  return {
    liveGlobalStats: () =>
      fromLiveQuery(async (): Promise<GlobalStats> => {
        const [projects, members, issues, done] = await Promise.all([
          db.projects.count(),
          db.members.count(),
          db.issues.count(),
          db.issues.where('status').equals('done').count(),
        ])
        return { projects, members, issues, done }
      }),
    liveMemberWorkload: () =>
      fromLiveQuery(async (): Promise<MemberWorkload[]> => {
        const members = await db.members.toArray()
        return Promise.all(
          members.map(async (m) => {
            const count = (status: IssueStatus | null) =>
              status === null
                ? db.issues.where('assigneeId').equals(m.id).count()
                : db.issues.where('[assigneeId+status]').equals([m.id, status]).count()
            const [total, todo, inProgress, done] = await Promise.all([
              count(null),
              count('todo'),
              count('in_progress'),
              count('done'),
            ])
            return { memberId: m.id, total, todo, inProgress, done }
          }),
        )
      }),
    liveProjectHealth: () =>
      fromLiveQuery(async (): Promise<ProjectHealth[]> => {
        const projects = await db.projects.toArray()
        const now = Date.now()
        const day = 86400000
        return Promise.all(
          projects.map(async (p) => {
            const rows = await db.issues.where('projectId').equals(p.id).toArray()
            const open = rows.filter((i) => i.status !== 'done' && i.status !== 'cancelled')
            return {
              projectId: p.id,
              name: p.name,
              total: rows.length,
              overdue: open.filter((i) => i.dueAt !== null && i.dueAt < now).length,
              unassigned: open.filter((i) => !i.assigneeId).length,
              stale: open.filter((i) => i.updatedAt < now - 14 * day).length,
            }
          }),
        )
      }),
    exportAll: async () => {
      const [issues, projects, members, comments, savedViews, activities, settings] =
        await Promise.all([
          db.issues.toArray(),
          db.projects.toArray(),
          db.members.toArray(),
          db.comments.toArray(),
          db.savedViews.toArray(),
          db.activities.toArray(),
          db.settings.toArray(),
        ])
      return JSON.stringify({
        app: 'oas-pm',
        version: 6,
        exportedAt: Date.now(),
        tables: { issues, projects, members, comments, savedViews, activities, settings },
      })
    },
    importAll: async (json: string) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch (e) {
        throw new Error(`invalid backup JSON: ${e instanceof Error ? e.message : String(e)}`)
      }
      const record = parsed as { app?: unknown; tables?: Record<string, unknown> }
      if (record.app !== 'oas-pm' || typeof record.tables !== 'object' || record.tables === null) {
        throw new Error('unrecognized backup format')
      }
      const backup = record.tables
      const rows = (k: string): unknown[] => (Array.isArray(backup[k]) ? backup[k] : [])
      const restore: Array<[Table, unknown[]]> = [
        [db.issues, rows('issues')],
        [db.projects, rows('projects')],
        [db.members, rows('members')],
        [db.comments, rows('comments')],
        [db.savedViews, rows('savedViews')],
        [db.activities, rows('activities')],
        [db.settings, rows('settings')],
      ]
      await db.transaction('rw', allTables, async () => {
        for (const t of allTables) await t.clear()
        for (const [t, data] of restore) await t.bulkPut(data)
      })
    },
    resetDemo: async () => {
      await wipeAll()
      const { seedDatabase } = await import('@/seed-db')
      await seedDatabase()
    },
    wipeAll,
  }
}
