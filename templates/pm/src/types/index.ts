// ── 核心实体 ───────────────────────────────────────────────────────────

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled'
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low'
export type MemberRole = 'admin' | 'member' | 'viewer'

export interface Issue {
  id: string
  projectId: string
  key: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  assigneeId: string | null
  reporterId: string
  labels: string[]
  startAt: number | null
  dueAt: number | null
  createdAt: number
  updatedAt: number
  order: number
  /** 子任务父 Issue id（空 = 顶层） */
  parentId?: string | null
  /** 状态流转为 done 的时间（燃尽/完成趋势用） */
  completedAt?: number | null
  /** 关联：blocks / blocked-by / relates */
  relations?: Array<{ type: 'blocks' | 'blocked-by' | 'relates'; targetId: string }>
}

export interface Project {
  id: string
  name: string
  key: string
  description: string
  leadId: string
  createdAt: number
  /** Issue key 严格递增计数器（事务内读改写） */
  nextKeyNum?: number
}

export interface Member {
  id: string
  name: string
  email: string
  avatarColor: string
  role: MemberRole
}

export interface Comment {
  id: string
  issueId: string
  authorId: string
  body: string
  createdAt: number
}

export interface SavedView {
  id: string
  name: string
  /** Filters JSON（不含 search——搜索是即时动作不进视图） */
  filters: string
  createdAt: number
}

export interface Activity {
  id: string
  issueId: string
  actorId: string
  /** create | status | priority | assignee | labels | description | delete | title */
  type: string
  field?: string
  from?: string
  to?: string
  createdAt: number
}

// ── 查询 ──────────────────────────────────────────────────────────────

export interface IssueQuery {
  projectId: string
  status?: IssueStatus
  priority?: IssuePriority
  assigneeId?: string
  search?: string
  sortBy: 'createdAt' | 'priority' | 'dueAt' | 'order'
  sortDir: 'asc' | 'desc'
  offset: number
  limit: number
}

export interface PagedResult<T> {
  items: T[]
  total: number
}

// ── 常量 ──────────────────────────────────────────────────────────────

export const ISSUE_STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
export const ISSUE_PRIORITIES: IssuePriority[] = ['urgent', 'high', 'medium', 'low']

export const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
