import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTER_PLACEMENT,
  loadFilterPlacement,
  showsSidebarFilters,
  showsTopbarFilters,
  storeFilterPlacement,
} from './preferences'

/** node 环境没有 localStorage：用 Map 起一个最小实现，验证读写与非法值回落 */
function stubLocalStorage() {
  const store = new Map<string, string>()
  const impl = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  globalThis.localStorage = impl as unknown as Storage
  return store
}

describe('filter placement preference', () => {
  let store: Map<string, string>
  beforeEach(() => {
    store = stubLocalStorage()
  })
  afterEach(() => {
    store.clear()
  })

  it('缺省（旧版本无该键）为侧栏', () => {
    expect(loadFilterPlacement()).toBe(DEFAULT_FILTER_PLACEMENT)
    expect(loadFilterPlacement()).toBe('sidebar')
  })

  it('写入后读回同一值（存 localStorage 的 oas-pm-filters-placement）', () => {
    storeFilterPlacement('topbar')
    expect(store.get('oas-pm-filters-placement')).toBe('topbar')
    expect(loadFilterPlacement()).toBe('topbar')
    storeFilterPlacement('both')
    expect(loadFilterPlacement()).toBe('both')
    storeFilterPlacement('sidebar')
    expect(loadFilterPlacement()).toBe('sidebar')
  })

  it('非法值回落默认（不抛错、不把脏值透传给 UI）', () => {
    store.set('oas-pm-filters-placement', 'left-pane')
    expect(loadFilterPlacement()).toBe('sidebar')
    store.set('oas-pm-filters-placement', '')
    expect(loadFilterPlacement()).toBe('sidebar')
  })

  it('派生口径：侧栏 = 非 topbar，顶部栏 = 非 sidebar', () => {
    expect(showsSidebarFilters('sidebar')).toBe(true)
    expect(showsSidebarFilters('both')).toBe(true)
    expect(showsSidebarFilters('topbar')).toBe(false)
    expect(showsTopbarFilters('sidebar')).toBe(false)
    expect(showsTopbarFilters('both')).toBe(true)
    expect(showsTopbarFilters('topbar')).toBe(true)
  })
})
