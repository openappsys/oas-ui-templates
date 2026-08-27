import { onLocaleChange, t } from '../i18n'
import '../styles/pages/data-board.css'

interface StatDef {
  key: string
  label: string
  value: string
  prefix?: string
  suffix?: string
  anim: boolean
}

export function render(el: HTMLElement): () => void {
  const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion']
  const CHART_KEYS = ['board.monthRevenue', 'board.categoryShare', 'board.channelTrend']
  const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers']

  function stats(): StatDef[] {
    return [
      { key: 'gmv', label: t('board.gmv'), value: '12845678', prefix: '¥', anim: true },
      { key: 'orders', label: t('board.orders'), value: '1926', anim: true },
      { key: 'users', label: t('board.users'), value: '328', anim: false },
      { key: 'conversion', label: t('board.conversion'), value: '4.6', suffix: '%', anim: false },
    ]
  }

  function statCard(s: StatDef): string {
    const value = s.anim
      ? `<oas-number-animation data-testid="anim-${s.key}" value="${s.value}"></oas-number-animation>`
      : `<oas-statistic data-testid="stat-${s.key}" value="${s.value}">${s.suffix ? `<span slot="suffix">${s.suffix}</span>` : ''}</oas-statistic>`
    return `
      <oas-card class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">
          ${s.prefix ? `<span class="stat-prefix">${s.prefix}</span>` : ''}
          ${value}
        </div>
      </oas-card>`
  }

  function refreshText(): void {
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('board.title')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('board.subtitle')
    // 统计卡 label（4 张，按 index 对应 key）
    el.querySelectorAll<HTMLElement>('.stat-card .stat-label').forEach((n, i) => {
      const k = STAT_KEYS[i]
      if (k) n.textContent = t(k)
    })
    // 图表卡片 title + aria-label + 数据（月份标签随语言）
    el.querySelectorAll<HTMLElement>('.chart-card').forEach((n, i) => {
      const k = CHART_KEYS[i]
      if (k) n.setAttribute('title', t(k))
      const chart = n.querySelector<HTMLElement>('oas-chart')
      chart?.setAttribute('aria-label', k ? t(k) : '')
      if (i === 0) chart?.setAttribute('data', barData())
      else if (i === 1) chart?.setAttribute('data', JSON.stringify(PIE))
      else if (i === 2) chart?.setAttribute('data', stackedData())
    })
    // 进度条 label（3 行）
    el.querySelectorAll<HTMLElement>('.progress-label').forEach((n, i) => {
      const k = PROGRESS_KEYS[i]
      if (k) n.textContent = t(k)
    })
  }

  function draw(): void {
    const defs = stats()
    const bData = barData()
    const pData = JSON.stringify(PIE)
    const sData = stackedData()
    el.innerHTML = `
      <div class="page">
        <div class="page-head">
          <div>
            <h1 class="page-title">${t('board.title')}</h1>
            <p class="page-subtitle">${t('board.subtitle')}</p>
          </div>
        </div>
        <oas-watermark text="OAS Admin Pro" repeat opacity="0.12">
          <div class="board-grid" id="board-grid">${defs.map(statCard).join('')}</div>
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
                <oas-progress value="72" data-testid="board-progress-order"></oas-progress>
              </div>
              <div class="progress-row">
                <span class="progress-label">${t('board.targetRevenue')}</span>
                <oas-progress value="58" data-testid="board-progress-revenue"></oas-progress>
              </div>
              <div class="progress-row">
                <span class="progress-label">${t('board.targetUsers')}</span>
                <oas-progress value="85" data-testid="board-progress-users"></oas-progress>
              </div>
            </div>
          </oas-card>
        </oas-watermark>
      </div>`
  }

  draw()
  return onLocaleChange(refreshText)
}

function barData(): string {
  return JSON.stringify([
    { label: t('board.month1'), value: 86 },
    { label: t('board.month2'), value: 92 },
    { label: t('board.month3'), value: 65 },
    { label: t('board.month4'), value: 78 },
    { label: t('board.month5'), value: 88 },
    { label: t('board.month6'), value: 96 },
  ])
}

const PIE = [
  { label: '数码', value: 40 },
  { label: '家电', value: 35 },
  { label: '食品', value: 25 },
]

function stackedData(): string {
  return JSON.stringify({
    labels: [t('board.month1'), t('board.month2'), t('board.month3'), t('board.month4')],
    series: [
      { name: '线上', data: [320, 302, 341, 374] },
      { name: '分销', data: [120, 132, 101, 134] },
      { name: '门店', data: [220, 182, 191, 234] },
    ],
  })
}
