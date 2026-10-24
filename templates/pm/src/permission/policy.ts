import type { Role } from '@/types'

export type Action =
  | 'issue:create'
  | 'issue:edit'
  | 'issue:delete'
  | 'issue:change-status'
  | 'issue:change-assignee'
  | 'comment:create'
  | 'comment:edit'
  | 'comment:delete'
  | 'view:save'
  | 'view:delete'
  | 'bulk:apply'
  | 'bulk:delete'
  | 'project:manage'
  | 'member:manage'

export const ACTIONS: Action[] = [
  'issue:create',
  'issue:edit',
  'issue:delete',
  'issue:change-status',
  'issue:change-assignee',
  'comment:create',
  'comment:edit',
  'comment:delete',
  'view:save',
  'view:delete',
  'bulk:apply',
  'bulk:delete',
  'project:manage',
  'member:manage',
]

export interface Subject {
  id: string
  role: string
}

export interface Ctx {
  issue?: { assigneeId: string | null; reporterId: string }
  comment?: { authorId: string }
}

function isOwnIssue(subject: Subject, issue: Ctx['issue']): boolean {
  if (!issue) return false
  return issue.assigneeId === subject.id || issue.reporterId === subject.id
}

export function can(subject: Subject, action: Action, ctx?: Ctx): boolean {
  if (subject.role === 'admin') return true
  if (subject.role === 'viewer') return false
  if (subject.role !== 'member') return false

  switch (action) {
    case 'issue:create':
    case 'comment:create':
    case 'view:save':
    case 'view:delete':
      return true
    case 'issue:edit':
    case 'issue:change-status':
    case 'issue:change-assignee':
      return isOwnIssue(subject, ctx?.issue)
    case 'comment:edit':
    case 'comment:delete':
      return ctx?.comment?.authorId === subject.id
    default:
      return false
  }
}

/** 角色解析：内置角色沿用 can()（含「仅本人」条件）；自定义角色按权限集合无条件授权 */
export function roleCan(
  role: Role | undefined,
  memberId: string,
  action: Action,
  ctx?: Ctx,
): boolean {
  if (!role) return false
  if (role.builtin) return can({ id: memberId, role: role.id }, action, ctx)
  return role.permissions.includes(action)
}

/** 内置角色的动作集合（权限矩阵展示用；含条件动作的「本人」语义由 can() 决定） */
export function builtinPermissions(roleId: string): Action[] {
  return ACTIONS.filter((a) => can({ id: 'matrix', role: roleId }, a))
}
