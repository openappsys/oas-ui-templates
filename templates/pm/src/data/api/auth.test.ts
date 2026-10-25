import { describe, expect, it } from 'vitest'
import type { Issue, Member } from '@/types'
import { createApiRepositories, type ApiAuthOptions, type ApiTransport } from './client'
import { ApiError } from './errors'
import { createMockStore, handleApi, type ApiRequest, type MockStore } from './mock-server'

const FIXED = 1_700_000_000_000
const ADMIN_EMAIL = 'user1@oas.dev'
const MEMBER_EMAIL = 'user2@oas.dev'
const VIEWER_EMAIL = 'user4@oas.dev'
const PASSWORD = 'oas'

const send = (
  store: MockStore,
  method: string,
  path: string,
  init: { body?: unknown; bearer?: string | null; query?: Record<string, string> } = {},
) =>
  handleApi(store, {
    method,
    path,
    query: new URLSearchParams(init.query ?? {}),
    body: init.body,
    authorization: init.bearer === undefined ? null : `Bearer ${init.bearer}`,
  } satisfies ApiRequest)

const login = (store: MockStore, email: string, password = PASSWORD) =>
  send(store, 'POST', '/api/auth/login', { body: { email, password } })

const tokenOf = (store: MockStore, email: string): string =>
  (login(store, email).body as { token: string }).token

const errOf = (res: { body: unknown }) => (res.body as { error: string }).error

describe('mock 认证：login / me / logout', () => {
  it('登录签发不透明 token 并回带成员；大小写不同的邮箱视为同一账号', () => {
    const store = createMockStore({ now: FIXED })
    const res = login(store, ADMIN_EMAIL.toUpperCase())
    expect(res.status).toBe(200)
    const body = res.body as { token: string; member: Member }
    expect(body.token.startsWith('mock-')).toBe(true)
    expect(body.member.id).toBe('member-1')
    expect(body.member.role).toBe('admin')
    // 不透明：token 不含成员 id
    expect(body.token).not.toContain('member-1')
    expect(store.sessions.get(body.token)?.id).toBe('member-1')
  })

  it('错误口令 / 未知邮箱都是 401，且文案一致（不暴露账号是否存在）', () => {
    const store = createMockStore({ now: FIXED })
    const wrongPassword = login(store, ADMIN_EMAIL, 'nope')
    const unknownEmail = login(store, 'ghost@oas.dev')
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(errOf(wrongPassword)).toBe(errOf(unknownEmail))
  })

  it('缺字段是 400；非 POST 是 405', () => {
    const store = createMockStore({ now: FIXED })
    expect(send(store, 'POST', '/api/auth/login', { body: { email: ADMIN_EMAIL } }).status).toBe(
      400,
    )
    expect(send(store, 'GET', '/api/auth/login').status).toBe(405)
  })

  it('me 需要有效 Bearer：缺失/伪造/登出后都是 401，有效时回成员', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, MEMBER_EMAIL)
    expect(send(store, 'GET', '/api/auth/me').status).toBe(401)
    expect(send(store, 'GET', '/api/auth/me', { bearer: 'mock-forged' }).status).toBe(401)
    const me = send(store, 'GET', '/api/auth/me', { bearer: token })
    expect(me.status).toBe(200)
    expect((me.body as { member: Member }).member.id).toBe('member-2')

    expect(send(store, 'POST', '/api/auth/logout', { bearer: token }).status).toBe(204)
    expect(send(store, 'GET', '/api/auth/me', { bearer: token }).status).toBe(401)
  })

  it('登出幂等：无 token / 已失效 token 也回 204', () => {
    const store = createMockStore({ now: FIXED })
    expect(send(store, 'POST', '/api/auth/logout').status).toBe(204)
    expect(send(store, 'POST', '/api/auth/logout', { bearer: 'mock-gone' }).status).toBe(204)
  })

  it('成员被删后会话仍有效：身份随会话存活，角色取登录快照', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, VIEWER_EMAIL)
    store.members = store.members.filter((m) => m.id !== 'member-4')
    const me = send(store, 'GET', '/api/auth/me', { bearer: token })
    expect(me.status).toBe(200)
    expect((me.body as { member: Member }).member.id).toBe('member-4')
  })

  it('wipe 清表后 admin 会话仍可发 reset（不会把演示锁死）', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, ADMIN_EMAIL)
    expect(send(store, 'POST', '/api/admin/wipe', { bearer: token }).status).toBe(200)
    expect(store.members).toHaveLength(0)
    expect(send(store, 'POST', '/api/admin/reset', { bearer: token }).status).toBe(200)
    expect(store.members).toHaveLength(8)
  })

  it('登录端点之外的所有端点都要求 Bearer（含 revision 轮询）', () => {
    const store = createMockStore({ now: FIXED })
    expect(send(store, 'GET', '/api/revision').status).toBe(401)
    expect(send(store, 'GET', '/api/issues', { query: { projectId: 'project-1' } }).status).toBe(
      401,
    )
    const token = tokenOf(store, MEMBER_EMAIL)
    expect(send(store, 'GET', '/api/revision', { bearer: token }).status).toBe(200)
  })
})

