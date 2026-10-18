import type { PMDatabase } from '@/db/schema'
import type { Member } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { MemberRepository } from '@/data/types'

export function createDexieMemberRepository(db: PMDatabase): MemberRepository {
  return {
    all: () => db.members.toArray(),
    get: (id) => db.members.get(id),
    liveAll: () => fromLiveQuery(() => db.members.toArray()),
    create: (m: Member) => db.members.add(m).then(() => undefined),
    update: (id, changes) =>
      db
        .transaction('rw', db.members, async () => {
          const current = await db.members.get(id)
          if (
            current &&
            changes.role !== undefined &&
            changes.role !== current.role &&
            current.role === 'admin'
          ) {
            const admins = await db.members.where('role').equals('admin').count()
            if (admins <= 1) throw new Error('cannot demote the last admin')
          }
          await db.members.update(id, changes)
        })
        .then(() => undefined),
    delete: (id) =>
      db.transaction('rw', db.members, db.issues, async () => {
        const target = await db.members.get(id)
        if (!target) return
        if (target.role === 'admin') {
          const admins = await db.members.where('role').equals('admin').count()
          if (admins <= 1) throw new Error('cannot remove the last admin')
        }
        await db.issues.where('assigneeId').equals(id).modify({ assigneeId: null })
        await db.members.delete(id)
      }),
  }
}
