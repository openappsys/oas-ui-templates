import type { OASChart } from '@oas-ui/ui/data/chart'
import { message } from '@oas-ui/ui/feedback/message'
import { t, currentLocale } from '../i18n'
import { session } from '../store/session'
import { listProducts } from '../data/products'

const TREND = [820, 932, 901, 1290, 1330, 1520, 1680]

const RECENT_ORDERS = [
  { id: 'SO-10086', customer: '华信科技', amount: '¥ 12,800', status: '已完成' },
  { id: 'SO-10085', customer: '蓝海贸易', amount: '¥ 8,600', status: '配送中' },
  { id: 'SO-10084', customer: '星野文化', amount: '¥ 3,200', status: '待支付' },
  { id: 'SO-10083', customer: '晨光实业', amount: '¥ 21,500', status: '已完成' },
  { id: 'SO-10082', customer: '云图软件', amount: '¥ 6,900', status: '已取消' },
]

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

const PIE_DATA = [
  { key: 'orders.status.done', value: 42 },
  { key: 'orders.status.shipping', value: 31 },
  { key: 'orders.status.pending', value: 18 },
  { key: 'orders.status.cancelled', value: 9 },
]

const DONUT_COLORS = [
  'var(--oas-color-success)',
  'var(--oas-color-primary)',
  'var(--oas-color-warning)',
  'var(--oas-color-danger)',
]

const TOTAL_ORDERS = 1926

const SEGMENTED_OPTIONS = (): Array<{ label: string; value: string }> => [
  { label: t('dashboard.rangeDays', { days: '7' }), value: '7' },
  { label: t('dashboard.rangeDays', { days: '14' }), value: '14' },
  { label: t('dashboard.rangeDays', { days: '30' }), value: '30' },
]

function todayLabel(): string {
  const d = new Date()
  const locale = currentLocale() === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function makeTrend(days: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const base = TREND[i % TREND.length]
    const wave = Math.sin(i * 1.3 + 1) * 60
    return Math.max(200, Math.round(base + wave))
  })
}

