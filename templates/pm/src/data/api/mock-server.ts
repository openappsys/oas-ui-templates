import { LIST_WINDOW } from '../../lib/filters'
import { PRIORITY_WEIGHT } from '../../lib/order'
import { mulberry32 } from '../../lib/prng'
import {
  ISSUE_STATUSES,
  type Activity,
  type Comment,
  type Issue,
  type IssuePriority,
  type IssueStatus,
  type Member,
  type MemberRole,
  type Project,
  type SavedView,
} from '../../types'

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
}

export interface MockStore extends SeedTables {
  revision: number
  seq: number
  /** 首次播种的只读快照，reset 从它重放（保证每次 reset 输出相等） */
  seed: SeedTables
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
}

export interface ApiResponse {
  status: number
  body: unknown
}

export const MOCK_ISSUE_COUNT = 2000
const SEARCH_LIMIT = 2000
const DAY = 86_400_000

const MEMBER_NAMES = ['张伟', '李娜', '王强', '赵敏', '刘洋', '陈静', '杨帆', '周琳']
const AVATAR_COLORS = [
  '#0b6cff',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#dc2626',
  '#0891b2',
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
  for (let i = 0; i < MOCK_ISSUE_COUNT; i++) {
    const roll = rand()
    const project = roll < 0.5 ? projects[0] : roll < 0.8 ? projects[1] : projects[2]
    const status = ISSUE_STATUSES[Math.floor(rand() * ISSUE_STATUSES.length)]
    const priority = PRIORITIES[Math.floor(rand() * PRIORITIES.length)]
    const assignee = rand() > 0.15 ? members[Math.floor(rand() * members.length)] : null
    const title = TITLES[Math.floor(rand() * TITLES.length)]
    const labels: string[] = []
    const labelCount = Math.floor(rand() * 3)
    for (let j = 0; j < labelCount; j++) labels.push(LABELS[Math.floor(rand() * LABELS.length)])
    // updatedAt/createdAt 逐条错开，排序窗口里不留并列键（并列键的先后取决于主键序，跨实现易漂移）
    const updatedAt = now - (i + 1) * 60_000
    const createdAt = now - (i + 1) * 3_600_000 - Math.floor(rand() * 59) * 60_000
    const dueAt = rand() > 0.35 ? now + (Math.floor(rand() * 28) - 7) * DAY : null
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
      labels,
      startAt: dueAt !== null && i % 4 === 0 ? dueAt - (1 + (i % 3)) * DAY : null,
      dueAt,
      createdAt,
      updatedAt,
      completedAt: status === 'done' ? updatedAt : null,
      order: i,
      parentId: i > 0 && i % 100 === 0 ? issues[0].id : null,
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
    savedViews: [],
    activities,
    settings: [{ key: 'labels', value: LABELS, updatedAt: now }],
  }
}

export function createMockStore(options: MockStoreOptions = {}): MockStore {
  const seed = buildSeed(options.seed ?? 42, options.now ?? startOfToday())
  return { ...cloneTables(seed), revision: 0, seq: 0, seed }
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
const byUpdatedDesc = (a: Issue, b: Issue) => b.updatedAt - a.updatedAt || cmpKey(b.id, a.id)

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function numQuery(q: URLSearchParams, key: string, fallback: number): number {
  const raw = Number(q.get(key))
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

function segments(path: string): string[] {
  return path
    .replace(/^\/api(?=\/|$)/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s))
}

/** Dexie 语义复刻：search 走全表（无视 project/status、按主键序、上限 2000）；
 *  否则按索引窗口先截断，再套 assignee/myOnly/priority 过滤，最后在窗口内重排 */
function windowIssues(store: MockStore, q: URLSearchParams): Issue[] {
  const projectId = q.get('projectId') ?? ''
  const statusFilter = (q.get('status') as IssueStatus | null) || null
  const limit = numQuery(q, 'limit', LIST_WINDOW)
  const rows = statusFilter
    ? store.issues.filter((i) => i.projectId === projectId && i.status === statusFilter)
    : store.issues.filter((i) => i.projectId === projectId)
  let out = rows.sort(byUpdatedDesc).slice(0, limit)

  const search = (q.get('search') ?? '').trim()
  if (search) {
    const kw = search.toLowerCase()
    out = [...store.issues]
      .sort(byIdAsc)
      .filter((i) => i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw))
      .slice(0, SEARCH_LIMIT)
  }
  const assignee = q.get('assignee')
  if (assignee) out = out.filter((i) => i.assigneeId === assignee)
  if (q.get('myOnly') === '1') {
    const me = q.get('currentUser') ?? ''
    out = out.filter((i) => i.assigneeId === me)
  }
  const priority = (q.get('priority') as IssuePriority | null) || null
  if (priority) out = out.filter((i) => i.priority === priority)

  const sortBy = q.get('sortBy') ?? 'updatedAt'
  if (sortBy === 'priority') {
    out = [...out].sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
  } else if (sortBy === 'createdAt') {
    out = [...out].sort((a, b) => b.createdAt - a.createdAt)
  }
  return out
}

