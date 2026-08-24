import { beforeEach, describe, expect, it } from 'vitest'
import { session } from '../store/session'
import { guard, matchRoute, parseHash } from './router'
import { routes } from './routes'

describe('parseHash', () => {
  it('空 hash 回落首个路由', () => {
    expect(parseHash('')).toBe(routes[0].path)
    expect(parseHash('#')).toBe(routes[0].path)
  })

  it('正常解析 # 前缀', () => {
    expect(parseHash('#/users')).toBe('/users')
    expect(parseHash('#/dashboard')).toBe('/dashboard')
  })
})

describe('matchRoute', () => {
  it('命中已注册路由', () => {
    expect(matchRoute('/users')?.path).toBe('/users')
  })

  it('未注册返回 undefined', () => {
    expect(matchRoute('/nope')).toBeUndefined()
  })
})

describe('guard', () => {
  beforeEach(() => session.logout())

  it('未登录 → login', () => {
    expect(guard('/dashboard')).toEqual({ ok: false, reason: 'login' })
  })

  it('已登录未知路径 → not-found', () => {
    session.login('张伟', 'admin')
    expect(guard('/nope')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('viewer 访问受限页 → forbidden', () => {
    session.login('李四', 'viewer')
    expect(guard('/users')).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('admin 访问受限页 / 任意角色访问开放页 → ok', () => {
    session.login('张伟', 'admin')
    expect(guard('/users')).toEqual({ ok: true, path: '/users' })
    session.login('李四', 'viewer')
    expect(guard('/dashboard')).toEqual({ ok: true, path: '/dashboard' })
  })
})
