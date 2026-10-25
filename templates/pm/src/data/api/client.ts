import { LIST_WINDOW } from '@/lib/filters'
import { NOTIFICATION_LIMIT } from '@/lib/notify'
import type {
  Activity,
  Comment,
  Cycle,
  Issue,
  Member,
  Notification,
  Project,
  Role,
  AuditEntry,
  ProjectMember,
  ProjectRoleAssignment,
  SavedView,
} from '@/types'
import { ApiError, errorMessage } from './errors'
import { clearToken, getToken, sessionEvents, type SessionEvents } from './session'
import type {
  ActivityInput,
  ActivityRepository,
  AdminRepository,
  CommentRepository,
  CreateCommentInput,
  CreateCycleInput,
  CreateIssueInput,
  CycleIssueCount,
  CycleRepository,
  GlobalStats,
  IssueRepository,
  IssueWindowFilters,
  MemberRepository,
  MemberWorkload,
  NotificationRepository,
  ProjectCounts,
  ProjectHealth,
  ProjectRepository,
  Repositories,
  RoleRepository,
  AuditRepository,
  ProjectMemberRepository,
  ProjectRoleRepository,
  SavedViewRepository,
  SettingsRepository,
} from '@/data/types'
import type { Observable, Observer } from '../observable'

const DEFAULT_POLL_MS = 1200

interface ApiResult {
  status: number
  body: unknown
}

/** 会话相关的可注入点：测试注入内存实现，应用走 session.ts（localStorage + window 事件） */
export interface ApiAuthOptions {
  token?: () => string | null
  clearToken?: () => void
  events?: SessionEvents
}

/** 传输层注入点：默认走原生 fetch；测试注入直连 handler 的实现（vitest 无真实 HTTP） */
export type ApiTransport = (
  method: string,
  path: string,
  query: URLSearchParams,
  body?: unknown,
  token?: string | null,
) => Promise<ApiResult>

export interface ApiClientOptions {
  transport?: ApiTransport
  /** revision 轮询间隔；测试用小值避免真等 */
  pollMs?: number
  /** 会话注入；缺省用 localStorage 里的 token 与 window 事件 */
  auth?: ApiAuthOptions
}

function fetchTransport(
  method: string,
  path: string,
  query: URLSearchParams,
  body?: unknown,
  token?: string | null,
) {
  const qs = query.toString()
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  return fetch(qs ? `${path}?${qs}` : path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    query.set(key, String(value))
  }
  return query
}

/** 多值筛选 → 逗号分隔的单值 query 参数（status=todo,done）；空数组不发参数 */
function joinFilter(values: readonly string[]): string | null {
  return values.length ? values.join(',') : null
}

const asItems = <T>(body: unknown): T[] => (body as { items: T[] }).items