function issueCounts(store: MockStore, projectId: string) {
  const byStatus = Object.fromEntries(ISSUE_STATUSES.map((s) => [s, 0])) as Record<
    IssueStatus,
    number
  >
  let total = 0
  for (const issue of store.issues) {
    if (issue.projectId !== projectId) continue
    total += 1
    byStatus[issue.status] += 1
  }
  return { total, byStatus }
}

function nextId(store: MockStore, prefix: string): string {
  store.seq += 1
  return `${prefix}-new-${store.seq}`
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

function createIssue(store: MockStore, raw: unknown): Issue {
  const input = asRecord(raw) as unknown as CreateIssueBody
  const project = store.projects.find((p) => p.id === input.projectId)
  // 项目缺失时回退到 OAS 号段，且不动项目计数器（与 Dexie 实现的 update 空转一致）
  const keyNum = project?.nextKeyNum ?? 100001
  if (project) project.nextKeyNum = keyNum + 1
  const now = Date.now()
  const issue: Issue = {
    id: nextId(store, 'issue'),
    projectId: String(input.projectId ?? ''),
    key: `${project?.key ?? 'OAS'}-${keyNum}`,
    title: String(input.title ?? ''),
    description: '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assigneeId: input.assigneeId ?? null,
    reporterId: String(input.reporterId ?? ''),
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

function updateMany(store: MockStore, raw: unknown): void {
  const updates = asRecord(raw).updates
  if (!Array.isArray(updates)) fail(400, 'updates must be an array')
  const now = Date.now()
  for (const item of updates) {
    const rec = asRecord(item)
    const issue = store.issues.find((i) => i.id === String(rec.id))
    if (!issue) continue
    Object.assign(issue, asRecord(rec.changes), { updatedAt: now })
  }
}

function bulkApply(store: MockStore, raw: unknown): void {
  const body = asRecord(raw)
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : []
  const patch = asRecord(body.patch)
  const actorId = String(body.actorId ?? '')
  const status = patch.status as IssueStatus | undefined
  const priority = patch.priority as IssuePriority | undefined
  const hasAssignee = 'assigneeId' in patch
  const assigneeId = (patch.assigneeId as string | null) ?? null
  const now = Date.now()
  for (const id of ids) {
    const issue = store.issues.find((i) => i.id === id)
    if (!issue) continue
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
    if (status) issue.status = status
    if (priority) issue.priority = priority
    if (hasAssignee) issue.assigneeId = assigneeId
    issue.updatedAt = now
  }
}

function bulkDelete(store: MockStore, raw: unknown): void {
  const ids = asRecord(raw).ids
  if (!Array.isArray(ids)) fail(400, 'ids must be an array')
  const drop = new Set(ids.map((id) => String(id)))
  store.issues = store.issues.filter((i) => !drop.has(i.id))
}

function exportEnvelope(store: MockStore) {
  return {
    app: 'oas-pm',
    version: 6,
    exportedAt: Date.now(),
    tables: {
      issues: [...store.issues].sort(byIdAsc),
      projects: [...store.projects].sort(byIdAsc),
      members: [...store.members].sort(byIdAsc),
      comments: [...store.comments].sort(byIdAsc),
      savedViews: [...store.savedViews].sort(byIdAsc),
      activities: [...store.activities].sort(byIdAsc),
      settings: [...store.settings].sort((a, b) => cmpKey(a.key, b.key)),
    },
  }
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
  })
  Object.assign(store, next)
}

function resetStore(store: MockStore): void {
  Object.assign(store, cloneTables(store.seed))
}

function wipeStore(store: MockStore): void {
  store.issues = []
  store.projects = []
  store.members = []
  store.comments = []
  store.savedViews = []
  store.activities = []
  store.settings = []
}

function globalStats(store: MockStore) {
  return {
    projects: store.projects.length,
    members: store.members.length,
    issues: store.issues.length,
    done: store.issues.filter((i) => i.status === 'done').length,
  }
}

function memberWorkload(store: MockStore) {
  const sorted = [...store.members].sort(byIdAsc)
  return sorted.map((m) => {
    const rows = store.issues.filter((i) => i.assigneeId === m.id)
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
    const rows = store.issues.filter((i) => i.projectId === p.id)
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
): ApiResponse {
  if (!second) {
    if (method === 'GET') return ok({ items: windowIssues(store, q) })
    if (method === 'POST') {
      const issue = createIssue(store, body)
      store.revision += 1
      return ok({ issue }, 201)
    }
    if (method === 'PATCH') {
      updateMany(store, body)
      store.revision += 1
      return ok({ ok: true })
    }
    fail(405, 'method not allowed')
  }

  if (second === 'all' && method === 'GET') {
    const limit = numQuery(q, 'limit', LIST_WINDOW)
    return ok({ items: [...store.issues].sort(byIdAsc).slice(0, limit) })
  }
  if (second === 'bulk' && method === 'GET') {
    const ids = (q.get('ids') ?? '').split(',').filter(Boolean)
    return ok({ items: ids.map((id) => store.issues.find((i) => i.id === id) ?? null) })
  }
  if (second === 'created-since' && method === 'GET') {
    const since = Number(q.get('since') ?? 0)
    const now = Date.now()
    const rows = store.issues
      .filter((i) => i.createdAt >= since && i.createdAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt || cmpKey(a.id, b.id))
    return ok({ items: rows })
  }
  if (second === 'relation-candidates' && method === 'GET') {
    const projectId = q.get('projectId') ?? ''
    const limit = numQuery(q, 'limit', LIST_WINDOW)
    const rows = store.issues
      .filter((i) => i.projectId === projectId)
      .sort(byIdAsc)
      .slice(0, limit)
    return ok({ items: rows })
  }
  if (second === 'counts' && method === 'GET') {
    return ok(issueCounts(store, q.get('projectId') ?? ''))
  }
  if (second === 'workload' && method === 'GET') {
    const projectId = q.get('projectId') ?? ''
    const counts = new Map<string, number>()
    for (const issue of [...store.issues].filter((i) => i.projectId === projectId).sort(byIdAsc)) {
      if (!issue.assigneeId) continue
      counts.set(issue.assigneeId, (counts.get(issue.assigneeId) ?? 0) + 1)
    }
    return ok({
      items: [...counts.entries()].map(([memberId, count]) => ({ memberId, count })),
    })
  }
  if (second === 'bulk-apply' && method === 'POST') {
    bulkApply(store, body)
    store.revision += 1
    return ok({ ok: true })
  }
  if (second === 'bulk-delete' && method === 'POST') {
    bulkDelete(store, body)
    store.revision += 1
    return ok({ ok: true })
  }

  const id = second
  if (third === 'sub-issues') {
    if (method !== 'GET') fail(405, 'method not allowed')
    const rows = store.issues.filter((i) => i.parentId === id).sort(byIdAsc)
    return ok({ items: rows })
  }
  if (third) fail(404, 'not found')
  if (method === 'GET') return ok({ issue: mustFindIssue(store, id) })
  if (method === 'PATCH') {
    updateIssue(store, id, asRecord(asRecord(body).changes))
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    mustFindIssue(store, id)
    store.issues = store.issues.filter((i) => i.id !== id)
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
      store.projects.push(project)
      store.revision += 1
      return ok({ ok: true }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third === 'allocate-key') {
    if (method !== 'POST') fail(405, 'method not allowed')
    const project = store.projects.find((p) => p.id === second)
    const keyNum = project?.nextKeyNum ?? 100001
    if (project) project.nextKeyNum = keyNum + 1
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
    Object.assign(project, asRecord(body).changes)
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    if (!project) fail(404, 'project not found')
    if (store.issues.some((i) => i.projectId === second)) fail(409, 'project has issues')
    store.projects = store.projects.filter((p) => p.id !== second)
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
): ApiResponse {
  if (!second) {
    if (method === 'GET') return ok({ items: [...store.members].sort(byIdAsc) })
    if (method === 'POST') {
      const member = asRecord(body) as unknown as Member
      if (store.members.some((m) => m.id === member.id)) fail(409, 'member exists')
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
    const role = changes.role as MemberRole | undefined
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
      const comment: Comment = {
        id: nextId(store, 'comment'),
        issueId: String(input.issueId ?? ''),
        authorId: String(input.authorId ?? ''),
        body: String(input.body ?? ''),
        createdAt: Date.now(),
      }
      store.comments.push(comment)
      store.revision += 1
      return ok({ comment }, 201)
    }
    fail(405, 'method not allowed')
  }
  if (third) fail(404, 'not found')
  const comment = store.comments.find((c) => c.id === second)
  if (!comment) fail(404, 'comment not found')
  if (method === 'PATCH') {
    comment.body = String(asRecord(body).body ?? '')
    store.revision += 1
    return ok({ ok: true })
  }
  if (method === 'DELETE') {
    store.comments = store.comments.filter((c) => c.id !== second)
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
    store.activities.push({
      id: nextId(store, 'act'),
      issueId: String(input.issueId ?? ''),
      actorId: String(input.actorId ?? ''),
      type: String(input.type ?? ''),
      field: input.field as string | undefined,
      from: input.from as string | undefined,
      to: input.to as string | undefined,
      createdAt: Date.now(),
    })
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
): ApiResponse {
  if (!second) {
    if (method === 'GET') {
      const rows = [...store.savedViews].sort(
        (a, b) => cmpKey(a.name, b.name) || cmpKey(a.id, b.id),
      )
      return ok({ items: rows })
    }
    if (method === 'POST') {
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
    store.savedViews = store.savedViews.filter((v) => v.id !== second)
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
      wipeStore(store)
      store.revision += 1
      return ok({ ok: true })
    }
  }
  fail(404, 'not found')
}

function route(store: MockStore, req: ApiRequest): ApiResponse {
  const method = req.method.toUpperCase()
  const q = req.query ?? new URLSearchParams()
  const [head, second, third] = segments(req.path)
  switch (head) {
    case 'revision':
      if (method !== 'GET') fail(405, 'method not allowed')
      return ok({ revision: store.revision })
    case 'issues':
      return routeIssues(store, method, second, third, q, req.body)
    case 'projects':
      return routeProjects(store, method, second, third, req.body)
    case 'members':
      return routeMembers(store, method, second, third, req.body)
    case 'comments':
      return routeComments(store, method, second, third, q, req.body)
    case 'activities':
      return routeActivities(store, method, second, third, q, req.body)
    case 'saved-views':
      return routeSavedViews(store, method, second, third, req.body)
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
    return route(store, req)
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, body: { error: e.message } }
    throw e
  }
}
