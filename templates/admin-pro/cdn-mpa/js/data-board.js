import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'
import { boardData } from './data/board.js'

const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion']
const PROGRESS_TESTIDS = ['board-progress-order', 'board-progress-revenue', 'board-progress-users']

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

function monthLabels(count) {
  return Array.from({ length: count }, (_, i) => t(`board.month${i + 1}`))
}

function barData(data) {
  return data.map((v, i) => ({ label: t(`board.month${i + 1}`), value: v }))
}

function pieData(slices) {
  return slices.map((c) => ({ label: c.name, value: c.value }))
}

function stackedData(data, series) {
  return {
    labels: monthLabels(data[0]?.length ?? 0),
    series: series.map((s, si) => ({ name: s.name, data: data[si] ?? [] })),
  }
}

if (guard()) {
  document.title = `${t('nav.dataBoard')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './data-board.html' })
  renderBoard()
}

function renderBoard() {
  const data = boardData()

  // 统计卡
  document.querySelector('#board-grid').innerHTML = data.stats
    .map((s, i) => statCard(s, i))
    .join('')

  // 图表：options 走 JSON attribute，data 走 property（与 dashboard.js 同款）
  const bar = document.querySelector('#chart-bar')
  bar.data = barData(data.monthRevenue)
  const pie = document.querySelector('#chart-pie')
  pie.data = pieData(data.categoryShare)
  const stacked = document.querySelector('#chart-stacked')
  stacked.data = stackedData(
    data.channel.series.map((s) => s.data),
    data.channel.series,
  )

  // 季度目标进度条
  const targets = data.quarterTargets
  const values = [targets.order, targets.revenue, targets.users]
  PROGRESS_TESTIDS.forEach((testid, i) => {
    document.querySelector(`[data-testid="${testid}"]`)?.setAttribute('value', String(values[i]))
  })
}
