import type {
  Activity,
  Comment,
  Issue,
  IssuePriority,
  IssueStatus,
  Member,
  Project,
  SavedView,
} from '@/types'
import type { Observable } from './observable'

export interface IssueWindowFilters {
  projectId: string
  statusFilter: IssueStatus | null
  assigneeFilter: string | null
  priorityFilter: IssuePriority | null
  search: string
  myOnly: boolean
  sortBy: 'updatedAt' | 'priority' | 'createdAt'
}

export interface ProjectCounts {
  total: number
  byStatus: Record<IssueStatus, number>
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
  delete(id: string): Promise<void>
  liveWindow(filters: IssueWindowFilters, currentUser: string, limit?: number): Observable<Issue[]>
  liveCounts(projectId: string): Observable<ProjectCounts>
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

export interface Repositories {
  issues: IssueRepository
  projects: ProjectRepository
  members: MemberRepository
  comments: CommentRepository
  activities: ActivityRepository
  savedViews: SavedViewRepository
  settings: SettingsRepository
  admin: AdminRepository
}
