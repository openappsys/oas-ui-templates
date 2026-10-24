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
        .transaction('rw', db.projectRoles, async () => {
          const id = `${projectId}:${memberId}`
          if (roleId === null) {
            await db.projectRoles.delete(id)
            return
          }
          await db.projectRoles.put({ id, projectId, memberId, roleId })
        })
        .then(() => undefined),
  }
}

export function createDexieProjectMemberRepository(db: PMDatabase): ProjectMemberRepository {
  return {
    liveAll: () => fromLiveQuery(() => db.projectMembers.toArray()),
    setMembers: (projectId, memberIds) =>
      db
        .transaction('rw', db.projectMembers, db.projectRoles, async () => {
          const keep = new Set(memberIds)
          const overrides = await db.projectRoles.where('projectId').equals(projectId).toArray()
          const stale = overrides.filter((a) => !keep.has(a.memberId))
          if (stale.length > 0) {
            await db.projectRoles.bulkDelete(stale.map((a) => a.id))
          }
          await db.projectMembers.where('projectId').equals(projectId).delete()
          if (memberIds.length > 0) {
            await db.projectMembers.bulkPut(
              memberIds.map((memberId) => ({
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
