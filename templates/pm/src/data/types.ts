import type {
  Activity,
  Comment,
  Cycle,
  Issue,
  IssuePriority,
  IssueStatus,
  Member,
  Notification,
  Project,
  SavedView,
  Role,
  AuditEntry,
  ProjectRoleAssignment,
  ProjectMember,
} from '@/types'
import type { Observable } from './observable'

/** 窗口查询条件：每个维度多值（组内 OR），维度之间 AND；空数组 = 该维度不限。
 *  assigneeFilter 中的 '__none__'（lib/filters 的 UNASSIGNED）匹配未分配。 */
export interface IssueWindowFilters {
  projectId: string
  statusFilter: IssueStatus[]
  assigneeFilter: string[]
  priorityFilter: IssuePriority[]
  search: string
  myOnly: boolean
  sortBy: 'updatedAt' | 'priority' | 'createdAt'
  /** 迭代单选：null = 不限，'__current__' = 当前迭代（按 now 派生），'__none__' = 未入迭代，
   *  其他值为 cycleId。与 assignee/priority 同口径：窗口截断后再内存过滤 */
  cycleFilter: string | null
}

export interface ProjectCounts {
  total: number
  byStatus: Record<IssueStatus, number>
  /** 全量优先级计数：筛选选项的计数后缀走全量口径（不受列表窗口截断影响） */
  byPriority: Record<IssuePriority, number>
}

/** 单个周期的工作项计数；cycleId = null 是「未入迭代」桶（管理端结转与侧栏角标用） */
export interface CycleIssueCount {
  cycleId: string | null
  total: number
  done: number
  cancelled: number
}

export interface CreateIssueInput {
  projectId: string
  title: string
  status: IssueStatus
  priority: IssuePriority
  assigneeId: string | null
  reporterId: string
  parentId?: string | null
  order?: number
}

export interface CreateCommentInput {
  issueId: string
  authorId: string
  body: string
}

export interface CreateCycleInput {
  projectId: string
  name: string
  startAt: number
  endAt: number
  goal?: string
}

export interface ActivityInput {
  issueId: string
  actorId: string
  type: string
  field?: string
  from?: string
  to?: string
}

export interface IssueRepository {
  get(id: string): Promise<Issue | undefined>
  live(id: string): Observable<Issue | undefined>
  create(input: CreateIssueInput): Promise<Issue>
  update(id: string, changes: Partial<Issue>): Promise<void>
  /** 软删除：写 deletedAt，行留在库里（回收站可恢复；物理删除走 purge） */
  delete(id: string): Promise<void>
  /** 恢复软删行（清 deletedAt） */
  restore(id: string): Promise<void>
  /** 永久删除（仅回收站内可用，不可恢复） */
  purge(id: string): Promise<void>
  /** 回收站：已删除行，删除时间倒序（同刻按 id 倒序） */
  liveTrash(): Observable<Issue[]>
  liveWindow(filters: IssueWindowFilters, currentUser: string, limit?: number): Observable<Issue[]>
  liveCounts(projectId: string): Observable<ProjectCounts>
  /** 按周期聚合的工作项计数（含 cycleId = null 桶）；sort：null 桶在前，其余 cycleId 升序 */
  liveCycleCounts(projectId: string): Observable<CycleIssueCount[]>
  /** 单个周期的全部工作项（id 升序）。走迭代索引直取，已结束周期也不受 updatedAt 窗口截断 */
  liveCycleIssues(projectId: string, cycleId: string): Observable<Issue[]>
  liveSubIssues(parentId: string): Observable<Issue[]>
  liveRelationCandidates(projectId: string, limit: number): Observable<Issue[]>
  liveByCreatedSince(sinceMs: number): Observable<Issue[]>
  listAll(limit: number): Promise<Issue[]>
  liveAssigneeWorkload(projectId: string): Observable<Array<{ memberId: string; count: number }>>
  bulkGet(ids: string[]): Promise<Array<Issue | undefined>>
  updateMany(updates: Array<{ id: string; changes: Partial<Issue> }>): Promise<void>
  bulkApply(
    ids: string[],
    patch: { status?: IssueStatus; priority?: IssuePriority; assigneeId?: string | null },
    actorId: string,
  ): Promise<void>
  bulkDelete(ids: string[]): Promise<void>
}

