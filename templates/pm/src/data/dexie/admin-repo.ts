import type { Table } from 'dexie'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { AdminRepository, GlobalStats, MemberWorkload, ProjectHealth } from '@/data/types'

const STALE_MS = 14 * 86400000

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
        const [members, issues] = await Promise.all([db.members.toArray(), db.issues.toArray()])
        return members.map((m) => {
          const mine = issues.filter((i) => i.assigneeId === m.id)
          return {
            memberId: m.id,
            total: mine.length,
            todo: mine.filter((i) => i.status === 'todo').length,
            inProgress: mine.filter((i) => i.status === 'in_progress').length,
            done: mine.filter((i) => i.status === 'done').length,
          }
        })
      }),
    liveProjectHealth: () =>
      fromLiveQuery(async (): Promise<ProjectHealth[]> => {
        const now = Date.now()
        const [projects, issues] = await Promise.all([db.projects.toArray(), db.issues.toArray()])
        return projects.map((p) => {
          const mine = issues.filter((i) => i.projectId === p.id)
          const open = mine.filter((i) => i.status !== 'done' && i.status !== 'cancelled')
          return {
            projectId: p.id,
            name: p.name,
            total: mine.length,
            overdue: open.filter((i) => i.dueAt !== null && (i.dueAt as number) < now).length,
            unassigned: mine.filter((i) => !i.assigneeId).length,
            stale: open.filter((i) => i.updatedAt < now - STALE_MS).length,
          }
        })
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
