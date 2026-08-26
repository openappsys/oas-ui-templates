import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { progress } from './progress'

function root(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.oas-progress')
}
function bar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.oas-progress-bar')
}

describe('progress', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('start() 在 body 追加全局覆盖层（无文本、aria-hidden、透明态）', () => {
    progress.start()
    expect(root()).not.toBeNull()
    expect(bar()).not.toBeNull()
    expect(root()?.textContent).toBe('')
    expect(root()?.getAttribute('aria-hidden')).toBe('true')
    expect(root()?.classList.contains('is-active')).toBe(true)
  })

  it('start() 重复调用不重复创建元素', () => {
    progress.start()
    progress.start()
    expect(document.querySelectorAll('.oas-progress').length).toBe(1)
  })

  it('start() 以 8% 起步', () => {
    progress.start()
    expect(bar()?.style.width).toBe('8%')
  })

  it('异步期间不断递进', () => {
    vi.useFakeTimers()
    progress.start()
    const startWidth = Number.parseFloat(bar()?.style.width ?? '0')
    vi.advanceTimersByTime(240 * 4)
    const grown = Number.parseFloat(bar()?.style.width ?? '0')
    expect(grown).toBeGreaterThan(startWidth)
    expect(grown).toBeLessThanOrEqual(90)
  })

  it('done() 补满 100% 并进入非活动态', () => {
    progress.start()
    progress.done()
    expect(bar()?.style.width).toBe('100%')
    expect(root()?.classList.contains('is-active')).toBe(false)
  })

  it('done() 在未 start 时无副作用', () => {
    progress.done()
    expect(root()).toBeNull()
  })

  it('done() 后再次 start() 从头起步且不产生第二个元素', () => {
    progress.start()
    progress.done()
    progress.start()
    expect(document.querySelectorAll('.oas-progress').length).toBe(1)
    expect(bar()?.style.width).toBe('8%')
    expect(root()?.classList.contains('is-active')).toBe(true)
  })

  it('元素被外部移除后 start() 自动重建', () => {
    progress.start()
    document.body.innerHTML = ''
    expect(root()).toBeNull()
    progress.start()
    expect(root()).not.toBeNull()
    expect(bar()?.style.width).toBe('8%')
  })
})
