/**
 * 自绘 canvas 液体环：数据大屏 conversion KPI 的自定义可视化。
 * 零依赖：圆环底槽 + 圆内双层正弦波液面，rAF 驱动相位流动与数值逼近。
 * prefers-reduced-motion 下退化为单帧静态绘制（setValue 直接重绘）。
 */

export interface LiquidRingHandle {
  el: HTMLElement
  setValue(percent: number): void
  dispose(): void
}

/** 每帧向 target 步进 step，到达即停（不越过，双向） */
export function approach(current: number, target: number, step = 1): number {
  if (current < target) return Math.min(current + step, target)
  if (current > target) return Math.max(current - step, target)
  return current
}

const DEFAULT_SIZE = 120
// 动画参数（brief 定值）：相位每帧 +0.05，数值每帧逼近 1%，波幅 6px，波长 = 半径
const PHASE_STEP = 0.05
const VALUE_STEP = 1
const WAVE_AMPLITUDE = 6
// 低值观感兜底：液面绘制不低于 8%（如转化率 4.6% 时不呈「空环」），中央文本仍显示真实值
const MIN_VISIBLE_LEVEL = 8
// 环底槽 rgba(30,58,95,.6) 线宽 8；前波 #22d3ee opacity 1 相位 0，后波 #0891b2 opacity .7 相位 π/2
const TRACK_COLOR = 'rgba(30,58,95,.6)'
const TRACK_WIDTH = 8
const FRONT_COLOR = '#22d3ee'
const BACK_COLOR = '#0891b2'

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function createLiquidRing(opts: {
  value: number
  label: string
  size?: number
}): LiquidRingHandle {
  const size = opts.size ?? DEFAULT_SIZE
  const dpr = window.devicePixelRatio || 1
  // 减小波幅过高的 dpr 放大：视觉上保持设计稿 6px，画布坐标系按 dpr 缩放
  const amp = WAVE_AMPLITUDE * dpr

  const el = document.createElement('div')
  el.className = 'liquid-ring'
  el.style.width = `${size}px`
  el.style.height = `${size}px`

  const canvas = document.createElement('canvas')
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  el.appendChild(canvas)

  const text = document.createElement('div')
  text.className = 'liquid-ring-text'
  const valueEl = document.createElement('span')
  valueEl.className = 'liquid-ring-value'
  const labelEl = document.createElement('span')
  labelEl.className = 'liquid-ring-label'
  labelEl.textContent = opts.label
  text.appendChild(valueEl)
  text.appendChild(labelEl)
  el.appendChild(text)

  let phase = 0
  let current = opts.value
  let target = opts.value
  let rafId: number | undefined
  let stopped = false
  const reduced = prefersReducedMotion()

  // 液面双波：后波先画（深色垫底），前波后画（亮色压上）形成层次
  function drawWave(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    inner: number,
    level: number,
    offset: number,
    color: string,
    opacity: number,
  ): void {
    const wavelength = inner
    ctx.globalAlpha = opacity
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(cx - inner, level)
    for (let x = -inner; x <= inner; x += 2 * dpr) {
      const y = level + Math.sin((x / wavelength) * Math.PI * 2 + phase + offset) * amp
      ctx.lineTo(cx + x, y)
    }
    ctx.lineTo(cx + inner, cy + inner)
    ctx.lineTo(cx - inner, cy + inner)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

  function draw(): void {
    const ctx = canvas.getContext('2d')
    // happy-dom 无 canvas 实现返回 null：仅跳过绘制，DOM/文本逻辑不受影响
    if (!ctx) return
    const s = size * dpr
    const cx = s / 2
    const cy = s / 2
    ctx.clearRect(0, 0, s, s)
    // 圆环底槽（外沿留出线宽一半，避免裁切）
    const trackR = s / 2 - (TRACK_WIDTH / 2) * dpr
    ctx.beginPath()
    ctx.arc(cx, cy, trackR, 0, Math.PI * 2)
    ctx.strokeStyle = TRACK_COLOR
    ctx.lineWidth = TRACK_WIDTH * dpr
    ctx.stroke()
    // 液面：裁剪到环内圆，自底部填充至液面高度；绘制用 max(value, 8%) 保证低值可读，
    // 文本仍渲染真实 current（见 renderText）
    const inner = trackR - (TRACK_WIDTH / 2) * dpr
    const level = cy + inner - (Math.max(current, MIN_VISIBLE_LEVEL) / 100) * inner * 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, Math.PI * 2)
    ctx.clip()
    drawWave(ctx, cx, cy, inner, level, Math.PI / 2, BACK_COLOR, 0.7)
    drawWave(ctx, cx, cy, inner, level, 0, FRONT_COLOR, 1)
    ctx.restore()
  }

  function renderText(): void {
    valueEl.textContent = `${current.toFixed(1)}%`
  }

  function frame(): void {
    if (stopped) return
    phase += PHASE_STEP
    current = approach(current, target, VALUE_STEP)
    draw()
    renderText()
    rafId = requestAnimationFrame(frame)
  }

  function start(): void {
    // 双调守卫：hidden-at-creation 场景下 onVisibility 的 start 可能与创建时的
    // start 叠加；先停后启避免两个自持 rAF 循环（孤儿循环只被 stop 取消一半）
    stop()
    if (stopped || reduced || typeof requestAnimationFrame !== 'function') return
    rafId = requestAnimationFrame(frame)
  }

  function stop(): void {
    if (rafId !== undefined) cancelAnimationFrame(rafId)
    rafId = undefined
  }

  // 页面切后台暂停 rAF、回前台恢复（与 screen.ts 的 visibilitychange 行为一致）
  const onVisibility = (): void => {
    if (reduced) return
    if (document.hidden) stop()
    else start()
  }
  document.addEventListener('visibilitychange', onVisibility)

  if (reduced) {
    // 静态模式：单帧绘制，setValue 直接落到目标并重绘，无循环
    renderText()
    draw()
  } else {
    renderText()
    draw()
    start()
  }

  return {
    el,
    setValue(percent: number): void {
      target = percent
      if (reduced) {
        current = target
        renderText()
        draw()
      }
    },
    dispose(): void {
      stopped = true
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
