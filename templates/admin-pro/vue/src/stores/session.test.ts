import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { session } from '../store/session'
import { useSessionStore } from './session'

describe('session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useSessionStore().logout()
  })

  it('未登录 user 为 null', () => {
    const store = useSessionStore()
    expect(store.user).toBeNull()
    expect(store.loginAt).toBeNull()
  })

  it('login 委托单例：store 状态更新且 localStorage 键名不变', () => {
    const store = useSessionStore()
    store.login('张伟', 'admin')
    expect(store.user).toEqual({ name: '张伟', role: 'admin' })
    expect(typeof store.loginAt).toBe('number')
    expect(JSON.parse(localStorage.getItem('oas-admin.session')!)).toEqual({
      name: '张伟',
      role: 'admin',
    })
    expect(Number(localStorage.getItem('oas-admin.session.loginAt'))).toBe(store.loginAt)
  })

  it('logout 清空 store 状态与 localStorage', () => {
    const store = useSessionStore()
    store.login('张伟', 'admin')
    store.logout()
    expect(store.user).toBeNull()
    expect(store.loginAt).toBeNull()
    expect(localStorage.getItem('oas-admin.session')).toBeNull()
    expect(localStorage.getItem('oas-admin.session.loginAt')).toBeNull()
  })

  it('单例外部的 login/logout 变更同步到 store（subscribe 语义保留）', () => {
    const store = useSessionStore()
    session.login('李四', 'viewer')
    expect(store.user).toEqual({ name: '李四', role: 'viewer' })
    session.logout()
    expect(store.user).toBeNull()
  })
})
