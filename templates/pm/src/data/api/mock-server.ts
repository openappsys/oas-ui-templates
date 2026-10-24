import {
  cycleFilterPredicate,
  demoCycleIdFor,
  demoDoneAt,
  CURRENT_CYCLE,
  NO_CYCLE,
} from '../../lib/cycles.ts'
import { ALL_PROJECTS, LIST_WINDOW, UNASSIGNED } from '../../lib/filters.ts'
import {
  commentNotificationDrafts,
  issueChangeNotificationDrafts,
  type NotificationDraft,
} from '../../lib/notify.ts'
import { PRIORITY_WEIGHT } from '../../lib/order.ts'
import { mulberry32 } from '../../lib/prng.ts'
import { isWorkspaceAction, roleCan, type Action, type Ctx } from '../../permission/policy.ts'
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Activity,
  type Comment,
  type Cycle,
  type Issue,
  type IssuePriority,
  type IssueStatus,
  type Member,
  type MemberRole,
  type Notification,
  type Project,
  type Role,
  type ProjectMember,
  type AuditEntry,
  type ProjectRoleAssignment,
  type SavedView,
} from '../../types/index.ts'
import { demoSavedViewRows } from '../../lib/saved-views.ts'
import { BUILTIN_ROLES } from '../../lib/builtin-roles.ts'
import type { CycleIssueCount } from '../types.ts'

export interface SettingRow {
  key: string
  value: unknown
  updatedAt: number
}

export interface SeedTables {
  issues: Issue[]
  projects: Project[]
  members: Member[]
  comments: Comment[]
  savedViews: SavedView[]
  activities: Activity[]
  settings: SettingRow[]
  cycles: Cycle[]
  notifications: Notification[]
  roles: Role[]
  audit: AuditEntry[]
  projectRoles: ProjectRoleAssignment[]
  projectMembers: ProjectMember[]
}

export interface MockStore extends SeedTables {
  revision: number
  seq: number
  /** 首次播种的只读快照，reset 从它重放（保证每次 reset 输出相等） */
  seed: SeedTables
  /** token → 登录时的成员快照。身份随会话而非业务表存活：
   *  wipe/reset 清表后会话仍有效（角色取库里最新一行，缺行时用快照） */
  sessions: Map<string, Member>
}

export interface MockStoreOptions {
  seed?: number
  /** 播种基准时间；缺省取当日 0 点，使同一份 seed 在同一天内输出稳定 */
  now?: number
}

export interface ApiRequest {
  method: string
  path: string
  query: URLSearchParams
  body?: unknown
  /** Authorization 头原文（`Bearer <token>`）；登录端点之外的所有端点都要求它 */
  authorization?: string | null
}

export interface ApiResponse {
  status: number
  body: unknown
}

export const MOCK_ISSUE_COUNT = 2000
/** 演示口令：所有 seed 成员共用（mock 认证只用于演示，不做真实口令存储） */
export const DEMO_PASSWORD = 'oas'
const SEARCH_LIMIT = 2000
const DAY = 86_400_000

const MEMBER_NAMES = ['张伟', '李娜', '王强', '赵敏', '刘洋', '陈静', '杨帆', '周琳']
const AVATAR_COLORS = [
  '#0b6cff',
  '#7c3aed',
  // 与 src/lib/colors.ts 的 AVATAR_PALETTE 保持一致（700 档，白字 ≥4.5）
  '#047857',
  '#b45309',
  '#dc2626',
  '#0e7490',
  '#be185d',
  '#4f46e5',
]
const TITLES = [
  '修复登录页面白屏',
  '优化列表页加载速度',
  '实现数据导出功能',
  '重构用户权限模块',
  '设计新版仪表盘',
  '接入第三方支付',
  '修复移动端布局错位',
  '编写 API 接口文档',
  '数据库索引优化',
  '增加批量导入功能',
  '实现消息推送',
  '国际化支持',
  '升级依赖版本',
  '代码审查反馈修复',
  '性能压力测试',
  '安全性漏洞扫描',
  '增加暗色主题',
  '优化表格排序算法',
  '实现实时协作编辑',
  '部署 CI 流水线',
]
const LABELS = ['frontend', 'backend', 'design', 'bug', 'feature', 'tech-debt', 'docs', 'infra']
const PRIORITIES: IssuePriority[] = ['urgent', 'high', 'medium', 'low']
const ACTIVITY_TYPES = ['create', 'status', 'priority', 'assignee'] as const

function startOfToday(): number {
  return Math.floor(Date.now() / DAY) * DAY
}

function cloneTables(tables: SeedTables): SeedTables {
  return structuredClone(tables)
}

function buildSeed(seed: number, now: number): SeedTables {
  const rand = mulberry32(seed)

  const members: Member[] = MEMBER_NAMES.map((name, i) => ({
    id: `member-${i + 1}`,
    name,
    email: `user${i + 1}@oas.dev`,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    role: (i === 0 ? 'admin' : i < 3 ? 'member' : 'viewer') as MemberRole,
  }))

  const projects: Project[] = [
    {
      id: 'project-1',
      name: 'OAS 平台',
      key: 'OAS',
      description: '核心平台研发',
      leadId: 'member-1',
      createdAt: now - 90 * DAY,
      nextKeyNum: 100001,
    },
    {
      id: 'project-2',
      name: '移动端 App',
      key: 'APP',
      description: '移动端产品迭代',
      leadId: 'member-2',
      createdAt: now - 60 * DAY,
      nextKeyNum: 200001,
    },
    {
      id: 'project-3',
      name: '数据平台',
      key: 'DATA',
      description: '数据与报表',
      leadId: 'member-3',
      createdAt: now - 30 * DAY,
      nextKeyNum: 300001,
    },
  ]

  const issues: Issue[] = []
  // 迭代（Sprint）：project-1 两份已结束 + 一份进行中。区间与 seed-db v9 同形（进行中的周期
  // 起点 10 天前、终点 4 天后，三期首尾相接），归属规则共用 lib/cycles.demoCycleIdFor——
  // 两种数据源同分布才有契约可比性
  const CUR_START = now - 10 * DAY
  const CUR_END = now + 4 * DAY
  const cycles: Cycle[] = [
    {
      id: 'cycle-1',
      projectId: 'project-1',
      name: 'Sprint 1',
      startAt: CUR_START - 28 * DAY,
      endAt: CUR_START - 14 * DAY,
      goal: '平台基础能力',
      createdAt: CUR_START - 28 * DAY,
      updatedAt: CUR_START - 14 * DAY,
    },
    {
      id: 'cycle-2',
      projectId: 'project-1',
      name: 'Sprint 2',
      startAt: CUR_START - 14 * DAY,
      endAt: CUR_START,
      goal: '权限与导出',
      createdAt: CUR_START - 14 * DAY,
      updatedAt: CUR_START,
    },
    {
      id: 'cycle-3',
      projectId: 'project-1',
      name: 'Sprint 3',
      startAt: CUR_START,
      endAt: CUR_END,
      goal: '性能与体验',
      createdAt: CUR_START,
      updatedAt: now,
    },
  ]
  const cycleById = new Map(cycles.map((c) => [c.id, c]))
  for (let i = 0; i < MOCK_ISSUE_COUNT; i++) {
    const roll = rand()
    const project = roll < 0.5 ? projects[0] : roll < 0.8 ? projects[1] : projects[2]
    const status = ISSUE_STATUSES[Math.floor(rand() * ISSUE_STATUSES.length)]
    const priority = PRIORITIES[Math.floor(rand() * PRIORITIES.length)]
    const assignee = (() => {
      if (rand() <= 0.15) return null
      const pool =
        project.id === 'project-1'
          ? members
          : project.id === 'project-2'
            ? members.slice(0, 5)
            : members.slice(2, 7)
      return pool[Math.floor(rand() * pool.length)]
    })()
    const title = TITLES[Math.floor(rand() * TITLES.length)]
    const labels: string[] = []
    const labelCount = Math.floor(rand() * 3)
    for (let j = 0; j < labelCount; j++) labels.push(LABELS[Math.floor(rand() * LABELS.length)])
    // updatedAt 逐条错开 30 分钟，排序窗口里不留并列键（并列键先后取决于主键序，跨实现易漂移）；
    // 铺满约 41 天，管理页「停滞」列才有非零样本
    const updatedAt = now - (i + 1) * 30 * 60_000
    // createdAt 由 updatedAt 回推 1~60 天：恒早于 updatedAt，且日粒度的分布不均，趋势图才有起伏
    const createdAt = updatedAt - (1 + Math.floor(rand() * 60)) * DAY
    // 截止日期前后铺 63 天（-42 ~ +20）：跨度必须盖住全部三个周期区间，
    // 否则已结束的 Sprint 2 一条都分不到（迭代归属只按 dueAt 落在 [startAt, endAt) 判定）
    const dueAt = rand() > 0.35 ? now + (Math.floor(rand() * 63) - 42) * DAY : null
    const cycleId = project.id === 'project-1' ? demoCycleIdFor(i, dueAt, cycles) : null
    const cycle = cycleId === null ? undefined : cycleById.get(cycleId)
    issues.push({
      id: `issue-${project.id}-${i + 1}`,
      projectId: project.id,
      key: `${project.key}-${i + 1}`,
      title: `${title} #${i + 1}`,
      description: '',
      status,
      priority,
      assigneeId: assignee?.id ?? null,
      reporterId: members[0].id,
      labels: [...new Set(labels)],
      startAt: dueAt !== null && i % 4 === 0 ? dueAt - (1 + (i % 3)) * DAY : null,
      dueAt,
      createdAt,
      updatedAt,
      // 周期内 done 项的完成时刻必须落在周期区间内（seed 同口径 demoDoneAt）：
      // 沿用 updatedAt 会落到周期起点之前，API 模式的燃尽同样变成平直线
      completedAt:
        status === 'done'
          ? cycle
            ? demoDoneAt(cycle.startAt, Math.min(cycle.endAt, now), i)
            : updatedAt
          : null,
      order: i,
      parentId: i > 0 && i % 100 === 0 ? issues[0].id : null,
      cycleId,
    })
  }

  const comments: Comment[] = []
  for (let n = 0; n < 6; n++) {
    comments.push({
      id: `comment-${n + 1}`,
      issueId: issues[n % 3].id,
      authorId: members[(n % 6) + 1].id,
      body: `演示评论 ${n + 1}`,
      createdAt: now - (n + 1) * 1_800_000,
    })
  }

  const activities: Activity[] = []
  for (let n = 0; n < 24; n++) {
    const type = ACTIVITY_TYPES[n % ACTIVITY_TYPES.length]
    activities.push({
      id: `act-${n + 1}`,
      issueId: issues[(n * 7) % 20].id,
      actorId: members[(n % 7) + 1].id,
      type,
      field:
        type === 'status'
          ? 'status'
          : type === 'priority'
            ? 'priority'
            : type === 'assignee'
              ? 'assigneeId'
              : undefined,
      to:
        type === 'status'
          ? 'done'
          : type === 'priority'
            ? 'high'
            : type === 'assignee'
              ? members[1].id
              : undefined,
      createdAt: now - (n + 1) * 600_000,
    })
  }

  return {
    issues,
    projects,
    members,
    comments,
    // 示例保存视图：与 Dexie seed 共用 lib/saved-views 的定义（两种数据源首屏入口同形）
    savedViews: demoSavedViewRows(now),
    activities,
    settings: [{ key: 'labels', value: LABELS, updatedAt: now }],
    cycles,
    notifications: [],
    roles: BUILTIN_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] })),
    audit: [],
    projectRoles: [],
    projectMembers: [
      ...members.map((m) => ({
        id: `project-1:${m.id}`,
        projectId: 'project-1',
        memberId: m.id,
      })),
      ...members.slice(0, 5).map((m) => ({
        id: `project-2:${m.id}`,
        projectId: 'project-2',
        memberId: m.id,
      })),
      ...members.slice(2, 7).map((m) => ({
        id: `project-3:${m.id}`,
        projectId: 'project-3',
        memberId: m.id,
      })),
    ],
  }
}

