import { guard, readSession } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'

if (guard()) {
  document.title = `${t('nav.dashboard')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './dashboard.html' })

  const user = readSession()
  if (user) document.querySelector('#dash-user').textContent = user.name

  const chart = document.querySelector('#chart-trend')
  chart.data = {
    labels: ['1', '2', '3', '4', '5', '6', '7'],
    series: [{ name: t('dash.statVisits'), data: [880, 1020, 950, 1240, 1380, 1520, 1716] }],
  }
}
