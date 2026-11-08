import { beforeEach, describe, expect, it } from 'vitest'
import { SIDEBAR_ACCORDION_KEY, readSidebarAccordion, setSidebarAccordion } from './layout-config'

describe('sidebar accordion 配置', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('默认手风琴开（无存储值）', () => {
    expect(readSidebarAccordion()).toBe(true)
  })

  it('存储 false 时手风琴关', () => {
    localStorage.setItem(SIDEBAR_ACCORDION_KEY, 'false')
    expect(readSidebarAccordion()).toBe(false)
  })

  it('存储 true 时手风琴开', () => {
    localStorage.setItem(SIDEBAR_ACCORDION_KEY, 'true')
    expect(readSidebarAccordion()).toBe(true)
  })

  it('setSidebarAccordion 持久化 true/false', () => {
    setSidebarAccordion(false)
    expect(localStorage.getItem(SIDEBAR_ACCORDION_KEY)).toBe('false')
    expect(readSidebarAccordion()).toBe(false)
    setSidebarAccordion(true)
    expect(localStorage.getItem(SIDEBAR_ACCORDION_KEY)).toBe('true')
    expect(readSidebarAccordion()).toBe(true)
  })

  it('非法存储值按默认（开）处理', () => {
    localStorage.setItem(SIDEBAR_ACCORDION_KEY, 'garbage')
    expect(readSidebarAccordion()).toBe(true)
  })
})