describe('服务端权限：admin 专属端点 403', () => {
  const cases: Array<[string, string, string, unknown]> = [
    ['POST', '/api/projects', 'project-1', { id: 'p-new', name: 'x', key: 'X' }],
    ['PATCH', '/api/projects/project-1', 'project-1', { changes: { name: 'y' } }],
    ['DELETE', '/api/projects/project-1', 'project-1', undefined],
    ['POST', '/api/members', 'member-1', { id: 'm-new', name: 'x', email: 'x@oas.dev' }],
    ['PATCH', '/api/members/member-2', 'member-2', { changes: { role: 'viewer' } }],
    ['DELETE', '/api/members/member-4', 'member-4', undefined],
    ['PUT', '/api/settings/labels', 'labels', { value: ['a'] }],
    ['POST', '/api/admin/reset', 'reset', undefined],
    ['POST', '/api/admin/wipe', 'wipe', undefined],
    ['GET', '/api/admin/stats', 'stats', undefined],
  ]

  it('非 admin 一律 403，且不改数据', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, MEMBER_EMAIL)
    for (const [method, path, , body] of cases) {
      const res = send(store, method, path, { body, bearer: token })
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 403 })
    }
    expect(store.projects).toHaveLength(3)
    expect(store.members).toHaveLength(8)
    expect(store.revision).toBe(0)
  })

  it('admin 同一批端点放行', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, ADMIN_EMAIL)
    expect(send(store, 'GET', '/api/admin/stats', { bearer: token }).status).toBe(200)
    expect(
      send(store, 'PUT', '/api/settings/labels', { body: { value: ['a'] }, bearer: token }).status,
    ).toBe(200)
    expect(
      send(store, 'PATCH', '/api/members/member-4', {
        body: { changes: { role: 'member' } },
        bearer: token,
      }).status,
    ).toBe(200)
  })

  it('普通 issue 写也走权限：viewer 改标题 403 且不落库', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, VIEWER_EMAIL)
    const target = store.issues[0]
    expect(
      send(store, 'PATCH', `/api/issues/${target.id}`, {
        body: { changes: { title: 'viewer edit' } },
        bearer: token,
      }).status,
    ).toBe(403)
    expect((store.issues[0] as Issue).title).toBe(target.title)
  })
})

