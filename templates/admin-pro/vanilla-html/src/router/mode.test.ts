import { beforeEach, describe, expect, it } from 'vitest'
import { screenUrl } from './mode'

describe('screenUrl（数据大屏独立入口 URL）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hash 模式（默认）：文档 URL 恒停 base 根，返回相对 ./screen.html', () => {
    expect(screenUrl()).toBe('./screen.html')
  })

  it('history 模式：文档 URL 可能在二级路由，返回绝对 /screen.html（根部署）', () => {
    localStorage.setItem('oas-admin.router-mode', 'history')
    expect(screenUrl()).toBe('/screen.html')
  })
})
