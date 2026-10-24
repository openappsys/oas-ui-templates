import type { Role } from '@/types'
import { builtinPermissions } from '../permission/policy.ts'

export const BUILTIN_ROLE_IDS = ['admin', 'member', 'viewer'] as const
export type BuiltinRoleId = (typeof BUILTIN_ROLE_IDS)[number]

export function isBuiltinRole(id: string): id is BuiltinRoleId {
  return (BUILTIN_ROLE_IDS as readonly string[]).includes(id)
}

/** 内置角色（只读）：权限由 policy 的条件规则决定；这里存的是矩阵展示用的动作集合 */
export const BUILTIN_ROLES: Role[] = BUILTIN_ROLE_IDS.map((id) => ({
  id,
  name: id === 'admin' ? 'Admin' : id === 'member' ? 'Member' : 'Viewer',
  description: '',
  builtin: true,
  permissions: builtinPermissions(id),
}))
