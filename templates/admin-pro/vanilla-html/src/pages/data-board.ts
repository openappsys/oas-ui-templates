import { onLocaleChange, t } from '../i18n'
import { boardData } from '../data/board'
import type { BoardStat, CategorySlice, ChannelSeries } from '../data/board'
import '../styles/pages/data-board.css'

export function render(el: HTMLElement): () => void {
  const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion']
  const CHART_KEYS = ['board.monthRevenue', 'board.categoryShare', 'board.channelTrend']
  const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers']

  function statCard(s: BoardStat, idx: number): string {
    const value = s.anim
      ? `<oas-number-animation data-testid="anim-${s.key}" value="${s.value}"></oas-number-animation>`
      : `<oas-statistic data-testid="stat-${s.key}" value="${s.value}">${s.suffix ? `<span slot="suffix">${s.suffix}</span>` : ''}</oas-statistic>`
    return `
      <oas-card class="stat-card">
        <div class="stat-label">${t(STAT_KEYS[idx] ?? '')}</div>
        <div class="stat-value">
          ${s.prefix ? `<span class="stat-prefix">${s.prefix}</span>` : ''}
          ${value}
        </div>
      </oas-card>`
  }

  function barData(data: number[]): string {
    return JSON.stringify(data.map((v, i) => ({ label: t(`board.month${i + 1}`), value: v })))
  }

  function pieData(slices: CategorySlice[]): string {
    return JSON.stringify(slices.map((c) => ({ label: c.name, value: c.value })))
  }

  function stackedData(data: number[][], series: ChannelSeries[]): string {
    return JSON.stringify({
      labels: data[0]?.map((_, i) => t(`board.month${i + 1}`)) ?? [],
      series: series.map((s, si) => ({ name: s.name, data: data[si] ?? [] })),
    })
  }

  function refreshText(): void {
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('board.title')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('board.subtitle')
    const data = boardData()
    el.querySelectorAll<HTMLElement>('.stat-card .stat-label').forEach((n, i) => {
      n.textContent = t(STAT_KEYS[i] ?? '')
    })
    el.querySelectorAll<HTMLElement>('.chart-card').forEach((n, i) => {
      const k = CHART_KEYS[i]
      if (k) n.setAttribute('title', t(k))
      const chart = n.querySelector<HTMLElement>('oas-chart')
      chart?.setAttribute('aria-label', k ? t(k) : '')
      if (i === 0) chart?.setAttribute('data', barData(data.monthRevenue))
      else if (i === 1) chart?.setAttribute('data', pieData(data.categoryShare))
      else if (i === 2)
        chart?.setAttribute(
          'data',
          stackedData(
            data.channel.series.map((s) => s.data),
            data.channel.series,
          ),
        )
    })
    el.querySelectorAll<HTMLElement>('.progress-label').forEach((n, i) => {
      n.textContent = t(PROGRESS_KEYS[i] ?? '')
    })
    const targets = data.quarterTargets
    el.querySelector<HTMLElement>('[data-testid="board-progress-order"]')?.setAttribute(
      'value',
      String(targets.order),
    )
    el.querySelector<HTMLElement>('[data-testid="board-progress-revenue"]')?.setAttribute(
      'value',
      String(targets.revenue),
    )
    el.querySelector<HTMLElement>('[data-testid="board-progress-users"]')?.setAttribute(
      'value',
      String(targets.users),
    )
  }

  function draw(): void {
    const data = boardData()
    const defs = data.stats.map((s, i) => statCard(s, i)).join('')
    const bData = barData(data.monthRevenue)
    const pData = pieData(data.categoryShare)
    const sData = stackedData(
      data.channel.series.map((s) => s.data),
      data.channel.series,
    )
    const pTargets = data.quarterTargets
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div>
            <h1 class="page-title">${t('board.title')}</h1>
            <p class="page-subtitle">${t('board.subtitle')}</p>
          </div>
        </div>
        <oas-watermark text="OAS Admin Pro" repeat opacity="0.12">
          <div class="board-grid" id="board-grid">${defs}</div>
          <div class="board-charts">
            <oas-card class="chart-card" title="${t('board.monthRevenue')}">
              <oas-chart type="bar" data='${bData}' aria-label="${t('board.monthRevenue')}"></oas-chart>
            </oas-card>
            <oas-card class="chart-card" title="${t('board.categoryShare')}">
              <oas-chart type="pie" data='${pData}' aria-label="${t('board.categoryShare')}"></oas-chart>
            </oas-card>
            <oas-card class="chart-card chart-card--wide" title="${t('board.channelTrend')}">
              <oas-chart type="stacked-bar" options='{"showLegend":true}' data='${sData}' aria-label="${t('board.channelTrend')}"></oas-chart>
            </oas-card>
          </div>
          <oas-card class="board-progress" title="${t('board.targetTitle')}">
            <div class="progress-list">
              <div class="progress-row">
                <span class="progress-label">${t('board.targetOrder')}</span>
                <oas-progress value="${pTargets.order}" data-testid="board-progress-order"></oas-progress>
              </div>
              <div class="progress-row">
                <span class="progress-label">${t('board.targetRevenue')}</span>
                <oas-progress value="${pTargets.revenue}" data-testid="board-progress-revenue"></oas-progress>
              </div>
              <div class="progress-row">
                <span class="progress-label">${t('board.targetUsers')}</span>
                <oas-progress value="${pTargets.users}" data-testid="board-progress-users"></oas-progress>
              </div>
            </div>
          </oas-card>
        </oas-watermark>
      </div>`
  }

  draw()
  return onLocaleChange(refreshText)
}
