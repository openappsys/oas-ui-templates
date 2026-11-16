import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { approach, createLiquidRing } from './liquid-ring'

// happy-dom 无真实 rAF 时序与 canvas 布局：requestAnimationFrame 换成可控队列，
// 手动 pump 驱动帧；cancelAnimationFrame 记录调用作为 dispose 证据。
// getContext 在 happy-dom 返回 null，draw() 内部已守卫（仅跳过绘制，不影响 DOM/文本逻辑）。
let rafQueue: { id: number; cb: FrameRequestCallback }[] = []
const cancelled = new Set<number>()
let nextRafId = 0
const cancelSpy = vi.fn<(id: number) => void>()

// 已取消的帧不再执行（真实 cancelAnimationFrame 语义）——dispose/双调守卫
// 的证据全靠它区分「队列里还有」与「实际还会跑」
function pump(frames: number): void {
  for (let i = 0; i < frames; i++) {
    const batch = rafQueue
    rafQueue = []
    for (const { id, cb } of batch) {
      if (!cancelled.has(id)) cb(performance.now())
    }
  }
}

// 当前未被取消的待执行帧数
function liveFrames(): number {
  return rafQueue.filter(({ id }) => !cancelled.has(id)).length
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
    cancelled.clear()
    nextRafId = 0
    cancelSpy.mockReset()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = ++nextRafId
      rafQueue.push({ id, cb })
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      cancelled.add(id)
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
    pump(10)
    // 停止标记生效：待执行帧清空且文本不再变化
    expect(liveFrames()).toBe(0)
    expect(ring.el.querySelector<HTMLElement>('.liquid-ring-value')?.textContent).toBe(snapshot)
  })

  it('hidden 时创建后再 visible：双调 start 只维持一个 rAF 循环', () => {
    let hidden = true
    const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    try {
      // 创建时 document 已 hidden：初始 start() 照常调度（问题的触发场景）
      const ring = createLiquidRing({ value: 40, label: '转化率' })
      expect(liveFrames()).toBe(1)
      // 回到前台：onVisibility → start() 再次调度；无双调守卫时会叠加第二个自持循环
      hidden = false
      document.dispatchEvent(new Event('visibilitychange'))
      expect(liveFrames()).toBe(1)
      // 单循环证据：5 帧只逼近 5%（双循环则 2%/帧 → 50%）
      ring.setValue(60)
      pump(5)
      expect(ring.el.querySelector<HTMLElement>('.liquid-ring-value')?.textContent).toBe('45.0%')
      ring.dispose()
    } finally {
      hiddenSpy.mockRestore()
    }
  })
})
