// 仪表盘页脚本（自 vanilla src/pages/dashboard.ts 去 TS 移植，MPA 适配版）
// 差异：无 onLocaleChange 订阅（MPA 切语言 = reload）；快捷入口 href 用真实页面导航
import { guard, readSession } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf, currentLocale } from './i18n.js'
import { orderBreakdown, recentOrders, trendDays, trendSeries } from './data/dashboard.js'
import { listProducts } from './data/products.js'

// 统计卡定义（vanilla STATS 段逐字对齐；仅首卡带 testid 供 e2e 登录等待）
const STATS = [
  {
    testid: 'stat-visits',
    icon: 'eye',
    tone: 'blue',
    labelKey: 'dashboard.stat.visits',
    value: 12480,
    delta: 12.4,
  },
  {
    testid: undefined,
    icon: 'user',
    tone: 'green',
    labelKey: 'dashboard.stat.users',
    value: 328,
    delta: 8.2,
  },
  {
    testid: undefined,
    icon: 'arrow-up',
    tone: 'violet',
    labelKey: 'dashboard.stat.orders',
    value: 1926,
    delta: 3.1,
  },
  {
    testid: undefined,
    icon: 'clock',
    tone: 'orange',
    labelKey: 'dashboard.stat.conversion',
    value: 4.6,
    suffix: '%',
    delta: -0.4,
  },
]

const DONUT_COLORS = [
  'var(--oas-color-success)',
  'var(--oas-color-primary)',
  'var(--oas-color-warning)',
  'var(--oas-color-danger)',
]

function segmentedOptions() {
  return [
    { label: tf('dashboard.rangeDays', { days: '7' }), value: '7' },
    { label: tf('dashboard.rangeDays', { days: '14' }), value: '14' },
    { label: tf('dashboard.rangeDays', { days: '30' }), value: '30' },
  ]
}

function todayLabel() {
  const d = new Date()
  const locale = currentLocale() === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    d,
  )
}

function trendLabels(days) {
  return trendDays(days).map((d) => (d === '' ? '' : tf('dashboard.rangeDays', { days: d })))
}

function formatNumber(n) {
  return n.toLocaleString('en-US')
}

function formatMoney(n) {
  return `¥ ${formatNumber(n)}`
}

function getToneVars(tone) {
  if (tone === 'blue') return { bg: 'var(--oas-color-primary)', icon: 'var(--oas-color-primary)' }
  if (tone === 'green') return { bg: 'var(--oas-color-success)', icon: 'var(--oas-color-success)' }
  if (tone === 'violet') return { bg: 'var(--oas-tint-violet)', icon: 'var(--oas-tint-violet)' }
  return { bg: 'var(--oas-color-warning)', icon: 'var(--oas-color-warning)' }
}

function donutLegendHtml(breakdown) {
  const items = breakdown.slices
    .map((s, i) => {
      const pct = Math.round((s.value / breakdown.total) * 100)
      return `<span class="donut-legend-item" style="--dot:${DONUT_COLORS[i]}"><i class="donut-dot"></i><span>${t(`orders.status.${s.status}`)}</span><span class="donut-legend-pct mono">${pct}%</span></span>`
    })
    .join('')
  return `<div class="donut-legend" data-testid="donut-legend">
    <div class="donut-total"><span class="mono">${formatNumber(breakdown.total)}</span><span>${t('dashboard.ordersLabel')}</span></div>
    <div class="donut-legend-items">${items}</div>
  </div>`
}

if (guard()) boot()

