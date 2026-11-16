import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { approach, createLiquidRing } from './liquid-ring'

// happy-dom 无真实 rAF 时序与 canvas 布局：requestAnimationFrame 换成可控队列，
// 手动 pump 驱动帧；cancelAnimationFrame 记录调用作为 dispose 证据。
// getContext 在 happy-dom 返回 null，draw() 内部已守卫（仅跳过绘制，不影响 DOM/文本逻辑）。
let rafQueue: FrameRequestCallback[] = []
let nextRafId = 0
const cancelSpy = vi.fn<(id: number) => void>()

function pump(frames: number): void {
  for (let i = 0; i < frames; i++) {
    const batch = rafQueue
    rafQueue = []
    for (const cb of batch) cb(performance.now())
  }
}

describe('approach', () => {
  it('低于 target：按步长向 target 逼近', () => {
    expect(approach(10, 50, 1)).toBe(11)
    expect(approach(10, 50, 5)).toBe(15)
  })
  it('高于 target：按步长回落', () => {
    expect(approach(50, 10, 1)).toBe(49)
    expect(approach(50, 10, 5)).toBe(45)
  })
  it('到达即停：距离不足步长时直接落在 target，不越过', () => {
    expect(approach(49.5, 50, 1)).toBe(50)
    expect(approach(10.5, 10, 1)).toBe(10)
    expect(approach(50, 50, 1)).toBe(50)
  })
})

describe('createLiquidRing', () => {
  beforeEach(() => {
    rafQueue = []
    nextRafId = 0
    cancelSpy.mockReset()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      rafQueue.push(cb)
      return ++nextRafId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      cancelSpy(id)
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('返回 el 含 canvas，中央文本含 label 与初值', () => {
    const ring = createLiquidRing({ value: 45, label: '转化率' })
    expect(ring.el.classList.contains('liquid-ring')).toBe(true)
    expect(ring.el.querySelector('canvas')).not.toBeNull()
    const text = ring.el.querySelector<HTMLElement>('.liquid-ring-text')
    expect(text?.textContent).toContain('转化率')
    expect(text?.textContent).toContain('45.0')
    ring.dispose()
  })

  it('size 控制容器与 canvas 的像素尺寸（style = size，canvas = size×DPR）', () => {
    const ring = createLiquidRing({ value: 10, label: 'x', size: 100 })
    expect(ring.el.style.width).toBe('100px')
    const canvas = ring.el.querySelector<HTMLCanvasElement>('canvas')!
    expect(canvas.style.width).toBe('100px')
    expect(canvas.width).toBe(100 * window.devicePixelRatio)
    ring.dispose()
  })

  it('setValue 后当前值每帧向目标逼近 1%，文本随之更新', () => {
    const ring = createLiquidRing({ value: 40, label: '转化率' })
    const valueEl = () => ring.el.querySelector<HTMLElement>('.liquid-ring-value')
    ring.setValue(50)
    pump(5)
    expect(valueEl()?.textContent).toBe('45.0%')
    pump(10)
    expect(valueEl()?.textContent).toBe('50.0%')
    // 到达后不再越过 target
    pump(5)
    expect(valueEl()?.textContent).toBe('50.0%')
    ring.dispose()
  })

  it('dispose 后 cancelAnimationFrame 被调用且 rAF 不再回调', () => {
    const ring = createLiquidRing({ value: 40, label: '转化率' })
    ring.setValue(60)
    pump(3)
    expect(cancelSpy).not.toHaveBeenCalled()
    ring.dispose()
    expect(cancelSpy).toHaveBeenCalled()
    const snapshot = ring.el.querySelector<HTMLElement>('.liquid-ring-value')?.textContent
    const queueLen = rafQueue.length
    pump(10)
    // 停止标记生效：帧队列被清空且文本不再变化
    expect(rafQueue).toHaveLength(0)
    expect(ring.el.querySelector<HTMLElement>('.liquid-ring-value')?.textContent).toBe(snapshot)
    expect(queueLen).toBeGreaterThanOrEqual(0)
  })
})
