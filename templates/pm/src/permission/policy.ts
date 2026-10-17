import type { MemberRole } from '@/types'

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
  role: MemberRole
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
