import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from './routes'
import { session } from '../store/session'
import { resetUsers } from '../data/users'
import { resetOrders } from '../data/orders'
import { resetProducts } from '../data/products'
import { resetCategories } from '../data/categories'
import { resetNotifications } from '../data/notifications'
import { resetSystem } from '../data/system'

function el(): HTMLElement {
  const n = document.createElement('main')
  document.body.appendChild(n)
  return n
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetUsers()
  resetOrders()
  resetProducts()
  resetCategories()
  resetNotifications()
  resetSystem()
  document.body.innerHTML = ''
})

describe('页面渲染冒烟：所有路由 render 不抛错', () => {
  const visible = routes.filter((r) => !r.meta.hidden)

  it('每一个可见路由页面模块可动态加载并 render 返回 dispose', async () => {
    session.login('张伟', 'admin')
    for (const route of visible) {
      const mod = await route.load()
      const target = el()
      let dispose: (() => void) | undefined
      let err: unknown
      try {
        dispose = mod.render(target)
      } catch (e) {
        err = e
      }
      expect(err, `render 抛错: ${route.path}`).toBeUndefined()
      expect(typeof dispose, `dispose 非函数: ${route.path}`).toBe('function')
      dispose?.()
    }
  })

  it('受保护路由（无登录）渲染 login 不抛错', async () => {
    session.logout()
    const route = routes.find((r) => r.path === '/dashboard')!
    const mod = await route.load()
    const target = el()
    const dispose = mod.render(target)
    expect(typeof dispose).toBe('function')
    dispose?.()
  })
})
