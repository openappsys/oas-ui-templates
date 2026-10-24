import type { PMDatabase } from '@/db/schema'
import type { Role } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { RoleRepository } from '@/data/types'

/** 内置角色不可改/删；自定义角色被成员占用时不可删（与 UI 守卫双保险） */
export function createDexieRoleRepository(db: PMDatabase): RoleRepository {
  return {
    all: () => db.roles.toArray(),
    liveAll: () => fromLiveQuery(() => db.roles.toArray()),
    create: (role: Role) => db.roles.add(role).then(() => undefined),
    update: (id, changes) =>
      db
        .transaction('rw', db.roles, async () => {
          const role = await db.roles.get(id)
          if (!role) return
          if (role.builtin) throw new Error('builtin role cannot be edited')
          await db.roles.update(id, changes)
        })
        .then(() => undefined),
    delete: (id) =>
      db.transaction('rw', db.roles, db.members, async () => {
        const role = await db.roles.get(id)
        if (!role) return
        if (role.builtin) throw new Error('builtin role cannot be deleted')
        const inUse = await db.members.where('role').equals(id).count()
        if (inUse > 0) throw new Error('role is assigned to members')
        await db.roles.delete(id)
      }),
  }
}