export function createMockStore(options: MockStoreOptions = {}): MockStore {
  const seed = buildSeed(options.seed ?? 42, options.now ?? startOfToday())
  return { ...cloneTables(seed), revision: 0, seq: 0, seed, sessions: new Map() }
}

/** dev 中间件用：模块级单例 store，配 POST /api/admin/reset 跨请求复位 */
export function createMockHandler(): (req: ApiRequest) => ApiResponse {
  const store = createMockStore()
  return (req) => handleApi(store, req)
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function fail(status: number, message: string): never {
  throw new ApiError(status, message)
}

const ok = (body: unknown, status = 200): ApiResponse => ({ status, body })

const cmpKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const byIdAsc = (a: { id: string }, b: { id: string }) => cmpKey(a.id, b.id)
const byIdDesc = (a: { id: string }, b: { id: string }) => cmpKey(b.id, a.id)
const byUpdatedDesc = (a: Issue, b: Issue) => b.updatedAt - a.updatedAt || cmpKey(b.id, a.id)
/** 软删除唯一谓词（Dexie issue-repo 的 notDeleted 同义）：deletedAt 缺失/null 即在库 */
const notDeleted = (i: Pick<Issue, 'deletedAt'>): boolean => i.deletedAt == null
const byDeletedDesc = (a: Issue, b: Issue) =>
  (b.deletedAt ?? 0) - (a.deletedAt ?? 0) || byIdDesc(a, b)

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function numQuery(q: URLSearchParams, key: string, fallback: number): number {
  const raw = Number(q.get(key))
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

/** 多值 query：逗号分隔（status=todo,done），去重后返回；空值 = 该维度不限 */
function csvQuery(q: URLSearchParams, key: string): string[] {
  const raw = q.get(key)
  if (!raw) return []
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
}

function segments(path: string): string[] {
  return path
    .replace(/^\/api(?=\/|$)/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s))
}

/** 从 `Authorization: Bearer <token>` 取 token；不合法/缺失返回 null */
function bearerToken(req: ApiRequest): string | null {
  const raw = (req.authorization ?? '').trim()
  const match = /^bearer\s+(.+)$/i.exec(raw)
  const token = match?.[1]?.trim()
  return token ? token : null
}

/** 认证守卫：token 缺失/未知一律 401（不泄露 token 是否曾经有效）。
 *  成员仍在库里时返回最新一行（改角色即时生效），被删后回落到登录快照 */
function sessionMember(store: MockStore, req: ApiRequest): Member {
  const token = bearerToken(req)
  if (!token) fail(401, 'missing bearer token')
  const snapshot = store.sessions.get(token)
  if (!snapshot) fail(401, 'invalid or expired token')
  return store.members.find((m) => m.id === snapshot.id) ?? snapshot
}

/** 角色解析：工作区角色 + 目标项目的覆盖（工作区 admin 不被覆盖） */
function workspaceRoleOf(store: MockStore, member: Member): Role | undefined {
  const found = store.roles.find((r) => r.id === member.role)
  if (found) return found
  // 最小 store / 旧备份可能没有角色表：内置角色按默认权限解析，避免 admin 掉成无权限
  return BUILTIN_ROLES.find((r) => r.id === member.role)
}

function roleForProject(store: MockStore, member: Member, projectId?: string): Role | undefined {
  const ws = workspaceRoleOf(store, member)
  if (!ws || member.role === 'admin' || !projectId) return ws
  const override = store.projectRoles.find(
    (a) => a.projectId === projectId && a.memberId === member.id,
  )?.roleId
  const overrideRole = override ? store.roles.find((r) => r.id === override) : undefined
  return overrideRole?.scope === 'project' ? overrideRole : ws
}

function canAction(
  store: MockStore,
  member: Member,
  action: Action,
  projectId?: string,
  ctx?: Ctx,
): boolean {
  const role = roleForProject(store, member, projectId)
  return role ? roleCan(role, member.id, action, ctx) : false
}

/** 审计身份：普通用户只能以自己身份写入；工作区管理员可代填（导入/修复场景） */
function actingId(store: MockStore, actor: Member, requested: unknown): string {
  return typeof requested === 'string' &&
    requested !== '' &&
    canAction(store, actor, 'workspace:manage')
    ? requested
    : actor.id
}

/** 管理端点的最小权限映射；返回 null 表示不在此处做管理门禁 */
function requiredAction(
  method: string,
  head: string,
  second?: string,
  third?: string,
): Action | 'anyAdmin' | null {
  if (method === 'GET') {
    if (head === 'admin') return second === 'export' ? 'workspace:manage' : 'anyAdmin'
    if (head === 'audit') return 'anyAdmin'
    // 角色/项目覆盖/项目成员列表是 App 解析权限与筛选的只读依赖：任何登录用户可读
    return null
  }
  if (head === 'admin') return 'workspace:manage'
  if (head === 'projects' || head === 'cycles') return 'project:manage'
  if (head === 'members') return 'member:manage'
  if (head === 'roles') return 'workspace:manage'
  if (head === 'audit') return 'anyAdmin'
  if (head === 'project-roles' || head === 'project-members') return 'anyAdmin'
  if (head === 'settings') return 'workspace:manage'
  if (head === 'issues' && second && third === 'purge') {
    return 'workspace:manage'
  }
  return null
}

function hasAnyAdmin(store: MockStore, member: Member): boolean {
  return (
    canAction(store, member, 'project:manage') ||
    canAction(store, member, 'member:manage') ||
    canAction(store, member, 'workspace:manage')
  )
}

/** Dexie 语义复刻：search 走全表（无视 project/status、按主键序、上限 2000）；
 *  具体周期 id 走「迭代直取」（整周期范围筛状态，再按 sortBy 排序后分页，与 Dexie 的
 *  [projectId+cycleId] 分支同口径——已结束周期不受 updatedAt 窗口截断）；
 *  其余按索引窗口先截断，再套 assignee/myOnly/priority 过滤，最后在窗口内重排。
 *  多值维度走逗号分隔 query（status/assignee/priority），组内 OR；assignee 的 `__none__` 匹配未分配。
 *  projectId=__all__ 为全部项目作用域：窗口不设项目谓词（跨项目并集） */
function windowIssues(store: MockStore, q: URLSearchParams): Issue[] {
  const projectId = q.get('projectId') ?? ''
  const allProjects = projectId === ALL_PROJECTS
  const statuses = csvQuery(q, 'status')
  const limit = numQuery(q, 'limit', LIST_WINDOW)
  const statusSet = new Set(statuses)
  const search = (q.get('search') ?? '').trim()
  const cycleFilter = q.get('cycle') ?? ''
  const directCycle =
    cycleFilter && cycleFilter !== CURRENT_CYCLE && cycleFilter !== NO_CYCLE ? cycleFilter : null

  let out: Issue[]
  if (search) {
    const kw = search.toLowerCase()
    out = [...store.issues]
      .sort(byIdAsc)
      .filter(
        (i) =>
          notDeleted(i) && (i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw)),
      )
      .slice(0, SEARCH_LIMIT)
  } else if (directCycle) {
    out = store.issues
      .filter(
        (i) =>
          notDeleted(i) &&
          (allProjects || i.projectId === projectId) &&
          i.cycleId === directCycle &&
          (statusSet.size === 0 || statusSet.has(i.status)),
      )
      .sort(byUpdatedDesc)
  } else {
    const rows = store.issues.filter(
      (i) =>
        notDeleted(i) &&
        (allProjects || i.projectId === projectId) &&
        (statusSet.size === 0 || statusSet.has(i.status)),
    )
    out = rows.sort(byUpdatedDesc).slice(0, limit)
  }

  const assignees = csvQuery(q, 'assignee')
  if (assignees.length) {
    const want = new Set(assignees)
    out = out.filter((i) => want.has(i.assigneeId ?? UNASSIGNED))
  }
  if (q.get('myOnly') === '1') {
    const me = q.get('currentUser') ?? ''
    out = out.filter((i) => i.assigneeId === me)
  }
  const priorities = csvQuery(q, 'priority')
  if (priorities.length) {
    const want = new Set(priorities)
    out = out.filter((i) => want.has(i.priority))
  }
  if (cycleFilter) {
    // 与 Dexie 同口径：具体周期已在上面直取（此处是空操作）；当前迭代需要周期区间
    const cycles =
      cycleFilter === CURRENT_CYCLE
        ? store.cycles.filter((c) => allProjects || c.projectId === projectId)
        : []
    out = out.filter(cycleFilterPredicate(cycleFilter, cycles, Date.now()))
  }

  const sortBy = q.get('sortBy') ?? 'updatedAt'
  if (sortBy === 'priority') {
    out = [...out].sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
  } else if (sortBy === 'createdAt') {
    out = [...out].sort((a, b) => b.createdAt - a.createdAt)
  }
  // 迭代直取在筛选 + 排序后分页；搜索分支沿用 2000 上限，窗口分支取数时已截断
  if (directCycle && !search) out = out.slice(0, limit)
  return out
}

