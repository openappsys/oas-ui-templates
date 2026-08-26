import { describe, expect, it } from 'vitest'
import { HOME_PATH, closeAll, closeKeys, closeTab, tabKeyOf, visit } from './tabs'
import type { TabsView } from './tabs'
import { matchRoute } from './routes'

const home = HOME_PATH

function view(keys: string[], active: string | null): TabsView {
  return { keys, active }
}

describe('tabKeyOf', () => {
  it('可见路由返回自身 path', () => {
    expect(tabKeyOf(matchRoute('/users'), null)).toBe('/users')
    expect(tabKeyOf(matchRoute('/dashboard'), null)).toBe(home)
  })

  it('隐藏路由归属 parent 路径', () => {
    expect(tabKeyOf(matchRoute('/order-detail'), null)).toBe('/orders')
    expect(tabKeyOf(matchRoute('/result'), null)).toBe('/form')
    expect(tabKeyOf(matchRoute('/products/edit'), null)).toBe('/products')
  })

  it('错误页沿用当前页签，不新增独立页签', () => {
    expect(tabKeyOf(matchRoute('/forbidden'), '/users')).toBe('/users')
    expect(tabKeyOf(matchRoute('/not-found'), '/users')).toBe('/users')
    expect(tabKeyOf(matchRoute('/500'), '/users')).toBe('/users')
  })

  it('未知路由沿用当前页签', () => {
    expect(tabKeyOf(undefined, '/orders')).toBe('/orders')
  })
})

describe('visit', () => {
  it('首访仪表盘固定为第一页签', () => {
    expect(visit(view([], null), '/dashboard')).toEqual(view([home], home))
  })

  it('访问其他页面时自动补入仪表盘页签', () => {
    expect(visit(view([], null), '/orders')).toEqual(view([home, '/orders'], '/orders'))
  })

  it('按 path 去重，重复访问不新增页签', () => {
    const prev = view([home, '/orders', '/users'], '/users')
    expect(visit(prev, '/orders')).toEqual(view([home, '/orders', '/users'], '/orders'))
  })

  it('隐藏路由切换不新增页签且高亮父级', () => {
    const prev = view([home, '/orders'], '/orders')
    expect(visit(prev, '/order-detail')).toEqual(view([home, '/orders'], '/orders'))
  })

  it('直达隐藏路由自动创建父级页签', () => {
    expect(visit(view([], null), '/order-detail')).toEqual(view([home, '/orders'], '/orders'))
  })

  it('错误页不新增页签，保持当前高亮', () => {
    const prev = view([home, '/orders'], '/orders')
    expect(visit(prev, '/forbidden')).toEqual(view([home, '/orders'], '/orders'))
  })

  it('直达错误页兜底高亮仪表盘', () => {
    expect(visit(view([], null), '/forbidden')).toEqual(view([home], home))
  })
})

describe('closeTab', () => {
  it('关闭当前中间页签切到右邻', () => {
    const prev = view([home, '/orders', '/users'], '/orders')
    expect(closeTab(prev, '/orders')).toEqual({
      view: view([home, '/users'], '/users'),
      navigateTo: '/users',
    })
  })

  it('关闭当前末位页签切到左邻', () => {
    const prev = view([home, '/orders', '/users'], '/users')
    expect(closeTab(prev, '/users')).toEqual({
      view: view([home, '/orders'], '/orders'),
      navigateTo: '/orders',
    })
  })

  it('关闭非当前页签不导航', () => {
    const prev = view([home, '/orders', '/users'], '/users')
    expect(closeTab(prev, '/orders')).toEqual({
      view: view([home, '/users'], '/users'),
      navigateTo: null,
    })
  })

  it('仪表盘固定不可关闭', () => {
    const prev = view([home, '/orders'], '/orders')
    expect(closeTab(prev, home)).toEqual({ view: prev, navigateTo: null })
  })

  it('关闭未知页签为无操作', () => {
    const prev = view([home, '/orders'], '/orders')
    expect(closeTab(prev, '/nope')).toEqual({ view: prev, navigateTo: null })
  })
})

describe('closeAll', () => {
  it('清空非仪表盘页签并回到首页', () => {
    const prev = view([home, '/orders', '/users'], '/users')
    expect(closeAll(prev)).toEqual({ view: view([home], home), navigateTo: home })
  })

  it('已在首页时无导航', () => {
    const prev = view([home, '/orders'], home)
    expect(closeAll(prev)).toEqual({ view: view([home], home), navigateTo: null })
  })
})

describe('closeKeys', () => {
  it('空集合为无操作', () => {
    const prev = view([home, '/orders'], '/orders')
    expect(closeKeys(prev, [])).toEqual({ view: prev, navigateTo: null })
  })

  it('只含首页时为无操作（首页不可关）', () => {
    const prev = view([home, '/orders'], '/orders')
    expect(closeKeys(prev, [home])).toEqual({ view: prev, navigateTo: null })
  })

  it('关闭非当前多个页签不导航', () => {
    const prev = view([home, '/orders', '/users', '/profile'], '/users')
    expect(closeKeys(prev, ['/orders', '/profile'])).toEqual({
      view: view([home, '/users'], '/users'),
      navigateTo: null,
    })
  })

  it('关闭含当前页签的多项，导航到存活项', () => {
    const prev = view([home, '/orders', '/users', '/profile'], '/users')
    expect(closeKeys(prev, ['/orders', '/users'])).toEqual({
      view: view([home, '/profile'], '/profile'),
      navigateTo: '/profile',
    })
  })

  it('关闭所有非首页页签回到首页', () => {
    const prev = view([home, '/orders', '/users'], '/users')
    expect(closeKeys(prev, ['/orders', '/users'])).toEqual({
      view: view([home], home),
      navigateTo: home,
    })
  })
})