function boot() {
  document.title = `${t('nav.dashboard')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './dashboard.html' })
  renderDashboard()
}

function renderDashboard() {
  const user = readSession()
  const name = user?.name ?? ''
  // role 来自登录页角色选择；旧会话无 role 时回落 admin（与 profile.js 同款）
  const isAdmin = (user?.role ?? 'admin') === 'admin'

  // 快捷操作：MPA 页间为真实导航（vanilla 为 #/form 等 hash 路由）
  function quickActions() {
    return [
      { href: './form.html', icon: 'plus', label: t('nav.createOrder') },
      ...(isAdmin
        ? [{ href: './products.html', icon: 'edit', label: t('products.newProduct') }]
        : []),
      { href: './orders.html', icon: 'calendar', label: t('nav.orders') },
      ...(isAdmin ? [{ href: './users.html', icon: 'user', label: t('nav.users') }] : []),
    ]
  }

  function renderQuickActions() {
    document.querySelector('[data-testid="quick-actions"]').innerHTML = quickActions()
      .map(
        (a) => `<a class="quick-action" href="${a.href}">
          <oas-icon name="${a.icon}" size="16"></oas-icon>
          <span>${a.label}</span>
        </a>`,
      )
      .join('')
  }

  function fillStats() {
    const grid = document.querySelector('#stat-grid')
    grid.innerHTML = STATS.map((s) => {
      const tone = getToneVars(s.tone)
      const arrow = s.delta >= 0 ? 'arrow-up' : 'arrow-down'
      const deltaCls = s.delta >= 0 ? 'delta-up' : 'delta-down'
      const num = formatNumber(s.value)
      return `
        <oas-card class="stat-card" ${s.testid ? `data-testid="${s.testid}"` : ''}>
          <div class="stat-row">
            <div class="stat-icon" style="--stat-icon-bg:${tone.bg};--stat-icon-color:${tone.icon}">
              <oas-icon name="${s.icon}" size="16"></oas-icon>
            </div>
            <div class="stat-body">
              <div class="stat-label">${t(s.labelKey)}</div>
              <div class="stat-value mono">${num}${s.suffix ?? ''}</div>
              <div class="stat-delta">
                <oas-icon name="${arrow}" size="12" class="${deltaCls}"></oas-icon>
                <span class="${deltaCls}">${s.delta > 0 ? '+' : ''}${s.delta}%</span>
                <span class="stat-delta-label">${t('dashboard.vsYesterday')}</span>
              </div>
            </div>
          </div>
        </oas-card>`
    }).join('')
  }

  function renderTop5(rows) {
    const list = document.querySelector('#top5-list')
    if (rows.length === 0) {
      list.innerHTML = `<oas-empty description="${t('dashboard.noTop5')}"></oas-empty>`
      return
    }
    const maxSold = rows[0].sold
    list.innerHTML = rows
      .map((p, i) => {
        const pct = Math.round((p.sold / maxSold) * 100)
        return `
          <div class="top5-row">
            <span class="top5-rank rank-${i + 1}">${i + 1}</span>
            <div class="top5-main">
              <div class="top5-line">
                <span class="top5-name" title="${p.name}">${p.name}</span>
                <oas-tag class="top5-tag">${p.category}</oas-tag>
              </div>
              <div class="top5-line top5-foot">
                <oas-progress class="top5-bar" percent="${pct}" show-text="false"></oas-progress>
                <span class="top5-sold mono">${p.sold}</span>
              </div>
            </div>
          </div>`
      })
      .join('')
  }

  async function loadTop5() {
    const products = await listProducts()
    const top = products
      .filter((p) => p.sold != null)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)
      .map((p) => ({ name: p.name, category: p.category, sold: p.sold }))
    renderTop5(top)
  }

  let currentRange = '7'

  function setTrendData() {
    const chart = document.querySelector('#chart-trend')
    if (!chart) return
    const days = Number(currentRange)
    chart.data = {
      labels: trendLabels(days),
      series: [{ name: t('dashboard.stat.visits'), data: trendSeries(days) }],
    }
  }

  function setDonutData() {
    const chart = document.querySelector('#chart-orders')
    const breakdown = orderBreakdown(Number(currentRange))
    if (chart) {
      chart.data = breakdown.slices.map((s) => ({
        label: t(`orders.status.${s.status}`),
        value: s.value,
      }))
    }
    const wrap = document.querySelector('#donut-legend-wrap')
    if (wrap) wrap.innerHTML = donutLegendHtml(breakdown)
  }

  function setRecentOrders() {
    const table = document.querySelector('[data-testid="orders-table"]')
    if (!table) return
    const rows = recentOrders(Number(currentRange)).map((r) => ({
      id: r.id,
      customer: r.customer,
      amount: formatMoney(r.amount),
      status: t(`orders.status.${r.status}`),
    }))
    table.setAttribute('data', JSON.stringify(rows))
  }

  // 欢迎语（含登录名 + 日期插值，静态 HTML 无法表达）
  document.querySelector('#dash-welcome').textContent = tf('dashboard.welcome', {
    name,
    date: todayLabel(),
  })
  // 分段选项文案随 locale（HTML 静态无法表达 t()）
  document.querySelector('#trend-range').setAttribute('options', JSON.stringify(segmentedOptions()))
  // 最近订单列定义（列标题走 t()）
  document.querySelector('[data-testid="orders-table"]').setAttribute(
    'columns',
    JSON.stringify([
      { key: 'id', title: t('orders.th.no') },
      { key: 'customer', title: t('orders.th.customer') },
      { key: 'amount', title: t('orders.th.amount') },
      { key: 'status', title: t('orders.th.status') },
    ]),
  )
  renderQuickActions()

  // 统计卡 skeleton 300ms 后填充（vanilla 同款时序）
  setTimeout(fillStats, 300)

  setTrendData()
  setDonutData()
  setRecentOrders()
  void loadTop5()

  document.querySelector('#dash-refresh').addEventListener('click', () => {
    setTrendData()
    setDonutData()
    setRecentOrders()
    OASUI.message.success(t('dashboard.refreshed'))
  })

  document.querySelector('#dash-export').addEventListener('click', () => {
    OASUI.message.info(t('dashboard.demoExport'))
  })

  document.querySelector('#orders-view-all').addEventListener('click', () => {
    OASUI.message.info(t('dashboard.demoOrders'))
  })

  document.querySelector('#trend-range').addEventListener('oas-change', (e) => {
    currentRange = e.detail.value
    setTrendData()
    setDonutData()
    setRecentOrders()
  })
}
