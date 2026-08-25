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

describe('routes 分组约束', () => {
  it('新增系统路由 /system/roles 与 /system/menus 限定 admin', () => {
    expect(matchRoute('/system/roles')?.meta.roles).toContain('admin')
    expect(matchRoute('/system/menus')?.meta.roles).toContain('admin')
    expect(matchRoute('/system/roles')?.meta.group).toBe('系统')
    expect(matchRoute('/system/menus')?.meta.group).toBe('系统')
  })

  it('现有可见路由均分配分组', () => {
    const visible = routes.filter((r) => !r.meta.hidden)
    for (const r of visible) {
      expect(['总览', '业务', '系统']).toContain(r.meta.group)
    }
    expect(matchRoute('/dashboard')?.meta.group).toBe('总览')
    expect(matchRoute('/orders')?.meta.group).toBe('业务')
    expect(matchRoute('/profile')?.meta.group).toBe('总览')
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
    expect(guard('/system/roles')).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('admin 访问受限页 / 任意角色访问开放页 → ok', () => {
    session.login('张伟', 'admin')
    expect(guard('/users')).toEqual({ ok: true, path: '/users' })
    session.login('李四', 'viewer')
    expect(guard('/dashboard')).toEqual({ ok: true, path: '/dashboard' })
  })
})