export function createApiRepositories(options: ApiClientOptions = {}): Repositories {
  const auth = options.auth ?? {}
  const readToken = auth.token ?? getToken
  const dropToken = auth.clearToken ?? clearToken
  const events = auth.events ?? sessionEvents
  const transport = options.transport ?? fetchTransport
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS

  /** 401 只对「携 token 却被拒」判会话失效：无 token 的请求（登录页后台订阅）不该反复踢人 */
  const expireSession = () => {
    if (readToken() === null) return
    dropToken()
    events.expired()
  }

  const call = async (
    method: string,
    path: string,
    query: URLSearchParams = new URLSearchParams(),
    body?: unknown,
  ): Promise<ApiResult> => {
    const res = await transport(method, path, query, body, readToken())
    if (res.status === 401) expireSession()
    else if (res.status === 403) events.forbidden(errorMessage(res.body) ?? 'forbidden')
    return res
  }

  const toError = (res: ApiResult, method: string, path: string): ApiError =>
    new ApiError(
      res.status,
      errorMessage(res.body) ?? `request failed: ${res.status} ${method} ${path}`,
    )

  const send = async <T>(method: string, path: string, query?: URLSearchParams, body?: unknown) => {
    const res = await call(method, path, query, body)
    if (res.status >= 400) throw toError(res, method, path)
    return res.body as T
  }

  const poller = createRevisionPoller(call, pollMs)
  const poke = () => poller.poke()

  /** 订阅即取一次；之后按 revision 变化重取（revision 轮询共享，引用计数归零即停） */
  const live = <T>(load: () => Promise<T>): Observable<T> => ({
    subscribe(observer: Observer<T>): () => void {
      let stopped = false
      let seen = -1
      let release: (() => void) | null = null
      const fail = (e: unknown) => {
        if (!stopped) observer.error?.(e)
      }
      void (async () => {
        try {
          // 先读 revision 再取数：保证「取数」晚于「基线版本」，期间发生的写不会漏推送
          const baseline = await poller.read()
          const value = await load()
          if (stopped) return
          seen = baseline
          observer.next(value)
          release = poller.add((revision) => {
            if (revision === seen) return
            seen = revision
            load()
              .then((next) => {
                if (!stopped) observer.next(next)
              })
              .catch(fail)
          })
        } catch (e) {
          fail(e)
        }
      })()
      return () => {
        stopped = true
        release?.()
        release = null
      }
    },
  })

  const getIssue = async (id: string): Promise<Issue | undefined> => {
    const res = await call('GET', `/api/issues/${encodeURIComponent(id)}`)
    if (res.status === 404) return undefined
    if (res.status >= 400) throw toError(res, 'GET', `/api/issues/${id}`)
    return (res.body as { issue: Issue }).issue
  }

  const getProject = async (id: string): Promise<Project | undefined> => {
    const res = await call('GET', `/api/projects/${encodeURIComponent(id)}`)
    if (res.status === 404) return undefined
    if (res.status >= 400) throw toError(res, 'GET', `/api/projects/${id}`)
    return (res.body as { project: Project }).project
  }

  const getMember = async (id: string): Promise<Member | undefined> => {
    const res = await call('GET', `/api/members/${encodeURIComponent(id)}`)
    if (res.status === 404) return undefined
    if (res.status >= 400) throw toError(res, 'GET', `/api/members/${id}`)
    return (res.body as { member: Member }).member
  }

  const issues: IssueRepository = {
    get: getIssue,
    live: (id) => live(() => getIssue(id)),
    create: async (input: CreateIssueInput) => {
      const body = await send<{ issue: Issue }>('POST', '/api/issues', undefined, input)
      poke()
      return body.issue
    },
    update: async (id, changes) => {
      await send('PATCH', `/api/issues/${encodeURIComponent(id)}`, undefined, { changes })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/issues/${encodeURIComponent(id)}`)
      poke()
    },
    restore: async (id) => {
      await send('POST', `/api/issues/${encodeURIComponent(id)}/restore`)
      poke()
    },
    purge: async (id) => {
      await send('DELETE', `/api/issues/${encodeURIComponent(id)}/purge`)
      poke()
    },
    liveTrash: () =>
      live(async () =>
        asItems<Issue>(
          await send<{ items: Issue[] }>('GET', '/api/issues', buildQuery({ deleted: 1 })),
        ),
      ),
    liveWindow: (filters: IssueWindowFilters, currentUser: string, limit = LIST_WINDOW) =>
      live(async () =>
        asItems<Issue>(
          await send<{ items: Issue[] }>(
            'GET',
            '/api/issues',
            buildQuery({
              projectId: filters.projectId,
              status: joinFilter(filters.statusFilter),
              assignee: joinFilter(filters.assigneeFilter),
              priority: joinFilter(filters.priorityFilter),
              labels: joinFilter(filters.labelFilter ?? []),
              search: filters.search,
              myOnly: filters.myOnly ? '1' : null,
              currentUser,
              sortBy: filters.sortBy,
              cycle: filters.cycleFilter,
              limit,
            }),
          ),
        ),
      ),
    liveCounts: (projectId) =>
      live(() => send<ProjectCounts>('GET', '/api/issues/counts', buildQuery({ projectId }))),
    liveCycleCounts: (projectId) =>
      live(async () =>
        asItems<CycleIssueCount>(
          await send<{ items: CycleIssueCount[] }>(
            'GET',
            '/api/issues/cycle-counts',
            buildQuery({ projectId }),
          ),
        ),
      ),
    liveCycleIssues: (projectId, cycleId) =>
      live(async () =>
        asItems<Issue>(
          await send<{ items: Issue[] }>(
            'GET',
            '/api/issues/cycle-issues',
            buildQuery({ projectId, cycleId }),
          ),
        ),
      ),
    liveSubIssues: (parentId) =>
      live(async () =>
        asItems<Issue>(
          await send<{ items: Issue[] }>(
            'GET',
            `/api/issues/${encodeURIComponent(parentId)}/sub-issues`,
          ),
        ),
      ),
    liveRelationCandidates: (projectId, limit) =>
      live(async () =>
        asItems<Issue>(
          await send<{ items: Issue[] }>(
            'GET',
            '/api/issues/relation-candidates',
            buildQuery({ projectId, limit }),
          ),
        ),
      ),
    liveByCreatedSince: (sinceMs) =>
      live(async () =>
        asItems<Issue>(
          await send<{ items: Issue[] }>(
            'GET',
            '/api/issues/created-since',
            buildQuery({ since: sinceMs }),
          ),
        ),
      ),
    listAll: async (limit) =>
      asItems<Issue>(
        await send<{ items: Issue[] }>('GET', '/api/issues/all', buildQuery({ limit })),
      ),
    liveAssigneeWorkload: (projectId) =>
      live(async () =>
        asItems<{ memberId: string; count: number }>(
          await send<{ items: Array<{ memberId: string; count: number }> }>(
            'GET',
            '/api/issues/workload',
            buildQuery({ projectId }),
          ),
        ),
      ),
    liveSubProgress: (projectId) =>
      live(async () =>
        asItems<{ parentId: string; done: number; total: number }>(
          await send<{
            items: Array<{ parentId: string; done: number; total: number }>
          }>('GET', '/api/issues/sub-progress', buildQuery({ projectId })),
        ),
      ),
    bulkGet: async (ids) => {
      const rows = asItems<Issue | null>(
        await send<{ items: Array<Issue | null> }>(
          'GET',
          '/api/issues/bulk',
          buildQuery({ ids: ids.join(',') }),
        ),
      )
      return rows.map((row) => row ?? undefined)
    },
    updateMany: async (updates) => {
      await send('PATCH', '/api/issues', undefined, { updates })
      poke()
    },
    bulkApply: async (ids, patch, actorId) => {
      await send('POST', '/api/issues/bulk-apply', undefined, { ids, patch, actorId })
      poke()
    },
    bulkDelete: async (ids) => {
      await send('POST', '/api/issues/bulk-delete', undefined, { ids })
      poke()
    },
  }

  const projects: ProjectRepository = {
    all: async () => asItems<Project>(await send<{ items: Project[] }>('GET', '/api/projects')),
    get: getProject,
    liveAll: () =>
      live(async () => asItems<Project>(await send<{ items: Project[] }>('GET', '/api/projects'))),
    create: async (project) => {
      await send('POST', '/api/projects', undefined, project)
      poke()
    },
    update: async (id, changes) => {
      await send('PATCH', `/api/projects/${encodeURIComponent(id)}`, undefined, { changes })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/projects/${encodeURIComponent(id)}`)
      poke()
    },
    allocateKey: async (projectId) =>
      (
        await send<{ keyNum: number }>(
          'POST',
          `/api/projects/${encodeURIComponent(projectId)}/allocate-key`,
        )
      ).keyNum,
  }

  const members: MemberRepository = {
    all: async () => asItems<Member>(await send<{ items: Member[] }>('GET', '/api/members')),
    get: getMember,
    liveAll: () =>
      live(async () => asItems<Member>(await send<{ items: Member[] }>('GET', '/api/members'))),
    create: async (member) => {
      await send('POST', '/api/members', undefined, member)
      poke()
    },
    update: async (id, changes) => {
      await send('PATCH', `/api/members/${encodeURIComponent(id)}`, undefined, { changes })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/members/${encodeURIComponent(id)}`)
      poke()
    },
  }

  const roles: RoleRepository = {
    all: async () => asItems<Role>(await send<{ items: Role[] }>('GET', '/api/roles')),
    liveAll: () =>
      live(async () => asItems<Role>(await send<{ items: Role[] }>('GET', '/api/roles'))),
    create: async (role) => {
      await send('POST', '/api/roles', undefined, role)
      poke()
    },
    update: async (id, changes) => {
      await send('PATCH', `/api/roles/${encodeURIComponent(id)}`, undefined, { changes })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/roles/${encodeURIComponent(id)}`)
      poke()
    },
  }

  const audit: AuditRepository = {
    liveRecent: (limit) =>
      live(async () =>
        asItems<AuditEntry>(
          await send<{ items: AuditEntry[] }>('GET', '/api/audit', buildQuery({ limit })),
        ),
      ),
    add: async (entry) => {
      await send('POST', '/api/audit', undefined, entry)
      poke()
    },
  }

  const projectRoles: ProjectRoleRepository = {
    liveAll: () =>
      live(async () =>
        asItems<ProjectRoleAssignment>(
          await send<{ items: ProjectRoleAssignment[] }>('GET', '/api/project-roles'),
        ),
      ),
    set: async (projectId, memberId, roleId) => {
      await send('PUT', '/api/project-roles', undefined, { projectId, memberId, roleId })
      poke()
    },
  }

  const projectMembers: ProjectMemberRepository = {
    liveAll: () =>
      live(async () =>
        asItems<ProjectMember>(
          await send<{ items: ProjectMember[] }>('GET', '/api/project-members'),
        ),
      ),
    setMembers: async (projectId, memberIds) => {
      await send('PUT', '/api/project-members', undefined, { projectId, memberIds })
      poke()
    },
  }

  const comments: CommentRepository = {
    liveByIssue: (issueId) =>
      live(async () =>
        asItems<Comment>(
          await send<{ items: Comment[] }>('GET', '/api/comments', buildQuery({ issueId })),
        ),
      ),
    add: async (input: CreateCommentInput) => {
      await send('POST', '/api/comments', undefined, input)
      poke()
    },
    update: async (id, body) => {
      await send('PATCH', `/api/comments/${encodeURIComponent(id)}`, undefined, { body })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/comments/${encodeURIComponent(id)}`)
      poke()
    },
  }

  const activities: ActivityRepository = {
    log: async (entry: ActivityInput) => {
      await send('POST', '/api/activities', undefined, entry)
      poke()
    },
    liveByIssue: (issueId) =>
      live(async () =>
        asItems<Activity>(
          await send<{ items: Activity[] }>('GET', '/api/activities', buildQuery({ issueId })),
        ),
      ),
    liveRecent: (limit) =>
      live(async () =>
        asItems<Activity>(
          await send<{ items: Activity[] }>(
            'GET',
            '/api/activities',
            buildQuery({ recent: limit }),
          ),
        ),
      ),
  }

  const savedViews: SavedViewRepository = {
    liveAll: () =>
      live(async () =>
        asItems<SavedView>(await send<{ items: SavedView[] }>('GET', '/api/saved-views')),
      ),
    create: async (name, filters, ownerId) => {
      await send('POST', '/api/saved-views', undefined, { name, filters, ownerId })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/saved-views/${encodeURIComponent(id)}`)
      poke()
    },
  }

  const cycles: CycleRepository = {
    all: async (projectId) =>
      asItems<Cycle>(
        await send<{ items: Cycle[] }>('GET', '/api/cycles', buildQuery({ projectId })),
      ),
    liveAll: (projectId) =>
      live(async () =>
        asItems<Cycle>(
          await send<{ items: Cycle[] }>('GET', '/api/cycles', buildQuery({ projectId })),
        ),
      ),
    create: async (input: CreateCycleInput) => {
      const body = await send<{ cycle: Cycle }>('POST', '/api/cycles', undefined, input)
      poke()
      return body.cycle
    },
    update: async (id, changes) => {
      await send('PATCH', `/api/cycles/${encodeURIComponent(id)}`, undefined, { changes })
      poke()
    },
    delete: async (id) => {
      await send('DELETE', `/api/cycles/${encodeURIComponent(id)}`)
      poke()
    },
  }

  /** 通知列表由 Bearer 身份决定，memberId 不参与请求（仅作为调用方的重订阅键）。
   *  未读数从同一份最近 50 条派生：API 契约没有单独的计数端点 */
  const notifications: NotificationRepository = {
    liveFor: (_memberId, limit = NOTIFICATION_LIMIT) =>
      live(async () =>
        asItems<Notification>(
          await send<{ items: Notification[] }>('GET', '/api/notifications', buildQuery({ limit })),
        ),
      ),
    unreadCount: (_memberId) =>
      live(async () => {
        const body = await send<{ count: number }>('GET', '/api/notifications/unread-count')
        return body.count
      }),
    markRead: async (id) => {
      await send('POST', `/api/notifications/${encodeURIComponent(id)}/read`)
      poke()
    },
    markAllRead: async (_memberId) => {
      await send('POST', '/api/notifications/read-all')
      poke()
    },
  }

  const readSetting = async (key: string): Promise<unknown> => {
    const res = await send<{ found: boolean; value: unknown }>(
      'GET',
      `/api/settings/${encodeURIComponent(key)}`,
    )
    return res.found ? res.value : undefined
  }

  const settings: SettingsRepository = {
    get: async <T>(key: string) => (await readSetting(key)) as T | undefined,
    set: async (key, value) => {
      await send('PUT', `/api/settings/${encodeURIComponent(key)}`, undefined, { value })
      poke()
    },
    live: <T>(key: string) => live(async () => (await readSetting(key)) as T | undefined),
  }

  const admin: AdminRepository = {
    liveGlobalStats: () => live(() => send<GlobalStats>('GET', '/api/admin/stats')),
    liveMemberWorkload: () =>
      live(async () =>
        asItems<MemberWorkload>(
          await send<{ items: MemberWorkload[] }>('GET', '/api/admin/workload'),
        ),
      ),
    liveProjectHealth: () =>
      live(async () =>
        asItems<ProjectHealth>(await send<{ items: ProjectHealth[] }>('GET', '/api/admin/health')),
      ),
    exportAll: async () => JSON.stringify(await send('GET', '/api/admin/export')),
    importAll: async (json) => {
      await send('POST', '/api/admin/import', undefined, { json })
      poke()
    },
    resetDemo: async () => {
      await send('POST', '/api/admin/reset')
      poke()
    },
    wipeAll: async (keepMemberId?: string) => {
      await send('POST', '/api/admin/wipe', undefined, { keepMemberId })
      poke()
    },
  }

  return {
    issues,
    projects,
    members,
    roles,
    audit,
    projectRoles,
    projectMembers,
    comments,
    activities,
    savedViews,
    cycles,
    settings,
    notifications,
    admin,
  }
}

