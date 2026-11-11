import { onLocaleChange, t } from '../i18n'
import { screenData, tickScreenData } from '../data/screen'
import type { CountrySales, ScreenData } from '../data/screen'
import type { CategorySlice, ChannelSeries } from '../data/board'
import '../styles/pages/screen.css'

const KPI_KEYS = [
  'screen.kpi.gmv',
  'screen.kpi.orders',
  'screen.kpi.users',
  'screen.kpi.conversion',
]
const CHART_KEYS = [
  'screen.chart.monthRevenue',
  'screen.chart.categoryShare',
  'screen.chart.channelTrend',
]
// 月度标签复用 data-board 的 board.month1..6（screen 数据同为 6 个月）
const MONTH_KEYS = [
  'board.month1',
  'board.month2',
  'board.month3',
  'board.month4',
  'board.month5',
  'board.month6',
]

// 霓虹色板（青→蓝→紫→绿→金），oas-chart options.colors 消费
const NEON = ['#22d3ee', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24']

const EXPAND_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5"/><path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5"/><path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11"/></svg>`
const COMPRESS_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h3V2"/><path d="M14 5h-3V2"/><path d="M14 11h-3v3"/><path d="M2 11h3v3"/></svg>`

export function renderScreen(el: HTMLElement): () => void {
  let current = screenData()
  let exiting = false

  function kpiCard(k: ScreenData['kpis'][number], idx: number): string {
    const label = t(KPI_KEYS[idx] ?? '')
    const value = k.anim
      ? `<oas-number-animation data-testid="screen-kpi-${k.key}" value="${k.value}"></oas-number-animation>`
      : `<oas-statistic data-testid="screen-kpi-${k.key}" value="${k.value}" precision="${k.key === 'conversion' ? 1 : 0}">${k.suffix ? `<span slot="suffix">${k.suffix}</span>` : ''}</oas-statistic>`
    return `
      <div class="panel kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">
          ${k.prefix ? `<span class="kpi-prefix">${k.prefix}</span>` : ''}
          ${value}
        </div>
      </div>`
  }

  function barData(data: number[]): string {
    return JSON.stringify(data.map((v, i) => ({ label: t(MONTH_KEYS[i] ?? ''), value: v })))
  }

  function donutData(slices: CategorySlice[]): string {
    return JSON.stringify(slices.map((c) => ({ label: c.name, value: c.value })))
  }

  function stackedData(data: number[][], series: ChannelSeries[]): string {
    return JSON.stringify({
      labels: data[0]?.map((_, i) => t(MONTH_KEYS[i] ?? '')) ?? [],
      series: series.map((s, si) => ({ name: s.name, data: data[si] ?? [] })),
    })
  }

  function rankHtml(countries: CountrySales[]): string {
    const top = [...countries].sort((a, b) => b.value - a.value).slice(0, 5)
    const max = top[0]?.value ?? 1
    return top
      .map((c, i) => {
        const pct = Math.max(6, Math.round((c.value / max) * 100))
        return `
      <div class="rank-item">
        <span class="rank-no rank-no-${i + 1}">${i + 1}</span>
        <span class="rank-name">${c.name}</span>
        <div class="rank-bar"><i style="width:${pct}%"></i></div>
        <span class="rank-val">${(c.value / 10000).toFixed(0)}万</span>
      </div>`
      })
      .join('')
  }

  function refreshText(): void {
    document.title = t('screen.title')
    el.querySelector<HTMLElement>('.screen-title')!.textContent = t('screen.title')
    el.querySelectorAll<HTMLElement>('.kpi-card .kpi-label').forEach((n, i) => {
      n.textContent = t(KPI_KEYS[i] ?? '')
    })
    // 面板标题（bar/donut/stacked 顺序与 CHART_KEYS 一致）
    const titles = el.querySelectorAll<HTMLElement>('.chart-card .panel-title')
    titles.forEach((n, i) => {
      const k = CHART_KEYS[i]
      if (k) {
        n.textContent = t(k)
        n.closest('.chart-card')?.querySelector('oas-chart')?.setAttribute('aria-label', t(k))
      }
    })
    el.querySelector<HTMLElement>('.map-card .panel-title')!.textContent = t('screen.map.title')
    el.querySelector<HTMLElement>('.rank-card .panel-title')!.textContent = t('screen.rank.title')
    // 月度标签随 locale 变化，重挂 chart data
    el.querySelector<HTMLElement>('[data-chart="bar"]')?.setAttribute(
      'data',
      barData(current.monthRevenue),
    )
    el.querySelector<HTMLElement>('[data-chart="donut"]')?.setAttribute(
      'data',
      donutData(current.categoryShare),
    )
    el.querySelector<HTMLElement>('[data-chart="stacked"]')?.setAttribute(
      'data',
      stackedData(
        current.channel.series.map((s) => s.data),
        current.channel.series,
      ),
    )
    el.querySelector<HTMLElement>('[data-testid="screen-exit"]')!.textContent = t('screen.exit')
    el.querySelector<HTMLElement>('[data-testid="screen-fullscreen"] .fs-label')!.textContent =
      t('screen.fullscreen')
  }

  function tick(): void {
    current = tickScreenData(current)
    current.kpis.forEach((k) => {
      el.querySelector<HTMLElement>(`[data-testid="screen-kpi-${k.key}"]`)?.setAttribute(
        'value',
        String(k.value),
      )
    })
    el.querySelector<HTMLElement>('[data-chart="bar"]')?.setAttribute(
      'data',
      barData(current.monthRevenue),
    )
    el.querySelector<HTMLElement>('[data-chart="stacked"]')?.setAttribute(
      'data',
      stackedData(
        current.channel.series.map((s) => s.data),
        current.channel.series,
      ),
    )
    el.querySelector<HTMLElement>('[data-testid="screen-rank"]')!.innerHTML = rankHtml(
      current.countries,
    )
  }

  function clock(): void {
    const now = new Date()
    el.querySelector<HTMLElement>('.clock-time')!.textContent = now.toLocaleTimeString('zh-CN', {
      hour12: false,
    })
    el.querySelector<HTMLElement>('.clock-date')!.textContent = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    })
  }

  function exit(): void {
    if (exiting) return
    exiting = true
    window.close()
    setTimeout(() => {
      if (!window.closed) location.href = './index.html'
    }, 500)
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  // 16:9 固定画布等比缩放（大屏通行范式）：1920×1080 设计稿，scale 适配任意屏幕
  function fit(): void {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    el.style.setProperty('--screen-scale', scale.toFixed(4))
  }

  // oas-chart 是 shadow DOM：霓虹 glow 需注入 shadow 样式表（同 map-card 先例）。
  // 图形元素 fill/stroke 走 currentColor（options.colors 设 inline color），
  // drop-shadow(currentColor) 即按系列色发光。
  function ensureChartGlow(): void {
    el.querySelectorAll<HTMLElement>('oas-chart').forEach((c) => {
      const root = c.shadowRoot
      if (!root || root.querySelector('style[data-screen-glow]')) return
      const st = document.createElement('style')
      st.setAttribute('data-screen-glow', '')
      st.textContent = `
        .bar, .slice, .line-path, .area-path, .radar-area, .dot {
          filter: drop-shadow(0 0 6px currentColor);
        }
      `
      root.appendChild(st)
    })
  }

  function draw(): void {
    const data = current
    const kpis = data.kpis.map((k, i) => kpiCard(k, i)).join('')
    const bData = barData(data.monthRevenue)
    const dData = donutData(data.categoryShare)
    const sData = stackedData(
      data.channel.series.map((s) => s.data),
      data.channel.series,
    )
    el.innerHTML = `
      <div class="screen-canvas">
        <div class="screen">
          <header class="screen-header">
            <div class="screen-clock">
              <span class="clock-time" data-testid="screen-clock"></span>
              <span class="clock-date"></span>
            </div>
            <h1 class="screen-title">${t('screen.title')}</h1>
            <div class="screen-actions">
              <oas-button data-testid="screen-exit" type="text" icon="close">${t('screen.exit')}</oas-button>
              <oas-button data-testid="screen-fullscreen" type="text">
                <oas-icon size="14" class="fs-expand">${EXPAND_ICON}</oas-icon>
                <oas-icon size="14" class="fs-compress">${COMPRESS_ICON}</oas-icon>
                <span class="fs-label">${t('screen.fullscreen')}</span>
              </oas-button>
            </div>
          </header>
          <div class="screen-kpis">${kpis}</div>
          <div class="screen-main">
            <div class="chart-stack">
              <section class="panel chart-card">
                <div class="panel-title">${t('screen.chart.monthRevenue')}</div>
                <div class="panel-body">
                  <oas-chart data-chart="bar" type="bar" options='${JSON.stringify({ colors: [NEON[0]] })}' data='${bData}' aria-label="${t('screen.chart.monthRevenue')}"></oas-chart>
                </div>
              </section>
              <section class="panel chart-card">
                <div class="panel-title">${t('screen.chart.channelTrend')}</div>
                <div class="panel-body">
                  <oas-chart data-chart="stacked" type="stacked-bar" options='${JSON.stringify({ colors: [NEON[0], NEON[1], NEON[2]], showLegend: true })}' data='${sData}' aria-label="${t('screen.chart.channelTrend')}"></oas-chart>
                </div>
              </section>
            </div>
            <section class="panel map-card">
              <div class="panel-title">${t('screen.map.title')}</div>
              <div class="panel-body">
                <div class="screen-map" data-testid="screen-map"></div>
              </div>
            </section>
            <div class="chart-stack">
              <section class="panel chart-card">
                <div class="panel-title">${t('screen.chart.categoryShare')}</div>
                <div class="panel-body">
                  <oas-chart data-chart="donut" type="donut" options='${JSON.stringify({ colors: [NEON[0], NEON[1], NEON[2]] })}' data='${dData}' aria-label="${t('screen.chart.categoryShare')}"></oas-chart>
                </div>
              </section>
              <section class="panel rank-card">
                <div class="panel-title">${t('screen.rank.title')}</div>
                <div class="panel-body">
                  <div class="rank-list" data-testid="screen-rank">${rankHtml(data.countries)}</div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>`
  }

  draw()
  ensureChartGlow()
  fit()
  clock()
  document.title = t('screen.title')

  const tickTimer = setInterval(tick, 5000)
  const clockTimer = setInterval(clock, 1000)

  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') exit()
  }
  document.addEventListener('keydown', escHandler)
  el.querySelector<HTMLElement>('[data-testid="screen-exit"]')!.addEventListener('click', exit)

  const fsBtn = el.querySelector<HTMLElement>('[data-testid="screen-fullscreen"]')!
  if (!document.fullscreenEnabled) {
    fsBtn.hidden = true
  } else {
    fsBtn.addEventListener('click', toggleFullscreen)
  }
  const fsChange = (): void => {
    const active = document.fullscreenElement != null
    fsBtn.classList.toggle('is-fullscreen', active)
    fsBtn.setAttribute('aria-pressed', String(active))
  }
  document.addEventListener('fullscreenchange', fsChange)

  const resizeHandler = (): void => fit()
  window.addEventListener('resize', resizeHandler)

  const offLocale = onLocaleChange(refreshText)

  return () => {
    clearInterval(tickTimer)
    clearInterval(clockTimer)
    document.removeEventListener('keydown', escHandler)
    document.removeEventListener('fullscreenchange', fsChange)
    window.removeEventListener('resize', resizeHandler)
    offLocale()
  }
}
