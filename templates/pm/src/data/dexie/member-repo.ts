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
    update: (id, changes) => db.members.update(id, changes).then(() => undefined),
    delete: (id) => db.members.delete(id),
  }
}
