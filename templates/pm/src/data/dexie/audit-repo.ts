import type { PMDatabase } from '@/db/schema'
import type { AuditEntry } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { AuditRepository, ProjectMemberRepository, ProjectRoleRepository } from '@/data/types'

export function createDexieAuditRepository(db: PMDatabase): AuditRepository {
  return {
    liveRecent: (limit) =>
      fromLiveQuery(() => db.audit.orderBy('at').reverse().limit(limit).toArray()),
    add: (entry: AuditEntry) => db.audit.add(entry).then(() => undefined),
  }
}

export function createDexieProjectRoleRepository(db: PMDatabase): ProjectRoleRepository {
  return {
    liveAll: () => fromLiveQuery(() => db.projectRoles.toArray()),
    set: (projectId, memberId, roleId) =>
      db
        .transaction(
          'rw',
          db.projectRoles,
          db.projects,
          db.members,
          db.roles,
          db.projectMembers,
          async () => {
            const id = `${projectId}:${memberId}`
            if (roleId === null) {
              await db.projectRoles.delete(id)
              return
            }
            if (!(await db.projects.get(projectId))) throw new Error('project not found')
            if (!(await db.members.get(memberId))) throw new Error('member not found')
            const role = await db.roles.get(roleId)
            if (!role) throw new Error('unknown role')
            if (role.scope !== 'project') throw new Error('project role required')
            const membership = await db.projectMembers.get(id)
            if (!membership) throw new Error('member is not in project')
            await db.projectRoles.put({ id, projectId, memberId, roleId })
          },
        )
        .then(() => undefined),
  }
}

export function createDexieProjectMemberRepository(db: PMDatabase): ProjectMemberRepository {
  return {
    liveAll: () => fromLiveQuery(() => db.projectMembers.toArray()),
    setMembers: (projectId, memberIds) =>
      db
        .transaction('rw', db.projectMembers, db.projectRoles, async () => {
          const unique = [...new Set(memberIds)]
          const keep = new Set(unique)
          const overrides = await db.projectRoles.where('projectId').equals(projectId).toArray()
          const stale = overrides.filter((a) => !keep.has(a.memberId))
          if (stale.length > 0) {
            await db.projectRoles.bulkDelete(stale.map((a) => a.id))
          }
          await db.projectMembers.where('projectId').equals(projectId).delete()
          if (unique.length > 0) {
            await db.projectMembers.bulkPut(
              unique.map((memberId) => ({
                id: `${projectId}:${memberId}`,
                projectId,
                memberId,
              })),
            )
          }
        })
        .then(() => undefined),
  }
}
