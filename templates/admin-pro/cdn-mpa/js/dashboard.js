import { guard, readSession } from './session.js'
import { mountShell } from './shell.js'
import { t } from './i18n.js'

if (guard()) {
  const view = mountShell({ active: './dashboard.html' })
  renderDashboard(view)
}

function renderDashboard(el) {
  const user = readSession() ?? {}
  document.title = `${t('nav.dashboard')} · ${t('app.title')}`
  const stats = [
    { testid: 'stat-visits', label: t('dash.statVisits'), value: '12,480', delta: 12.4 },
    { testid: 'stat-users', label: t('dash.statUsers'), value: '328', delta: 8.2 },
    { testid: 'stat-orders', label: t('dash.statOrders'), value: '1,926', delta: 3.1 },
    { testid: 'stat-rate', label: t('dash.statRate'), value: '4.6%', delta: -0.4 },
  ]
  el.innerHTML = `
    <div class="page">
      <h1 class="page-title">${t('nav.dashboard')}</h1>
      <p class="page-subtitle">${t('dash.welcome')}，${user.name ?? ''}</p>
      <div class="stat-grid">
        ${stats
          .map(
            (s) => `
          <oas-card class="stat-card" data-testid="${s.testid}">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value">${s.value}</div>
            <div class="stat-delta ${s.delta >= 0 ? 'delta-up' : 'delta-down'}">
              ${s.delta > 0 ? '+' : ''}${s.delta}% ${t('dash.vsYesterday')}
            </div>
          </oas-card>`,
          )
          .join('')}
      </div>
      <oas-card title="${t('dash.trendTitle')}">
        <oas-chart id="chart-trend" type="area" options='{"smooth":true,"gradient":true}'
          aria-label="${t('dash.trendTitle')}"></oas-chart>
      </oas-card>
    </div>`
  const chart = el.querySelector('#chart-trend')
  chart.data = {
    labels: ['1', '2', '3', '4', '5', '6', '7'],
    series: [{ name: t('dash.statVisits'), data: [880, 1020, 950, 1240, 1380, 1520, 1716] }],
  }
}