/** 按周期聚合计数的 Dexie 对照实现（null 桶在前，其余 cycleId 升序；total = 0 的周期不出现） */
function cycleIssueCounts(store: MockStore, projectId: string): CycleIssueCount[] {
  const allProjects = projectId === ALL_PROJECTS
  const acc = new Map<string | null, { total: number; done: number; cancelled: number }>()
  for (const issue of store.issues) {
    if (!notDeleted(issue)) continue
    if (!allProjects && issue.projectId !== projectId) continue
    const key = issue.cycleId ?? null
    const row = acc.get(key) ?? { total: 0, done: 0, cancelled: 0 }
    row.total += 1
    if (issue.status === 'done') row.done += 1
    else if (issue.status === 'cancelled') row.cancelled += 1
    acc.set(key, row)
  }
  return [...acc.entries()]
    .map(([cycleId, row]) => ({ cycleId, ...row }))
    .filter((r) => r.total > 0)
    .sort((a, b) => {
      const ka = a.cycleId ?? ''
      const kb = b.cycleId ?? ''
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })
}

function issueCounts(store: MockStore, projectId: string) {
  const allProjects = projectId === ALL_PROJECTS
  const byStatus = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])) as Record<
    IssueStatus,
    number
  >
  // 优先级计数与 byStatus 同口径（全量、跳过软删、按项目作用域）
  const byPriority = Object.fromEntries(ISSUE_PRIORITIES.map((p) => [p, 0])) as Record<
    IssuePriority,
    number
  >
  let total = 0
  for (const issue of store.issues) {
    if (!notDeleted(issue)) continue
    if (!allProjects && issue.projectId !== projectId) continue
    total += 1
    byStatus[issue.status] += 1
    byPriority[issue.priority] += 1
  }
  return { total, byStatus, byPriority }
}

function nextId(store: MockStore, prefix: string): string {
  store.seq += 1
  return `${prefix}-new-${store.seq}`
}

/** 通知写入（Dexie 写入钩子的服务端对照）：同一批共享基准时间，+i 让插入顺序稳定 */
function pushNotificationDrafts(
  store: MockStore,
  drafts: NotificationDraft[],
  now = Date.now(),
): void {
  drafts.forEach((draft, index) => {
    store.notifications.push({
      id: nextId(store, 'notif'),
      readAt: null,
      createdAt: now + index,
      ...draft,
    })
  })
}

/** 评论落库后按同一套规则生成通知（@提及 → mention，否则负责人收 comment） */
function notifyCommentStored(store: MockStore, comment: Comment): void {
  const issue = store.issues.find((i) => i.id === comment.issueId)
  if (!issue) return
  pushNotificationDrafts(
    store,
    commentNotificationDrafts({
      issueId: comment.issueId,
      issueAssigneeId: issue.assigneeId,
      actorId: comment.authorId,
      body: comment.body,
      members: store.members,
    }),
  )
}

/** 活动落库后：指派/关闭类状态变更 → 通知（活动先于字段更新到达，读到的是变更前 Issue）。
 *  指派活动可能是字段名 'assigneeId'（详情抽屉）或语义名 'assignee'（批量通道） */
function notifyActivityStored(store: MockStore, activity: Activity): void {
  const isAssignee = activity.type === 'assignee' || activity.type === 'assigneeId'
  if (activity.type !== 'status' && !isAssignee) return
  const issue = store.issues.find((i) => i.id === activity.issueId)
  if (!issue) return
  const drafts = isAssignee
    ? issueChangeNotificationDrafts({
        issueId: activity.issueId,
        actorId: activity.actorId,
        prevAssigneeId: issue.assigneeId,
        nextAssigneeId: activity.to ? activity.to : null,
      })
    : issueChangeNotificationDrafts({
        issueId: activity.issueId,
        actorId: activity.actorId,
        prevAssigneeId: issue.assigneeId,
        prevStatus: issue.status,
        nextStatus: activity.to as IssueStatus | undefined,
      })
  pushNotificationDrafts(store, drafts)
}

interface CreateIssueBody {
  projectId: string
  title: string
  status: IssueStatus
  priority: IssuePriority
  assigneeId: string | null
  reporterId: string
  parentId?: string | null
  order?: number
}

