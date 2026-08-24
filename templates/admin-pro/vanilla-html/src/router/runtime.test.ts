import { beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../store/session'
import { initRouter, resolve } from './router'

const {
  loginDispose,
  loginRender,
  dashDispose,
  dashRender,
  profileDispose,
  profileRender,
  usersDispose,
  usersRender,
} = vi.hoisted(() => {
  const loginDispose = vi.fn()
  const loginRender = vi.fn((_el: HTMLElement) => loginDispose)
  const dashDispose = vi.fn()
  const dashRender = vi.fn((_el: HTMLElement) => dashDispose)
  const profileDispose = vi.fn()
  const profileRender = vi.fn((_el: HTMLElement) => profileDispose)
  const usersDispose = vi.fn()
  const usersRender = vi.fn((_el: HTMLElement) => usersDispose)
  return {
    loginDispose,
    loginRender,
    dashDispose,
    dashRender,
    profileDispose,
    profileRender,
    usersDispose,
    usersRender,
  }
})

vi.mock('../pages/login', () => ({ render: (el: HTMLElement) => loginRender(el) }))
vi.mock('../pages/dashboard', () => ({ render: (el: HTMLElement) => dashRender(el) }))
vi.mock('../pages/profile', () => ({ render: (el: HTMLElement) => profileRender(el) }))
vi.mock('../pages/users', () => ({ render: (el: HTMLElement) => usersRender(el) }))

const el = document.createElement('main')

describe('router runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loginRender.mockImplementation((_el: HTMLElement) => loginDispose)
    dashRender.mockImplementation((_el: HTMLElement) => dashDispose)
    profileRender.mockImplementation((_el: HTMLElement) => profileDispose)
    usersRender.mockImplementation((_el: HTMLElement) => usersDispose)
    document.body.innerHTML = ''
    document.body.appendChild(el)
    el.innerHTML = ''
    session.logout()
    session.login('张伟', 'admin')
  })

  it('渲染路由并设置标题', async () => {
    initRouter(el)
    await vi.waitFor(() => expect(dashRender).toHaveBeenCalledWith(el))
    expect(document.title).toContain('仪表盘')
    expect(dashDispose).not.toHaveBeenCalled()
  })

  it('导航时旧页 dispose 被调用、新页 dispose 未调用', async () => {
    location.hash = '#/profile'
    await vi.waitFor(() => expect(profileRender).toHaveBeenCalledWith(el))
    expect(dashDispose).toHaveBeenCalledTimes(1)
    expect(profileDispose).not.toHaveBeenCalled()
    expect(document.title).toContain('个人中心')
  })

  it('重叠 resolve 以最后请求为准，陈旧渲染不覆盖', async () => {
    location.hash = '#/dashboard'
    await vi.waitFor(() => expect(dashRender).toHaveBeenCalledTimes(1))
    const dashCalls = dashRender.mock.calls.length
    const p1 = resolve()
    location.hash = '#/profile'
    const p2 = resolve()
    await Promise.all([p1, p2])
    expect(dashRender.mock.calls.length).toBe(dashCalls)
    expect(profileRender).toHaveBeenCalledWith(el)
    expect(profileDispose).toHaveBeenCalledTimes(1)
    expect(document.title).toContain('个人中心')
    await vi.waitFor(() => expect(profileRender).toHaveBeenCalledTimes(2))
    expect(dashRender.mock.calls.length).toBe(dashCalls)
    expect(document.title).toContain('个人中心')
  })

  it('渲染抛错时经 runResolve 兜底显示 500', async () => {
    usersRender.mockImplementation(() => {
      throw new Error('render boom')
    })
    location.hash = '#/users'
    await vi.waitFor(() => expect(el.textContent).toContain('页面加载失败'))
    expect(el.textContent).toContain('500')
  })
})