export interface ProjectRepository {
  all(): Promise<Project[]>
  get(id: string): Promise<Project | undefined>
  liveAll(): Observable<Project[]>
  create(project: Project): Promise<void>
  update(id: string, changes: Partial<Project>): Promise<void>
  delete(id: string): Promise<void>
  allocateKey(projectId: string): Promise<number>
}

export interface MemberRepository {
  all(): Promise<Member[]>
  get(id: string): Promise<Member | undefined>
  liveAll(): Observable<Member[]>
  create(member: Member): Promise<void>
  update(id: string, changes: Partial<Member>): Promise<void>
  delete(id: string): Promise<void>
}

export interface CommentRepository {
  liveByIssue(issueId: string): Observable<Comment[]>
  add(input: CreateCommentInput): Promise<void>
  update(id: string, body: string): Promise<void>
  delete(id: string): Promise<void>
}

export interface ActivityRepository {
  log(entry: ActivityInput): Promise<void>
  liveByIssue(issueId: string): Observable<Activity[]>
  liveRecent(limit: number): Observable<Activity[]>
}

export interface SavedViewRepository {
  liveAll(): Observable<SavedView[]>
  create(name: string, filters: unknown): Promise<void>
  delete(id: string): Promise<void>
}

/** 站内通知：Dexie 按 memberId 直查；API 模式的身份来自 Bearer token（memberId 仅用于重订阅键） */
export interface NotificationRepository {
  liveFor(memberId: string, limit: number): Observable<Notification[]>
  unreadCount(memberId: string): Observable<number>
  markRead(id: string): Promise<void>
  markAllRead(memberId: string): Promise<void>
}

export interface CycleRepository {
  /** 本项目迭代，startAt 倒序（全部项目作用域 = 跨项目并集） */
  all(projectId: string): Promise<Cycle[]>
  liveAll(projectId: string): Observable<Cycle[]>
  create(input: CreateCycleInput): Promise<Cycle>
  update(id: string, changes: Partial<Cycle>): Promise<void>
  /** 删除迭代并解除其 Issue 的归属（不删 Issue） */
  delete(id: string): Promise<void>
}

export interface SettingsRepository {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  live<T>(key: string): Observable<T | undefined>
}

export interface GlobalStats {
  projects: number
  members: number
  issues: number
  done: number
}

export interface MemberWorkload {
  memberId: string
  total: number
  todo: number
  inProgress: number
  done: number
}

export interface ProjectHealth {
  projectId: string
  name: string
  total: number
  overdue: number
  unassigned: number
  stale: number
}

export interface AdminRepository {
  liveGlobalStats(): Observable<GlobalStats>
  liveMemberWorkload(): Observable<MemberWorkload[]>
  liveProjectHealth(): Observable<ProjectHealth[]>
  exportAll(): Promise<string>
  importAll(json: string): Promise<void>
  resetDemo(): Promise<void>
  wipeAll(): Promise<void>
}

export interface RoleRepository {
  all(): Promise<Role[]>
  liveAll(): Observable<Role[]>
  create(role: Role): Promise<void>
  update(id: string, changes: Partial<Role>): Promise<void>
  delete(id: string): Promise<void>
}

export interface AuditRepository {
  liveRecent(limit: number): Observable<AuditEntry[]>
  add(entry: AuditEntry): Promise<void>
}

export interface ProjectRoleRepository {
  liveAll(): Observable<ProjectRoleAssignment[]>
  /** roleId = null 表示清除项目覆盖（继承工作区角色） */
  set(projectId: string, memberId: string, roleId: string | null): Promise<void>
}

export interface ProjectMemberRepository {
  liveAll(): Observable<ProjectMember[]>
  /** 整组替换某项目的成员 */
  setMembers(projectId: string, memberIds: string[]): Promise<void>
}

export interface Repositories {
  issues: IssueRepository
  projects: ProjectRepository
  members: MemberRepository
  comments: CommentRepository
  activities: ActivityRepository
  savedViews: SavedViewRepository
  cycles: CycleRepository
  settings: SettingsRepository
  notifications: NotificationRepository
  roles: RoleRepository
  audit: AuditRepository
  projectRoles: ProjectRoleRepository
  projectMembers: ProjectMemberRepository
  admin: AdminRepository
}