function createIssue(store: MockStore, raw: unknown, actor: Member): Issue {
  const input = asRecord(raw) as unknown as CreateIssueBody
  const project = store.projects.find((p) => p.id === input.projectId)
  // 项目必须存在：否则会生成重复 key 且归属悬空
  if (!project) fail(404, 'project not found')
  if (!canAction(store, actor, 'issue:create', project.id)) fail(403, 'permission denied')
  const keyNum = project.nextKeyNum ?? 100001
  project.nextKeyNum = keyNum + 1
  const now = Date.now()
  const issue: Issue = {
    id: nextId(store, 'issue'),
    projectId: project.id,
    key: `${project.key}-${keyNum}`,
    title: String(input.title ?? ''),
    description: '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId ?? null,
    reporterId: actingId(store, actor, input.reporterId),
    labels: [],
    startAt: null,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
    order: typeof input.order === 'number' ? input.order : now,
    parentId: input.parentId ?? null,
  }
  store.issues.push(issue)
  return issue
}

function mustFindIssue(store: MockStore, id: string): Issue {
  const issue = store.issues.find((i) => i.id === id)
  if (!issue) fail(404, 'issue not found')
  return issue
}

function updateIssue(store: MockStore, id: string, changes: Record<string, unknown>): void {
  const issue = mustFindIssue(store, id)
  Object.assign(issue, changes, { updatedAt: Date.now() })
}

