import { beforeEach, describe, expect, it } from 'vitest'
import { hasAccess, session } from './session'

describe('session', () => {
  beforeEach(() => session.logout())

  it('未登录 user 为 null', () => {
    expect(session.user).toBeNull()
  })

  it('login 写入 user 并持久化到 localStorage', () => {
    session.login('张伟', 'admin')
    expect(session.user).toEqual({ name: '张伟', role: 'admin' })
    expect(JSON.parse(localStorage.getItem('oas-admin.session')!)).toEqual({
      name: '张伟',
      role: 'admin',
    })
  })

  it('logout 清空 user 与 localStorage', () => {
    session.login('张伟', 'admin')
    session.logout()
    expect(session.user).toBeNull()
    expect(localStorage.getItem('oas-admin.session')).toBeNull()
  })

  it('subscribe 在 login/logout 时收到通知，取消订阅后不再收到', () => {
    const calls: number[] = []
    const off = session.subscribe(() => calls.push(1))
    session.login('李四', 'viewer')
    session.logout()
    off()
    session.login('王五', 'admin')
    expect(calls.length).toBe(2)
  })
})

describe('hasAccess', () => {
  it('未登录一律 false', () => {
    expect(hasAccess(null, undefined)).toBe(false)
    expect(hasAccess(null, ['admin'])).toBe(false)
  })

  it('无 roles 声明 = 登录即可', () => {
    expect(hasAccess({ name: 'x', role: 'viewer' }, undefined)).toBe(true)
    expect(hasAccess({ name: 'x', role: 'viewer' }, [])).toBe(true)
  })

  it('roles 声明按角色匹配', () => {
    expect(hasAccess({ name: 'x', role: 'admin' }, ['admin'])).toBe(true)
    expect(hasAccess({ name: 'x', role: 'viewer' }, ['admin'])).toBe(false)
  })
})