function makeTrendLabels(days: number): string[] {
  return Array.from({ length: days }, (_, i) => t('dashboard.rangeDays', { days: i + 1 }))
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function getToneVars(tone: string): { bg: string; icon: string } {
  if (tone === 'blue') {
    return { bg: 'var(--oas-color-primary)', icon: 'var(--oas-color-primary)' }
  }
  if (tone === 'green') {
    return { bg: 'var(--oas-color-success)', icon: 'var(--oas-color-success)' }
  }
  if (tone === 'violet') {
    return { bg: 'var(--oas-tint-violet)', icon: 'var(--oas-tint-violet)' }
  }
  return { bg: 'var(--oas-color-warning)', icon: 'var(--oas-color-warning)' }
}

function donutLegendHtml(): string {
  const items = PIE_DATA.map((p, i) => {
    const pct = Math.round((p.value / 100) * 100)
    return `<span class="donut-legend-item" style="--dot:${DONUT_COLORS[i]}"><i class="donut-dot"></i><span>${t(p.key)}</span><span class="donut-legend-pct mono">${pct}%</span></span>`
  }).join('')
  return `<div class="donut-legend" data-testid="donut-legend">
    <div class="donut-total"><span class="mono">${formatNumber(TOTAL_ORDERS)}</span><span>${t('dashboard.ordersLabel')}</span></div>
    <div class="donut-legend-items">${items}</div>
  </div>`
}

export function render(el: HTMLElement): () => void {
  const user = session.user
  const name = user?.name ?? ''
  const isAdmin = user?.role === 'admin'
  const quickActions = [
    { href: '#/form', icon: 'plus', label: t('nav.createOrder') },
    ...(isAdmin ? [{ href: '#/products', icon: 'edit', label: t('products.newProduct') }] : []),
    { href: '#/orders', icon: 'calendar', label: t('nav.orders') },
    ...(isAdmin ? [{ href: '#/users', icon: 'user', label: t('nav.users') }] : []),
  ]

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.dashboard')}</h1>
          <p class="page-subtitle">${t('dashboard.welcome', { name, date: todayLabel() })}</p>
        </div>
        <oas-space>
          <oas-button id="dash-refresh" icon="refresh">${t('common.refresh')}</oas-button>
          <oas-button id="dash-export" icon="download">${t('dashboard.export')}</oas-button>
        </oas-space>
      </div>
      <div class="stat-grid" id="stat-grid">
        ${Array.from({ length: 4 }, () => `<oas-card class="stat-card stat-card--skeleton"><oas-skeleton active rows="3"></oas-skeleton></oas-card>`).join('')}
      </div>
      <div class="chart-grid">
        <oas-card title="${t('dashboard.trendTitle')}">
          <oas-segmented id="trend-range" slot="extra" options='${JSON.stringify(SEGMENTED_OPTIONS())}' value="7"></oas-segmented>
          <oas-chart id="chart-trend" class="chart" type="area" options='{"smooth":true}' aria-label="${t('dashboard.trendTitle')}"></oas-chart>
        </oas-card>
        <oas-card title="${t('dashboard.ordersTitle')}">
          <oas-chart id="chart-orders" class="chart" type="donut" options='${JSON.stringify({ colors: DONUT_COLORS })}' aria-label="${t('dashboard.ordersTitle')}"></oas-chart>
          ${donutLegendHtml()}
        </oas-card>
      </div>
      <div class="bottom-grid">
        <oas-card title="${t('dashboard.recentOrders')}">
          <button id="orders-view-all" class="link-btn" slot="extra">
            ${t('dashboard.viewAll')} <oas-icon name="chevron-right" size="12"></oas-icon>
          </button>
          <oas-table
            data-testid="orders-table"
            row-key="id"
            columns='${JSON.stringify([
              { key: 'id', title: t('orders.th.no') },
              { key: 'customer', title: t('orders.th.customer') },
              { key: 'amount', title: t('orders.th.amount') },
              { key: 'status', title: t('orders.th.status') },
            ])}'
            data="[]"
          ></oas-table>
        </oas-card>
        <oas-card title="${t('dashboard.topProducts')}">
          <a class="link-btn" href="#/products" slot="extra">
            ${t('dashboard.viewAll')} <oas-icon name="chevron-right" size="12"></oas-icon>
          </a>
          <div id="top5-list" data-testid="top5-list" class="top5-list"></div>
        </oas-card>
        <oas-card class="quick-card" title="${t('dashboard.quickActions')}">
          <div class="quick-actions" data-testid="quick-actions">
            ${quickActions
              .map(
                (a) => `<a class="quick-action" href="${a.href}">
                  <oas-icon name="${a.icon}" size="16"></oas-icon>
                  <span>${a.label}</span>
                </a>`,
              )
              .join('')}
          </div>
          <div class="quick-foot">${t('dashboard.techNote')}</div>
        </oas-card>
      </div>
    </div>`

  el.querySelector<HTMLElement>('[data-testid="orders-table"]')!.setAttribute(
    'data',
    JSON.stringify(RECENT_ORDERS),
  )

  let skeletonTimer: ReturnType<typeof setTimeout> | null = null
  let currentRange = '7'

  function fillStats(): void {
    const grid = el.querySelector<HTMLElement>('#stat-grid')!
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

  function renderTop5(rows: Array<{ name: string; category: string; sold: number }>): void {
    const list = el.querySelector<HTMLElement>('#top5-list')!
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

  async function loadTop5(): Promise<void> {
    const products = await listProducts()
    const top = products
      .filter((p) => p.sold != null)
      .sort((a, b) => b.sold! - a.sold!)
      .slice(0, 5)
      .map((p) => ({ name: p.name, category: p.category, sold: p.sold! }))
    renderTop5(top)
  }

  function setTrendData(): void {
    const chart = el.querySelector<OASChart>('#chart-trend')
    if (!chart) return
    const days = Number(currentRange)
    chart.data = {
      labels: makeTrendLabels(days),
      series: [{ name: t('dashboard.stat.visits'), data: makeTrend(days) }],
    }
  }

  function setDonutData(): void {
    const chart = el.querySelector<OASChart>('#chart-orders')
    if (!chart) return
    chart.data = PIE_DATA.map((p) => ({ label: t(p.key), value: p.value }))
  }

  skeletonTimer = setTimeout(() => {
    skeletonTimer = null
    fillStats()
  }, 300)

  setTrendData()
  setDonutData()
  void loadTop5()

  el.querySelector<HTMLElement>('#dash-refresh')!.addEventListener('click', () => {
    setTrendData()
    message.success(t('dashboard.refreshed'))
  })

  el.querySelector<HTMLElement>('#dash-export')!.addEventListener('click', () => {
    message.info(t('dashboard.demoExport'))
  })

  el.querySelector<HTMLElement>('#orders-view-all')!.addEventListener('click', () => {
    message.info(t('dashboard.demoOrders'))
  })

  el.querySelector<HTMLElement>('#trend-range')!.addEventListener('oas-change', (e) => {
    currentRange = (e as CustomEvent<{ value: string }>).detail.value
    setTrendData()
  })

  return () => {
    if (skeletonTimer) clearTimeout(skeletonTimer)
  }
}
