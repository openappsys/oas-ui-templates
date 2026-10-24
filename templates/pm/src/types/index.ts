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
  /** 所属迭代（空 = 未入迭代）。历史数据无此字段，读取处一律按 null 处理 */
  cycleId?: string | null
  /** 软删除时间（null/缺失 = 在库可见）。物理删除只在回收站「永久删除」发生 */
  deletedAt?: number | null
}

/** 迭代（Sprint/Cycle）：状态由 now 与区间派生，不落 status 字段——
 *  now ∈ [startAt, endAt) 为当前，now >= endAt 为已结束（详见 lib/cycles） */
export interface Cycle {
  id: string
  projectId: string
  name: string
  startAt: number
  endAt: number
  goal?: string
  createdAt: number
  updatedAt: number
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
  /** 角色 id：内置 admin/member/viewer，或自定义角色 id */
  role: string
  /** 个人资料补充字段（可选，旧数据缺省为空） */
  title?: string
  timezone?: string
}

/** 审计：角色/分配等管理变更（只追加） */
export interface AuditEntry {
  id: string
  at: number
  actorId: string
  /** role.create / role.update / role.delete / member.role */
  action: string
  target: string
  detail?: string
}

/** 项目成员：负责人候选/成员筛选只取当前项目成员（工作区目录仍全量，管理页可搜索） */
export interface ProjectMember {
  id: string
  projectId: string
  memberId: string
}

/** 项目级角色覆盖：成员在某项目内使用该角色（缺省继承工作区角色） */
export interface ProjectRoleAssignment {
  id: string
  projectId: string
  memberId: string
  roleId: string
}

/** 角色：内置角色只读；自定义角色可编辑权限矩阵 */
export interface Role {
  id: string
  name: string
  description: string
  builtin: boolean
  /** 作用域：workspace（工作区，缺省）| project（项目级，只用于项目成员覆盖） */
  scope?: 'workspace' | 'project'
  /** 无条件授予的动作集合（内置 member 的「仅本人」条件仍由 policy 处理） */
  permissions: string[]
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

export type NotificationType = 'mention' | 'assigned' | 'comment' | 'status' | 'cycle' | 'system'

/** 站内通知：接收者视角的一行，读态由 readAt 表达（null = 未读） */
export interface Notification {
  id: string
  /** 接收者 */
  memberId: string
  type: NotificationType
  issueId?: string
  actorId?: string
  /** 按 type 解释：mention/comment 为正文摘要，status 为新状态码，cycle 为周期名 */
  message?: string
  readAt: number | null
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
