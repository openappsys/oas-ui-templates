import type { Table } from 'dexie'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { AdminRepository, GlobalStats, MemberWorkload, ProjectHealth } from '@/data/types'
import type { IssueStatus } from '@/types'
import { BUILTIN_ROLES } from '@/lib/builtin-roles'
import { SEED_MARKER_KEY } from '@/seed-db'

export function createDexieAdminRepository(db: PMDatabase): AdminRepository {
  const allTables: Table[] = [
    db.issues,
    db.projects,
    db.members,
    db.comments,
    db.savedViews,
    db.activities,
    db.settings,
    db.cycles,
    db.notifications,
    db.roles,
    db.audit,
    db.projectRoles,
    db.projectMembers,
  ]
  /** 清空业务数据，但保留内置角色与当前管理员——否则清空后无法再进入设置恢复备份 */
  const wipeAll = (keepMemberId?: string) =>
    db.transaction('rw', allTables, async () => {
      const keep = keepMemberId ? await db.members.get(keepMemberId) : undefined
      for (const t of allTables) await t.clear()
      for (const role of BUILTIN_ROLES) await db.roles.put(role)
      if (keep) await db.members.put(keep)
    })
  /** 软删行不参与统计：走 deletedAt 索引直取（只有回收站那一小撮），
   *  再从索引计数里扣减，避免为排除去扫 10W 行 */
  const deletedRows = async () => db.issues.where('deletedAt').above(0).toArray()
  return {
    liveGlobalStats: () =>
      fromLiveQuery(async (): Promise<GlobalStats> => {
        const [projects, members, issues, done, deleted] = await Promise.all([
          db.projects.count(),
          db.members.count(),
          db.issues.count(),
          db.issues.where('status').equals('done').count(),
          deletedRows(),
        ])
        return {
          projects,
          members,
          issues: issues - deleted.length,
          done: done - deleted.filter((i) => i.status === 'done').length,
        }
      }),
    liveMemberWorkload: () =>
      fromLiveQuery(async (): Promise<MemberWorkload[]> => {
        const [members, deleted] = await Promise.all([db.members.toArray(), deletedRows()])
        // 软删行从成员计数里扣除（按 assignee 归组后逐成员减）
        const deletedByMember = new Map<string, Partial<Record<IssueStatus, number>>>()
        for (const row of deleted) {
          if (!row.assigneeId) continue
          const acc = deletedByMember.get(row.assigneeId) ?? {}
          acc[row.status] = (acc[row.status] ?? 0) + 1
          deletedByMember.set(row.assigneeId, acc)
        }
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
            const del = deletedByMember.get(m.id) ?? {}
            const delTotal = Object.values(del).reduce((a, n) => a + (n ?? 0), 0)
            return {
              memberId: m.id,
              total: total - delTotal,
              todo: todo - (del.todo ?? 0),
              inProgress: inProgress - (del.in_progress ?? 0),
              done: done - (del.done ?? 0),
            }
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
            // 软删行不计入健康度（按项目索引取回后本地剔除，行数即项目规模）
            const own = rows.filter((i) => i.deletedAt == null)
            const open = own.filter((i) => i.status !== 'done' && i.status !== 'cancelled')
            return {
              projectId: p.id,
              name: p.name,
              total: own.length,
              overdue: open.filter((i) => i.dueAt !== null && i.dueAt < now).length,
              unassigned: open.filter((i) => !i.assigneeId).length,
              stale: open.filter((i) => i.updatedAt < now - 14 * day).length,
            }
          }),
        )
      }),
    exportAll: async () => {
      const [
        issues,
        projects,
        members,
        comments,
        savedViews,
        activities,
        settings,
        cycles,
        notifications,
        roles,
        audit,
        projectRoles,
        projectMembers,
      ] = await Promise.all([
        db.issues.toArray(),
        db.projects.toArray(),
        db.members.toArray(),
        db.comments.toArray(),
        db.savedViews.toArray(),
        db.activities.toArray(),
        db.settings.toArray(),
        db.cycles.toArray(),
        db.notifications.toArray(),
        db.roles.toArray(),
        db.audit.toArray(),
        db.projectRoles.toArray(),
        db.projectMembers.toArray(),
      ])
      return JSON.stringify({
        app: 'oas-pm',
        version: 10,
        exportedAt: Date.now(),
        tables: {
          issues,
          projects,
          members,
          comments,
          savedViews,
          activities,
          settings,
          cycles,
          notifications,
          roles,
          audit,
          projectRoles,
          projectMembers,
        },
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
        [db.cycles, rows('cycles')],
        [db.notifications, rows('notifications')],
        [db.roles, rows('roles')],
        [db.audit, rows('audit')],
        [db.projectRoles, rows('projectRoles')],
        [db.projectMembers, rows('projectMembers')],
      ]
      await db.transaction('rw', allTables, async () => {
        for (const t of allTables) await t.clear()
        for (const [t, data] of restore) await t.bulkPut(data)
        // v9 备份不含角色：恢复后补内置角色，避免成员角色指向不存在的行
        if ((await db.roles.count()) === 0) {
          for (const role of BUILTIN_ROLES) await db.roles.put(role)
        }
      })
    },
    resetDemo: async () => {
      await wipeAll()
      localStorage.removeItem(SEED_MARKER_KEY)
      const { seedDatabase } = await import('@/seed-db')
      await seedDatabase()
    },
    wipeAll,
  }
}