describe('API 客户端会话：token 注入与 401/403 反馈', () => {
  const makeClient = (store: MockStore, over: ApiAuthOptions = {}) => {
    const expired: string[] = []
    const forbidden: string[] = []
    const auth: ApiAuthOptions = {
      token: () => null,
      clearToken: () => undefined,
      events: {
        expired: () => expired.push('expired'),
        forbidden: (message) => forbidden.push(message),
      },
      ...over,
    }
    const transport: ApiTransport = async (method, path, query, body) => {
      const token = auth.token?.() ?? null
      return handleApi(store, {
        method,
        path,
        query,
        body,
        authorization: token ? `Bearer ${token}` : null,
      })
    }
    return { api: createApiRepositories({ transport, pollMs: 10, auth }), expired, forbidden }
  }

  it('每个请求都带 Bearer；token 缺失时请求被拒（401）且不重复判定失效', async () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, ADMIN_EMAIL)
    const { api, expired } = makeClient(store, { token: () => token })
    expect((await api.issues.listAll(3)).length).toBe(3)

    const anonymous = makeClient(store)
    const err = await anonymous.api.issues.listAll(3).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
    // 无 token 的 401 不清会话（登录页后台订阅不该把人踢出登录页）
    expect(anonymous.expired).toEqual([])

    // 携带 token 的 401 → 清 token + 派发失效（只一次）
    const cleared: string[] = []
    const stale = makeClient(store, {
      token: () => 'mock-stale',
      clearToken: () => cleared.push('cleared'),
    })
    const staleErr = await stale.api.issues.listAll(3).catch((e: unknown) => e)
    expect((staleErr as ApiError).status).toBe(401)
    expect(cleared).toEqual(['cleared'])
    expect(stale.expired).toEqual(['expired'])
    expect(expired).toEqual([])
  })

  it('403 → ApiError(403) + forbidden 反馈（非 admin 写项目）', async () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, MEMBER_EMAIL)
    const { api, forbidden, expired } = makeClient(store, { token: () => token })
    const project = store.projects[0]
    const err = await api.projects.update(project.id, { name: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(403)
    expect(forbidden).toHaveLength(1)
    expect(expired).toEqual([])
  })

  it('401 后轮询失败不崩：订阅首次失败走 error 回调', async () => {
    const store = createMockStore({ now: FIXED })
    const { api } = makeClient(store)
    const err = await new Promise<unknown>((resolve) => {
      api.issues
        .liveWindow(
          {
            projectId: 'project-1',
            statusFilter: [],
            assigneeFilter: [],
            priorityFilter: [],
            search: '',
            myOnly: false,
            cycleFilter: null,
            sortBy: 'updatedAt',
          },
          'member-1',
        )
        .subscribe({
          next: () => undefined,
          error: (e) => resolve(e),
        })
    })
    expect((err as ApiError).status).toBe(401)
  })
})

describe('自助资料与身份边界', () => {
  it('成员可改自己的白名单字段，不能改邮箱/角色', () => {
    const store = createMockStore({ now: FIXED })
    const token = tokenOf(store, MEMBER_EMAIL)
    const me = store.members.find((m) => m.email === MEMBER_EMAIL) as Member
    const ok = send(store, 'PATCH', `/api/members/${me.id}`, {
      body: { changes: { name: 'New Name', title: 'Engineer' } },
      bearer: token,
    })
    expect(ok.status).toBe(200)
    expect(store.members.find((m) => m.id === me.id)?.name).toBe('New Name')

    const mode = send(store, 'PATCH', `/api/members/${me.id}`, {
      body: { changes: { commentMode: 'nested' } },
      bearer: token,
    })
    expect(mode.status).toBe(200)
    expect(store.members.find((m) => m.id === me.id)?.commentMode).toBe('nested')

    const badMode = send(store, 'PATCH', `/api/members/${me.id}`, {
      body: { changes: { commentMode: 'bogus' } },
      bearer: token,
    })
    expect(badMode.status).toBe(400)

    const bad = send(store, 'PATCH', `/api/members/${me.id}`, {
      body: { changes: { role: 'admin' } },
      bearer: token,
    })
    expect(bad.status).toBe(403)
    expect(store.members.find((m) => m.id === me.id)?.role).toBe(me.role)
  })

  it('删除成员会撤销其会话 token', () => {
    const store = createMockStore({ now: FIXED })
    const admin = tokenOf(store, ADMIN_EMAIL)
    const victim = tokenOf(store, MEMBER_EMAIL)
    const target = store.members.find((m) => m.email === MEMBER_EMAIL) as Member
    expect(send(store, 'DELETE', `/api/members/${target.id}`, { bearer: admin }).status).toBe(200)
    expect(send(store, 'GET', '/api/auth/me', { bearer: victim }).status).toBe(401)
  })
})
