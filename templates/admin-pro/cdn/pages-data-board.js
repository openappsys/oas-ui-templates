/**
 * 数据看板页（自 vanilla src/pages/data-board.ts 去 TS 移植）
 * 统计卡（数字动画/统计值）+ 柱状 / 饼图 / 堆叠柱状图（options JSON）+ 进度条 + 水印层
 */
import { onLocaleChange, t } from './i18n.js'
import { boardData } from './data/board.js'

const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion']
const CHART_KEYS = ['board.monthRevenue', 'board.categoryShare', 'board.channelTrend']
const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers']

function statCard(s, idx) {
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

/** 柱状图 data JSON：[{ label, value }] */
function barData(data) {
  return JSON.stringify(data.map((v, i) => ({ label: t(`board.month${i + 1}`), value: v })))
}

/** 饼图 data JSON：[{ label, value }] */
function pieData(slices) {
  return JSON.stringify(slices.map((c) => ({ label: c.name, value: c.value })))
}

/** 堆叠柱状图 data JSON：{ labels, series } */
function stackedData(data, series) {
  return JSON.stringify({
    labels: data[0]?.map((_, i) => t(`board.month${i + 1}`)) ?? [],
    series: series.map((s, si) => ({ name: s.name, data: data[si] ?? [] })),
  })
}

export function renderDataBoard(el) {
  function draw() {
    document.title = `${t('nav.dataBoard')} · ${t('app.title')}`
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
  return onLocaleChange(draw)
}