function updateMany(store: MockStore, raw: unknown, actor: Member): void {
  const updates = asRecord(raw).updates
  if (!Array.isArray(updates)) fail(400, 'updates must be an array')
  const now = Date.now()
  for (const item of updates) {
    const rec = asRecord(item)
    const issue = store.issues.find((i) => i.id === String(rec.id))
    // 软删行不参与批量改写（与 Dexie updateMany 的空转一致）
    if (!issue || !notDeleted(issue)) continue
    const changes = asRecord(rec.changes)
    const ctx: Ctx = {
      issue: {
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        projectId: issue.projectId,
      },
    }
    const needsEdit = Object.keys(changes).some(
      (k) => k !== 'status' && k !== 'completedAt' && k !== 'order',
    )
    if ('status' in changes) {
      if (!canAction(store, actor, 'issue:change-status', issue.projectId, ctx)) {
        fail(403, 'permission denied')
      }
    }
    if (needsEdit && !canAction(store, actor, 'issue:edit', issue.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    Object.assign(issue, changes, { updatedAt: now })
  }
}

function bulkApply(store: MockStore, raw: unknown, actor: Member): void {
  const body = asRecord(raw)
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : []
  const patch = asRecord(body.patch)
  const actorId = actingId(store, actor, body.actorId)
  const status = patch.status as IssueStatus | undefined
  const priority = patch.priority as IssuePriority | undefined
  const hasAssignee = 'assigneeId' in patch
  const assigneeId = (patch.assigneeId as string | null) ?? null
  const now = Date.now()
  for (const id of ids) {
    const issue = store.issues.find((i) => i.id === id)
    if (!issue || !notDeleted(issue)) continue
    const ctx: Ctx = {
      issue: {
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        projectId: issue.projectId,
      },
    }
    if (!canAction(store, actor, 'bulk:apply', issue.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    // 批量指派/关闭与单条编辑同一套通知规则；先取旧负责人/状态，再落字段
    const drafts = issueChangeNotificationDrafts({
      issueId: id,
      actorId,
      prevAssigneeId: issue.assigneeId,
      nextAssigneeId: hasAssignee ? assigneeId : undefined,
      prevStatus: issue.status,
      nextStatus: status,
    })
    if (status) {
      store.activities.push({
        id: nextId(store, 'act'),
        issueId: id,
        actorId,
        type: 'status',
        field: 'status',
        to: status,
        createdAt: now,
      })
    }
    if (priority) {
      store.activities.push({
        id: nextId(store, 'act'),
        issueId: id,
        actorId,
        type: 'priority',
        field: 'priority',
        to: priority,
        createdAt: now,
      })
    }
    if (hasAssignee) {
      store.activities.push({
        id: nextId(store, 'act'),
        issueId: id,
        actorId,
        type: 'assignee',
        field: 'assigneeId',
        to: assigneeId ?? '',
        createdAt: now,
      })
    }
    if (status) {
      issue.status = status
      issue.completedAt = status === 'done' ? now : null
    }
    if (priority) issue.priority = priority
    if (hasAssignee) issue.assigneeId = assigneeId
    issue.updatedAt = now
    pushNotificationDrafts(store, drafts, now)
  }
}

function bulkDelete(store: MockStore, raw: unknown, actor: Member): void {
  const ids = asRecord(raw).ids
  if (!Array.isArray(ids)) fail(400, 'ids must be an array')
  const now = Date.now()
  const drop = new Set(ids.map((id) => String(id)))
  // 批量删除与单条 DELETE 同口径：软删除（回收站可恢复）
  for (const issue of store.issues) {
    if (!drop.has(issue.id) || !notDeleted(issue)) continue
    const ctx: Ctx = {
      issue: {
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        projectId: issue.projectId,
      },
    }
    if (!canAction(store, actor, 'bulk:delete', issue.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    issue.deletedAt = now
  }
}

function exportEnvelope(store: MockStore) {
  // 快照隔离：返回的行不能与 store 里的对象共享引用（调用方导出后继续改库——
  // 例如软删除——会把已导出的信封一起改掉）
  return structuredClone({
    app: 'oas-pm',
    version: 10,
    exportedAt: Date.now(),
    tables: {
      issues: [...store.issues].sort(byIdAsc),
      projects: [...store.projects].sort(byIdAsc),
      members: [...store.members].sort(byIdAsc),
      comments: [...store.comments].sort(byIdAsc),
      savedViews: [...store.savedViews].sort(byIdAsc),
      activities: [...store.activities].sort(byIdAsc),
      settings: [...store.settings].sort((a, b) => cmpKey(a.key, b.key)),
      cycles: [...store.cycles].sort(byIdAsc),
      notifications: [...store.notifications].sort(byIdAsc),
      roles: [...store.roles].sort(byIdAsc),
      audit: [...store.audit].sort(byIdAsc),
      projectRoles: [...store.projectRoles].sort(byIdAsc),
      projectMembers: [...store.projectMembers].sort(byIdAsc),
    },
  })
}

function importEnvelope(store: MockStore, raw: unknown): void {
  const json = asRecord(raw).json
  if (typeof json !== 'string') fail(400, 'invalid backup JSON: missing payload')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    fail(400, `invalid backup JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  const record = asRecord(parsed)
  const tables = asRecord(record.tables)
  if (record.app !== 'oas-pm' || record.tables === null || typeof record.tables !== 'object') {
    fail(400, 'unrecognized backup format')
  }
  const rows = (key: string): unknown[] => (Array.isArray(tables[key]) ? tables[key] : [])
  const next = cloneTables({
    issues: rows('issues') as Issue[],
    projects: rows('projects') as Project[],
    members: rows('members') as Member[],
    comments: rows('comments') as Comment[],
    savedViews: rows('savedViews') as SavedView[],
    activities: rows('activities') as Activity[],
    settings: rows('settings') as SettingRow[],
    cycles: rows('cycles') as Cycle[],
    notifications: rows('notifications') as Notification[],
    roles: rows('roles') as Role[],
    audit: rows('audit') as AuditEntry[],
    projectRoles: rows('projectRoles') as ProjectRoleAssignment[],
    projectMembers: rows('projectMembers') as ProjectMember[],
  })
  // v9 备份不含角色：补内置角色，避免成员角色指向不存在的行
  if (next.roles.length === 0) {
    next.roles = BUILTIN_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }))
  }
  Object.assign(store, next)
  // 备份可能来自另一个会话：把自增序号推到导入数据之后，避免 issue-new-1 撞已有 id
  let maxSeq = 0
  for (const row of [...next.issues, ...next.comments, ...next.cycles, ...next.notifications]) {
    const m = /-new-(\d+)$/.exec(row.id)
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
  }
  store.seq = Math.max(store.seq, maxSeq)
}

function resetStore(store: MockStore): void {
  Object.assign(store, cloneTables(store.seed))
}

function wipeStore(store: MockStore, keepMemberId?: string): void {
  const keep = keepMemberId ? store.members.find((m) => m.id === keepMemberId) : undefined
  store.issues = []
  store.projects = []
  store.members = keep ? [keep] : []
  store.comments = []
  store.savedViews = []
  store.activities = []
  store.settings = []
  store.cycles = []
  store.notifications = []
  // 角色是工作区配置：wipe 业务数据时保留内置角色，避免权限页空表
  store.roles = BUILTIN_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] }))
  store.audit = []
  store.projectRoles = []
  store.projectMembers = []
}

function globalStats(store: MockStore) {
  const alive = store.issues.filter(notDeleted)
  return {
    projects: store.projects.length,
    members: store.members.length,
    issues: alive.length,
    done: alive.filter((i) => i.status === 'done').length,
  }
}

function memberWorkload(store: MockStore) {
  const sorted = [...store.members].sort(byIdAsc)
  const alive = store.issues.filter(notDeleted)
  return sorted.map((m) => {
    const rows = alive.filter((i) => i.assigneeId === m.id)
    return {
      memberId: m.id,
      total: rows.length,
      todo: rows.filter((i) => i.status === 'todo').length,
      inProgress: rows.filter((i) => i.status === 'in_progress').length,
      done: rows.filter((i) => i.status === 'done').length,
    }
  })
}

function projectHealth(store: MockStore) {
  const now = Date.now()
  return [...store.projects].sort(byIdAsc).map((p) => {
    const rows = store.issues.filter((i) => notDeleted(i) && i.projectId === p.id)
    const open = rows.filter((i) => i.status !== 'done' && i.status !== 'cancelled')
    return {
      projectId: p.id,
      name: p.name,
      total: rows.length,
      overdue: open.filter((i) => i.dueAt !== null && i.dueAt < now).length,
      unassigned: open.filter((i) => !i.assigneeId).length,
      stale: open.filter((i) => i.updatedAt < now - 14 * DAY).length,
    }
  })
}

function routeIssues(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  q: URLSearchParams,
  body: unknown,
  actor: Member,
): ApiResponse {
  if (!second) {
    if (method === 'GET') {
      // deleted=1：回收站视图（删除时间倒序，同刻按 id 倒序），与 Dexie liveTrash 同序
      if (q.get('deleted') === '1') {
        const rows = store.issues.filter((i) => !notDeleted(i)).sort(byDeletedDesc)
        return ok({ items: rows })
      }
      return ok({ items: windowIssues(store, q) })
    }
    if (method === 'POST') {
      const issue = createIssue(store, body, actor)
      store.revision += 1
      return ok({ issue }, 201)
    }
    if (method === 'PATCH') {
      updateMany(store, body, actor)
      store.revision += 1
      return ok({ ok: true })
    }
    fail(405, 'method not allowed')
  }

  if (second === 'all' && method === 'GET') {
    const limit = numQuery(q, 'limit', LIST_WINDOW)
    return ok({
      items: store.issues.filter(notDeleted).sort(byIdAsc).slice(0, limit),
    })
  }
  if (second === 'bulk' && method === 'GET') {
    const ids = (q.get('ids') ?? '').split(',').filter(Boolean)
    return ok({
      items: ids.map((id) => {
        const row = store.issues.find((i) => i.id === id)
        return row && notDeleted(row) ? row : null
      }),
    })
  }
  if (second === 'created-since' && method === 'GET') {
    const since = Number(q.get('since') ?? 0)
    const now = Date.now()
    const rows = store.issues
      .filter((i) => notDeleted(i) && i.createdAt >= since && i.createdAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt || cmpKey(a.id, b.id))
    return ok({ items: rows })
  }
  if (second === 'relation-candidates' && method === 'GET') {
    const projectId = q.get('projectId') ?? ''
    const limit = numQuery(q, 'limit', LIST_WINDOW)
    const rows = store.issues
      .filter((i) => notDeleted(i) && i.projectId === projectId)
      .sort(byIdAsc)
      .slice(0, limit)
    return ok({ items: rows })
  }
  if (second === 'counts' && method === 'GET') {
    return ok(issueCounts(store, q.get('projectId') ?? ''))
  }
  if (second === 'cycle-counts' && method === 'GET') {
    return ok({ items: cycleIssueCounts(store, q.get('projectId') ?? '') })
  }
  if (second === 'cycle-issues' && method === 'GET') {
    // 迭代直取：整周期取回（id 升序，与 Dexie 的 liveCycleIssues 同序）
    const projectId = q.get('projectId') ?? ''
    const cycleId = q.get('cycleId') ?? ''
    const allProjects = projectId === ALL_PROJECTS
    const rows = store.issues
      .filter(
        (i) =>
          notDeleted(i) &&
          (allProjects || i.projectId === projectId) &&
          (i.cycleId ?? null) === cycleId,
      )
      .sort(byIdAsc)
    return ok({ items: rows })
  }
  if (second === 'workload' && method === 'GET') {
    const projectId = q.get('projectId') ?? ''
    const allProjects = projectId === ALL_PROJECTS
    const counts = new Map<string, number>()
    for (const issue of [...store.issues]
      .filter((i) => notDeleted(i) && (allProjects || i.projectId === projectId))
      .sort(byIdAsc)) {
      if (!issue.assigneeId) continue
      counts.set(issue.assigneeId, (counts.get(issue.assigneeId) ?? 0) + 1)
    }
    return ok({
      items: [...counts.entries()].map(([memberId, count]) => ({ memberId, count })),
    })
  }
  if (second === 'bulk-apply' && method === 'POST') {
    bulkApply(store, body, actor)
    store.revision += 1
    return ok({ ok: true })
  }
  if (second === 'bulk-delete' && method === 'POST') {
    bulkDelete(store, body, actor)
    store.revision += 1
    return ok({ ok: true })
  }

  const id = second
  if (third === 'sub-issues') {
    if (method !== 'GET') fail(405, 'method not allowed')
    const rows = store.issues.filter((i) => notDeleted(i) && i.parentId === id).sort(byIdAsc)
    return ok({ items: rows })
  }
  if (third === 'restore') {
    if (method !== 'POST') fail(405, 'method not allowed')
    const issue = mustFindIssue(store, id)
    const ctx: Ctx = {
      issue: {
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        projectId: issue.projectId,
      },
    }
    if (
      !canAction(store, actor, 'issue:delete', issue.projectId, ctx) &&
      !canAction(store, actor, 'bulk:delete', issue.projectId, ctx)
    ) {
      fail(403, 'permission denied')
    }
    // 恢复软删行（清 deletedAt）；未删除的行视为空操作
    if (!notDeleted(issue)) issue.deletedAt = null
    store.revision += 1
    return ok({ ok: true })
  }
  if (third === 'purge') {
    if (method !== 'DELETE') fail(405, 'method not allowed')
    const issue = mustFindIssue(store, id)
    // 永久删除只对回收站内的行开放：在库行必须先走软删除
    if (notDeleted(issue)) fail(409, 'issue is not deleted')
    store.issues = store.issues.filter((i) => i.id !== id)
    store.comments = store.comments.filter((c) => c.issueId !== id)
    store.activities = store.activities.filter((a) => a.issueId !== id)
    store.notifications = store.notifications.filter((n) => n.issueId !== id)
    for (const child of store.issues) {
      if (child.parentId === id) child.parentId = null
    }
    store.revision += 1
    return ok({ ok: true })
  }
  if (third) fail(404, 'not found')
  if (method === 'GET') {
    // 软删行对外视同不存在（与 Dexie get 同口径）；回收站另有 deleted=1 列表
    const issue = mustFindIssue(store, id)
    if (!notDeleted(issue)) fail(404, 'issue not found')
    return ok({ issue })
  }
  if (method === 'PATCH') {
    const row = mustFindIssue(store, id)
    // 软删行不可改写（与 Dexie update 的空转一致），仍回报成功保持幂等
    if (notDeleted(row)) {
      const raw = asRecord(asRecord(body).changes)
      const changes: Record<string, unknown> = {}
      const allowed = [
        'title',
        'description',
        'status',
        'priority',
        'assigneeId',
        'labels',
        'startAt',
        'dueAt',
        'cycleId',
        'order',
        'parentId',
        'relations',
        'completedAt',
      ]
      for (const key of allowed) {
        if (key in raw) changes[key] = raw[key]
      }
      const ctx: Ctx = {
        issue: {
          assigneeId: row.assigneeId,
          reporterId: row.reporterId,
          projectId: row.projectId,
        },
      }
      if ('status' in changes) {
        if (!canAction(store, actor, 'issue:change-status', row.projectId, ctx)) {
          fail(403, 'permission denied')
        }
      }
      if ('assigneeId' in changes) {
        if (!canAction(store, actor, 'issue:change-assignee', row.projectId, ctx)) {
          fail(403, 'permission denied')
        }
      }
      const needsEdit = Object.keys(changes).some(
        (k) => k !== 'status' && k !== 'assigneeId' && k !== 'completedAt',
      )
      if (needsEdit && !canAction(store, actor, 'issue:edit', row.projectId, ctx)) {
        fail(403, 'permission denied')
      }
      updateIssue(store, id, changes)
    }
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    const issue = mustFindIssue(store, id)
    const ctx: Ctx = {
      issue: {
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        projectId: issue.projectId,
      },
    }
    if (!canAction(store, actor, 'issue:delete', issue.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    // 软删除：只写 deletedAt，行留在库里供回收站恢复（updatedAt 不动，恢复后回原位）
    if (notDeleted(issue)) issue.deletedAt = Date.now()
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeProjects(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  body: unknown,
): ApiResponse {
  if (!second) {
    if (method === 'GET') return ok({ items: [...store.projects].sort(byIdAsc) })
    if (method === 'POST') {
      const project = asRecord(body) as unknown as Project
      if (store.projects.some((p) => p.id === project.id)) fail(409, 'project exists')
      if (store.projects.some((p) => p.key === project.key)) fail(409, 'project key exists')
      store.projects.push(project)
      store.revision += 1
      return ok({ ok: true }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third === 'allocate-key') {
    if (method !== 'POST') fail(405, 'method not allowed')
    const project = store.projects.find((p) => p.id === second)
    if (!project) fail(404, 'project not found')
    const keyNum = project.nextKeyNum ?? 100001
    project.nextKeyNum = keyNum + 1
    store.revision += 1
    return ok({ keyNum })
  }
  if (third) fail(404, 'not found')
  const project = store.projects.find((p) => p.id === second)
  if (method === 'GET') {
    if (!project) fail(404, 'project not found')
    return ok({ project })
  }
  if (method === 'PATCH') {
    if (!project) fail(404, 'project not found')
    const changes = asRecord(asRecord(body).changes)
    const nextKey = changes.key
    if (
      typeof nextKey === 'string' &&
      store.projects.some((p) => p.key === nextKey && p.id !== project.id)
    ) {
      fail(409, 'project key exists')
    }
    Object.assign(project, changes)
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    if (!project) fail(404, 'project not found')
    if (store.issues.some((i) => i.projectId === second)) fail(409, 'project has issues')
    store.projects = store.projects.filter((p) => p.id !== second)
    store.projectMembers = store.projectMembers.filter((a) => a.projectId !== second)
    store.projectRoles = store.projectRoles.filter((a) => a.projectId !== second)
    store.cycles = store.cycles.filter((c) => c.projectId !== second)
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeMembers(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  body: unknown,
  actor: Member,
): ApiResponse {
  if (!second) {
    if (method === 'GET') return ok({ items: [...store.members].sort(byIdAsc) })
    if (method === 'POST') {
      const member = asRecord(body) as unknown as Member
      if (store.members.some((m) => m.id === member.id)) fail(409, 'member exists')
      // 授予角色属于工作区管理能力：防止「管理成员」权限自建 admin 提权
      if (member.role && !canAction(store, actor, 'workspace:manage')) {
        fail(403, 'permission denied')
      }
      store.members.push(member)
      store.revision += 1
      return ok({ ok: true }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third) fail(404, 'not found')
  const member = store.members.find((m) => m.id === second)
  if (method === 'GET') {
    if (!member) fail(404, 'member not found')
    return ok({ member })
  }
  if (method === 'PATCH') {
    if (!member) fail(404, 'member not found')
    const changes = asRecord(asRecord(body).changes)
    const self = actor.id === member.id
    if (self) {
      // 自助资料只允许白名单字段；角色仅工作区管理员可自助调整，邮箱仍由管理员维护
      const canRole = canAction(store, actor, 'workspace:manage')
      for (const key of Object.keys(changes)) {
        if (key === 'role' && canRole) continue
        if (!['name', 'title', 'timezone', 'avatarColor'].includes(key)) {
          fail(403, 'field is admin-managed')
        }
      }
    }
    const role = changes.role as string | undefined
    if (role !== undefined) {
      if (!canAction(store, actor, 'workspace:manage')) fail(403, 'permission denied')
      const roleRow = store.roles.find((r) => r.id === role)
      if (!roleRow && !BUILTIN_ROLES.some((r) => r.id === role)) fail(400, 'unknown role')
      if (roleRow?.scope === 'project') {
        fail(400, 'project role cannot be assigned as workspace role')
      }
    }
    if (role !== undefined && role !== member.role && member.role === 'admin') {
      if (store.members.filter((m) => m.role === 'admin').length <= 1) {
        fail(409, 'cannot demote the last admin')
      }
    }
    Object.assign(member, changes)
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    if (!member) return ok({ ok: true })
    if (member.role === 'admin' && store.members.filter((m) => m.role === 'admin').length <= 1) {
      fail(409, 'cannot remove the last admin')
    }
    for (const issue of store.issues) {
      if (issue.assigneeId === second) issue.assigneeId = null
    }
    store.projectMembers = store.projectMembers.filter((a) => a.memberId !== second)
    store.projectRoles = store.projectRoles.filter((a) => a.memberId !== second)
    // 删除即撤销会话：否则被删管理员仍可用旧 token 管理
    for (const [token, snapshot] of store.sessions) {
      if (snapshot.id === second) store.sessions.delete(token)
    }
    store.members = store.members.filter((m) => m.id !== second)
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeComments(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  q: URLSearchParams,
  body: unknown,
  actor: Member,
): ApiResponse {
  if (!second) {
    if (method === 'GET') {
      const issueId = q.get('issueId') ?? ''
      const rows = store.comments
        .filter((c) => c.issueId === issueId)
        .sort((a, b) => a.createdAt - b.createdAt || cmpKey(a.id, b.id))
      return ok({ items: rows })
    }
    if (method === 'POST') {
      const input = asRecord(body)
      const issue = store.issues.find((i) => i.id === String(input.issueId ?? ''))
      if (!issue) fail(404, 'issue not found')
      if (!canAction(store, actor, 'comment:create', issue.projectId, { issue })) {
        fail(403, 'permission denied')
      }
      // parentId 存直接父评论（真实树）；无嵌套/一级/无限嵌套只是三种渲染模式
      let parentId: string | null = null
      const inputParent = String(input.parentId ?? '')
      if (inputParent) {
        const parent = store.comments.find((c) => c.id === inputParent)
        if (!parent || parent.issueId !== issue.id) fail(404, 'parent comment not found')
        parentId = parent.id
      }
      const comment: Comment = {
        id: nextId(store, 'comment'),
        issueId: issue.id,
        authorId: actingId(store, actor, input.authorId),
        body: String(input.body ?? ''),
        parentId,
        createdAt: Date.now(),
      }
      store.comments.push(comment)
      notifyCommentStored(store, comment)
      store.revision += 1
      return ok({ comment }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third) fail(404, 'not found')
  const comment = store.comments.find((c) => c.id === second)
  if (!comment) fail(404, 'comment not found')
  const issue = store.issues.find((i) => i.id === comment.issueId)
  const ctx: Ctx = {
    comment: { authorId: comment.authorId },
    issue: issue
      ? {
          assigneeId: issue.assigneeId,
          reporterId: issue.reporterId,
          projectId: issue.projectId,
        }
      : undefined,
  }
  if (method === 'PATCH') {
    if (!canAction(store, actor, 'comment:edit', issue?.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    comment.body = String(asRecord(body).body ?? '')
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    if (!canAction(store, actor, 'comment:delete', issue?.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    // 删除评论级联删除整棵子树（无限嵌套下的后代一并删除）
    const doomed = new Set([second])
    let grew = true
    while (grew) {
      grew = false
      for (const c of store.comments) {
        if (c.parentId && doomed.has(c.parentId) && !doomed.has(c.id)) {
          doomed.add(c.id)
          grew = true
        }
      }
    }
    store.comments = store.comments.filter((c) => !doomed.has(c.id))
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeActivities(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  q: URLSearchParams,
  body: unknown,
  actor: Member,
): ApiResponse {
  if (second || third) fail(404, 'not found')
  if (method === 'GET') {
    const issueId = q.get('issueId')
    if (issueId) {
      const rows = store.activities
        .filter((a) => a.issueId === issueId)
        .sort((a, b) => b.createdAt - a.createdAt || cmpKey(b.id, a.id))
      return ok({ items: rows })
    }
    const limit = numQuery(q, 'recent', 100)
    const rows = [...store.activities]
      .sort((a, b) => b.createdAt - a.createdAt || cmpKey(b.id, a.id))
      .slice(0, limit)
    return ok({ items: rows })
  }
  if (method === 'POST') {
    const input = asRecord(body)
    const issue = store.issues.find((i) => i.id === String(input.issueId ?? ''))
    if (!issue) fail(404, 'issue not found')
    const type = String(input.type ?? '')
    const action: Action =
      type === 'status'
        ? 'issue:change-status'
        : type === 'assignee'
          ? 'issue:change-assignee'
          : type === 'comment'
            ? 'comment:create'
            : type === 'comment-edit'
              ? 'comment:edit'
              : type === 'delete'
                ? 'issue:delete'
                : 'issue:edit'
    const ctx: Ctx = {
      issue: {
        assigneeId: issue.assigneeId,
        reporterId: issue.reporterId,
        projectId: issue.projectId,
      },
    }
    if (!canAction(store, actor, action, issue.projectId, ctx)) {
      fail(403, 'permission denied')
    }
    const activity: Activity = {
      id: nextId(store, 'act'),
      issueId: issue.id,
      actorId: actingId(store, actor, input.actorId),
      type,
      field: input.field as string | undefined,
      from: input.from as string | undefined,
      to: input.to as string | undefined,
      createdAt: Date.now(),
    }
    store.activities.push(activity)
    notifyActivityStored(store, activity)
    store.revision += 1
    return ok({ ok: true }, 201)
  }
  fail(405, 'method not allowed')
}

function routeSavedViews(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  body: unknown,
  actor: Member,
): ApiResponse {
  if (!second) {
    if (method === 'GET') {
      const rows = [...store.savedViews].sort(
        (a, b) => cmpKey(a.name, b.name) || cmpKey(a.id, b.id),
      )
      return ok({ items: rows })
    }
    if (method === 'POST') {
      if (!canAction(store, actor, 'view:save')) fail(403, 'permission denied')
      const input = asRecord(body)
      store.savedViews.push({
        id: nextId(store, 'view'),
        name: String(input.name ?? ''),
        filters: JSON.stringify(input.filters ?? {}),
        createdAt: Date.now(),
      })
      store.revision += 1
      return ok({ ok: true }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third) fail(404, 'not found')
  if (method === 'DELETE') {
    if (!canAction(store, actor, 'view:delete')) fail(403, 'permission denied')
    store.savedViews = store.savedViews.filter((v) => v.id !== second)
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

/** 迭代：GET 列表（projectId 省略或 __all__ = 跨项目）/ POST / PATCH / DELETE。
 *  删除时不删 Issue，只把归属清空（与 Dexie 实现一致） */
function routeCycles(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  q: URLSearchParams,
  body: unknown,
): ApiResponse {
  if (!second) {
    if (method === 'GET') {
      const projectId = q.get('projectId') ?? ''
      const allProjects = projectId === '' || projectId === ALL_PROJECTS
      const rows = store.cycles
        .filter((c) => allProjects || c.projectId === projectId)
        .sort((a, b) => b.startAt - a.startAt || cmpKey(b.id, a.id))
      return ok({ items: rows })
    }
    if (method === 'POST') {
      const input = asRecord(body)
      const now = Date.now()
      const cycle: Cycle = {
        id: nextId(store, 'cycle'),
        projectId: String(input.projectId ?? ''),
        name: String(input.name ?? ''),
        startAt: Number(input.startAt ?? 0),
        endAt: Number(input.endAt ?? 0),
        ...(typeof input.goal === 'string' ? { goal: input.goal } : {}),
        createdAt: now,
        updatedAt: now,
      }
      store.cycles.push(cycle)
      store.revision += 1
      return ok({ cycle }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third) fail(404, 'not found')
  const cycle = store.cycles.find((c) => c.id === second)
  if (!cycle) fail(404, 'cycle not found')
  if (method === 'GET') return ok({ cycle })
  if (method === 'PATCH') {
    Object.assign(cycle, asRecord(asRecord(body).changes), { updatedAt: Date.now() })
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    const now = Date.now()
    for (const issue of store.issues) {
      if (issue.cycleId !== second) continue
      issue.cycleId = null
      issue.updatedAt = now
    }
    store.cycles = store.cycles.filter((c) => c.id !== second)
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeNotifications(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  q: URLSearchParams,
  member: Member,
): ApiResponse {
  if (!second) {
    if (method !== 'GET') fail(405, 'method not allowed')
    const limit = numQuery(q, 'limit', 50)
    const rows = store.notifications
      .filter((n) => n.memberId === member.id)
      .sort((a, b) => b.createdAt - a.createdAt || cmpKey(b.id, a.id))
      .slice(0, limit)
    return ok({ items: rows })
  }
  if (second === 'unread-count' && !third) {
    if (method !== 'GET') fail(405, 'method not allowed')
    const count = store.notifications.filter(
      (n) => n.memberId === member.id && n.readAt === null,
    ).length
    return ok({ count })
  }
  if (method !== 'POST') fail(405, 'method not allowed')
  if (second === 'read-all' && !third) {
    const now = Date.now()
    let changed = false
    for (const row of store.notifications) {
      if (row.memberId === member.id && row.readAt === null) {
        row.readAt = now
        changed = true
      }
    }
    if (changed) store.revision += 1
    return ok({ ok: true })
  }
  if (third === 'read') {
    const row = store.notifications.find((n) => n.id === second)
    // 别人的通知一律 404：不确认其他成员收件箱里是否存在该 id
    if (!row || row.memberId !== member.id) fail(404, 'notification not found')
    if (row.readAt === null) {
      row.readAt = Date.now()
      store.revision += 1
    }
    return ok({ ok: true })
  }
  fail(404, 'not found')
}

function routeRoles(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  body: unknown,
): ApiResponse {
  if (!second) {
    if (method === 'GET') return ok({ items: [...store.roles].sort(byIdAsc) })
    if (method === 'POST') {
      const role = asRecord(body) as unknown as Role
      if (!role?.id || !role.name) fail(400, 'role id/name required')
      if (store.roles.some((r) => r.id === role.id)) fail(409, 'role exists')
      const permissions = (role.permissions ?? []) as Action[]
      store.roles.push({
        ...role,
        builtin: false,
        permissions:
          role.scope === 'project' ? permissions.filter((a) => !isWorkspaceAction(a)) : permissions,
      })
      store.revision += 1
      return ok({ ok: true }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third) fail(404, 'not found')
  const role = store.roles.find((r) => r.id === second)
  if (!role) fail(404, 'role not found')
  if (method === 'PATCH') {
    if (role.builtin) fail(403, 'builtin role cannot be edited')
    const changes = asRecord(asRecord(body).changes) as Partial<Role>
    // 作用域创建后不可变：变更会让已分配成员/项目覆盖落到错误层级
    const safe = { ...changes }
    delete safe.scope
    if (safe.permissions) {
      const permissions = safe.permissions as Action[]
      safe.permissions =
        role.scope === 'project' ? permissions.filter((a) => !isWorkspaceAction(a)) : permissions
    }
    Object.assign(role, safe, { id: role.id, builtin: false })
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    if (role.builtin) fail(403, 'builtin role cannot be deleted')
    if (store.members.some((m) => m.role === role.id)) {
      fail(409, 'role is assigned to members')
    }
    if (store.projectRoles.some((a) => a.roleId === role.id)) {
      fail(409, 'role is used by project overrides')
    }
    store.roles = store.roles.filter((r) => r.id !== role.id)
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeAudit(
  store: MockStore,
  method: string,
  second: string | undefined,
  q: URLSearchParams,
  body: unknown,
): ApiResponse {
  if (second) fail(404, 'not found')
  if (method === 'GET') {
    const limit = numQuery(q, 'limit', 20)
    return ok({
      items: [...store.audit].sort((a, b) => b.at - a.at).slice(0, limit),
    })
  }
  if (method === 'POST') {
    const entry = asRecord(body) as unknown as AuditEntry
    if (!entry?.id || !entry.action) fail(400, 'audit id/action required')
    store.audit.push(entry)
    store.revision += 1
    return ok({ ok: true }, 201)
  }
  fail(405, 'method not allowed')
}

function routeProjectRoles(
  store: MockStore,
  method: string,
  second: string | undefined,
  body: unknown,
): ApiResponse {
  if (second) fail(404, 'not found')
  if (method === 'GET') return ok({ items: [...store.projectRoles].sort(byIdAsc) })
  if (method === 'PUT') {
    const input = asRecord(body)
    const projectId = String(input.projectId ?? '')
    const memberId = String(input.memberId ?? '')
    const roleId = input.roleId === null || input.roleId === undefined ? null : String(input.roleId)
    if (!projectId || !memberId) fail(400, 'projectId/memberId required')
    if (!store.projects.some((p) => p.id === projectId)) fail(404, 'project not found')
    if (!store.members.some((m) => m.id === memberId)) fail(404, 'member not found')
    if (roleId !== null) {
      const role = store.roles.find((r) => r.id === roleId)
      if (!role) fail(400, 'unknown role')
      if (role.scope !== 'project') fail(400, 'project role required')
      if (!store.projectMembers.some((a) => a.projectId === projectId && a.memberId === memberId)) {
        fail(400, 'member is not in project')
      }
    }
    const id = `${projectId}:${memberId}`
    store.projectRoles = store.projectRoles.filter((a) => a.id !== id)
    if (roleId !== null) store.projectRoles.push({ id, projectId, memberId, roleId })
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeProjectMembers(
  store: MockStore,
  method: string,
  second: string | undefined,
  body: unknown,
): ApiResponse {
  if (second) fail(404, 'not found')
  if (method === 'GET') return ok({ items: [...store.projectMembers].sort(byIdAsc) })
  if (method === 'PUT') {
    const input = asRecord(body)
    const projectId = String(input.projectId ?? '')
    const memberIds = Array.isArray(input.memberIds) ? input.memberIds.map(String) : []
    if (!projectId) fail(400, 'projectId required')
    if (!store.projects.some((p) => p.id === projectId)) fail(404, 'project not found')
    if (memberIds.some((id) => !store.members.some((m) => m.id === id))) {
      fail(400, 'unknown member')
    }
    store.projectMembers = store.projectMembers.filter((a) => a.projectId !== projectId)
    store.projectRoles = store.projectRoles.filter(
      (a) => a.projectId !== projectId || memberIds.includes(a.memberId),
    )
    store.projectMembers.push(
      ...[...new Set(memberIds)].map((memberId) => ({
        id: `${projectId}:${memberId}`,
        projectId,
        memberId,
      })),
    )
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeSettings(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  body: unknown,
): ApiResponse {
  if (!second || third) fail(404, 'not found')
  const row = store.settings.find((s) => s.key === second)
  if (method === 'GET') return ok({ found: Boolean(row), value: row ? row.value : null })
  if (method === 'PUT') {
    const value = asRecord(body).value
    if (row) {
      row.value = value
      row.updatedAt = Date.now()
    } else {
      store.settings.push({ key: second, value, updatedAt: Date.now() })
    }
    store.revision += 1
    return ok({ ok: true })
  }
  fail(405, 'method not allowed')
}

function routeAdmin(
  store: MockStore,
  method: string,
  second: string | undefined,
  third: string | undefined,
  body: unknown,
): ApiResponse {
  if (third) fail(404, 'not found')
  if (method === 'GET') {
    if (second === 'stats') return ok(globalStats(store))
    if (second === 'workload') return ok({ items: memberWorkload(store) })
    if (second === 'health') return ok({ items: projectHealth(store) })
    if (second === 'export') return ok(exportEnvelope(store))
  }
  if (method === 'POST') {
    if (second === 'import') {
      importEnvelope(store, body)
      store.revision += 1
      return ok({ ok: true })
    }
    if (second === 'reset') {
      resetStore(store)
      store.revision += 1
      return ok({ ok: true })
    }
    if (second === 'wipe') {
      const keep = asRecord(asRecord(body)).keepMemberId
      wipeStore(store, typeof keep === 'string' ? keep : undefined)
      store.revision += 1
      return ok({ ok: true })
    }
  }
  fail(404, 'not found')
}

/** 认证：login / logout 免鉴权（登出必须幂等：会话已死也要能清完）；me 需要 Bearer */
function routeAuth(
  store: MockStore,
  method: string,
  second: string | undefined,
  req: ApiRequest,
  member: Member | null,
): ApiResponse {
  if (second === 'login') {
    if (method !== 'POST') fail(405, 'method not allowed')
    const input = asRecord(req.body)
    const email = String(input.email ?? '')
      .trim()
      .toLowerCase()
    const password = String(input.password ?? '')
    if (!email || !password) fail(400, 'email and password are required')
    const found = store.members.find((m) => m.email.toLowerCase() === email)
    // 未知邮箱与错误口令返回同一结果：不暴露账号是否存在
    if (!found || password !== DEMO_PASSWORD) fail(401, 'invalid credentials')
    const token = `mock-${crypto.randomUUID()}`
    store.sessions.set(token, found)
    return ok({ token, member: found })
  }
  if (second === 'logout') {
    if (method !== 'POST') fail(405, 'method not allowed')
    const token = bearerToken(req)
    if (token) store.sessions.delete(token)
    // 幂等：token 已知或已失效都回报成功，客户端只需清本地状态
    return { status: 204, body: null }
  }
  if (!member) fail(401, 'invalid or expired token')
  if (second === 'me') {
    if (method !== 'GET') fail(405, 'method not allowed')
    return ok({ member })
  }
  fail(404, 'not found')
}

function route(store: MockStore, req: ApiRequest, member: Member | null): ApiResponse {
  const method = req.method.toUpperCase()
  const q = req.query ?? new URLSearchParams()
  const [head, second, third] = segments(req.path)
  switch (head) {
    case 'auth':
      return routeAuth(store, method, second, req, member)
    case 'revision':
      if (method !== 'GET') fail(405, 'method not allowed')
      return ok({ revision: store.revision })
    case 'issues':
      return routeIssues(store, method, second, third, q, req.body, member as Member)
    case 'projects':
      return routeProjects(store, method, second, third, req.body)
    case 'members':
      return routeMembers(store, method, second, third, req.body, member as Member)
    case 'roles':
      return routeRoles(store, method, second, third, req.body)
    case 'audit':
      return routeAudit(store, method, second, q, req.body)
    case 'project-roles':
      return routeProjectRoles(store, method, second, req.body)
    case 'project-members':
      return routeProjectMembers(store, method, second, req.body)
    case 'comments':
      return routeComments(store, method, second, third, q, req.body, member as Member)
    case 'activities':
      return routeActivities(store, method, second, third, q, req.body, member as Member)
    case 'saved-views':
      return routeSavedViews(store, method, second, third, req.body, member as Member)
    case 'cycles':
      return routeCycles(store, method, second, third, q, req.body)
    case 'notifications': {
      if (!member) fail(401, 'invalid or expired token')
      return routeNotifications(store, method, second, third, q, member)
    }
    case 'settings':
      return routeSettings(store, method, second, third, req.body)
    case 'admin':
      return routeAdmin(store, method, second, third, req.body)
    default:
      fail(404, 'not found')
  }
}

export function handleApi(store: MockStore, req: ApiRequest): ApiResponse {
  try {
    const [head, second, third] = segments(req.path)
    const method = req.method.toUpperCase()
    // 免鉴权端点：登录、登出（登出必须幂等）。其余端点（含 revision 轮询）都要求 Bearer
    const anonymous = head === 'auth' && (second === 'login' || second === 'logout')
    const member = anonymous ? null : sessionMember(store, req)
    if (member) {
      const required = requiredAction(method, head, second, third)
      // 自助改资料：PATCH /api/members/:me 不走管理门禁（字段白名单在 routeMembers）
      const selfProfile = method === 'PATCH' && head === 'members' && second === member.id
      if (required && !selfProfile) {
        const allowed =
          required === 'anyAdmin' ? hasAnyAdmin(store, member) : canAction(store, member, required)
        if (!allowed) fail(403, 'permission denied')
      }
      // 回收站列表属于工作区管理面，普通成员不可枚举已删除标题
      if (head === 'issues' && method === 'GET' && req.query?.get('deleted') === '1') {
        if (!canAction(store, member, 'workspace:manage')) fail(403, 'permission denied')
      }
    }
    return route(store, req, member)
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, body: { error: e.message } }
    throw e
  }
}
