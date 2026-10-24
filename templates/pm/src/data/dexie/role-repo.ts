import type { PMDatabase } from '@/db/schema'
import type { Role } from '@/types'
import { fromLiveQuery } from '@/data/observable'
import type { RoleRepository } from '@/data/types'
import { isWorkspaceAction, type Action } from '@/permission/policy'

/** 项目角色不得携带工作区级权限，否则项目覆盖可提权 */
function sanitize(scope: Role['scope'], permissions: Action[]): Action[] {
  return scope === 'project' ? permissions.filter((a) => !isWorkspaceAction(a)) : permissions
}

/** 内置角色不可改/删；自定义角色被成员占用时不可删（与 UI 守卫双保险） */
export function createDexieRoleRepository(db: PMDatabase): RoleRepository {
  return {
    all: () => db.roles.toArray(),
    liveAll: () => fromLiveQuery(() => db.roles.toArray()),
    create: (role: Role) =>
      db.roles
        .add({ ...role, permissions: sanitize(role.scope, role.permissions as Action[]) })
        .then(() => undefined),
    update: (id, changes) =>
      db
        .transaction('rw', db.roles, async () => {
          const role = await db.roles.get(id)
          if (!role) return
          if (role.builtin) throw new Error('builtin role cannot be edited')
          // 作用域创建后不可变：变更会让已分配成员/项目覆盖落到错误层级
          const safe: Partial<Role> = { ...changes, builtin: false }
          delete safe.scope
          if (safe.permissions) {
            safe.permissions = sanitize(
              role.scope === 'project' ? 'project' : 'workspace',
              safe.permissions as Action[],
            )
          }
          await db.roles.update(id, safe)
        })
        .then(() => undefined),
    delete: (id) =>
      db.transaction('rw', db.roles, db.members, db.projectRoles, async () => {
        const role = await db.roles.get(id)
        if (!role) return
        if (role.builtin) throw new Error('builtin role cannot be deleted')
        const inUse = await db.members.where('role').equals(id).count()
        if (inUse > 0) throw new Error('role is assigned to members')
        const overrides = await db.projectRoles.toArray()
        if (overrides.some((a) => a.roleId === id)) {
          throw new Error('role is used by project overrides')
        }
        await db.roles.delete(id)
      }),
  }
}
