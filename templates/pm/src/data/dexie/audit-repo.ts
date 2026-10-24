import type { PMDatabase } from '@/db/schema'
import type { AuditEntry } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { AuditRepository, ProjectRoleRepository } from '@/data/types'

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