function createRevisionPoller(
  call: ApiTransport,
  intervalMs: number,
): {
  read: () => Promise<number>
  add: (listener: (revision: number) => void) => () => void
  poke: () => void
} {
  const listeners = new Set<(revision: number) => void>()
  let timer: ReturnType<typeof setInterval> | null = null
  let ticking = false

  const read = async (): Promise<number> => {
    const res = await call('GET', '/api/revision', new URLSearchParams())
    if (res.status >= 400) {
      throw new ApiError(
        res.status,
        errorMessage(res.body) ?? `request failed: ${res.status} GET /api/revision`,
      )
    }
    return (res.body as { revision: number }).revision
  }

  const tick = async (): Promise<void> => {
    if (ticking) return
    ticking = true
    try {
      const revision = await read()
      if (revision !== last) {
        last = revision
        for (const listener of listeners) listener(revision)
      }
    } catch {
      // 轮询是最终一致通道：单次失败不终止订阅，下一拍重试
    } finally {
      ticking = false
    }
  }

  let last = -1

  return {
    read,
    add(listener) {
      listeners.add(listener)
      if (!timer) timer = setInterval(() => void tick(), intervalMs)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer) {
          clearInterval(timer)
          timer = null
        }
      }
    },
    poke() {
      void tick()
    },
  }
}
