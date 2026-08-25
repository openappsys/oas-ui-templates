import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { message } from '@oas-ui/ui/feedback/message'
import { session } from '../store/session'
import { listProducts } from '../data/products'

echarts.use([
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  CanvasRenderer,
])

const TREND = [820, 932, 901, 1290, 1330, 1520, 1680]

const ORDERS = [120, 200, 150, 180, 220, 170, 210]
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

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
    label: '今日访问',
    value: 12480,
    delta: 12.4,
  },
  {
    testid: undefined,
    icon: 'user',
    tone: 'green',
    label: '新增用户',
    value: 328,
    delta: 8.2,
  },
  {
    testid: undefined,
    icon: 'arrow-up',
    tone: 'violet',
    label: '订单量',
    value: 1926,
    delta: 3.1,
  },
  {
    testid: undefined,
    icon: 'clock',
    tone: 'orange',
    label: '转化率',
    value: 4.6,
    suffix: '%',
    delta: -0.4,
  },
]

const PIE_DATA = [
  { value: 42, name: '已完成' },
  { value: 31, name: '配送中' },
  { value: 18, name: '待支付' },
  { value: 9, name: '已取消' },
]

const SEGMENTED_OPTIONS = [
  { label: '7日', value: '7' },
  { label: '14日', value: '14' },
  { label: '30日', value: '30' },
]

function isDark(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

function todayLabel(): string {
  const d = new Date()
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function readTokenColor(name: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return val || '#999'
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixHex(a: string, b: string, ratio: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const r = Math.round(ar + (br - ar) * ratio)
  const g = Math.round(ag + (bg - ag) * ratio)
  const l = Math.round(ab + (bb - ab) * ratio)
  return `#${[r, g, l].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function makeTrend(days: number): number[] {
  return Array.from({ length: days }, (_, i) => {
    const base = TREND[i % TREND.length]
    const wave = Math.sin(i * 1.3 + 1) * 60
    return Math.max(200, Math.round(base + wave))
  })
}

function makeTrendLabels(days: number): string[] {
  return Array.from({ length: days }, (_, i) => `${i + 1}日`)
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

export function render(el: HTMLElement): () => void {
  const user = session.user
  const name = user?.name ?? ''
  const isAdmin = user?.role === 'admin'
  const quickActions = [
    { href: '#/form', icon: 'plus', label: '创建订单' },
    ...(isAdmin ? [{ href: '#/products', icon: 'edit', label: '新建商品' }] : []),
    { href: '#/orders', icon: 'calendar', label: '订单管理' },
    ...(isAdmin ? [{ href: '#/users', icon: 'user', label: '用户管理' }] : []),
  ]

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">仪表盘</h1>
          <p class="page-subtitle">欢迎回来，${name} · 今天是 ${todayLabel()}</p>
        </div>
        <oas-space>
          <oas-button id="dash-refresh" icon="refresh">刷新</oas-button>
          <oas-button id="dash-export" icon="download">导出</oas-button>
        </oas-space>
      </div>
      <div class="stat-grid" id="stat-grid">
        ${Array.from({ length: 4 }, () => `<oas-card class="stat-card stat-card--skeleton"><oas-skeleton active rows="3"></oas-skeleton></oas-card>`).join('')}
      </div>
      <div class="chart-grid">
        <oas-card title="访问趋势">
          <oas-segmented id="trend-range" slot="extra" options='${JSON.stringify(SEGMENTED_OPTIONS)}' value="7"></oas-segmented>
          <div id="chart-trend" class="chart"></div>
        </oas-card>
        <oas-card title="订单构成">
          <div id="chart-orders" class="chart"></div>
        </oas-card>
      </div>
      <div class="bottom-grid">
        <oas-card title="最近订单">
          <button id="orders-view-all" class="link-btn" slot="extra">
            查看全部 <oas-icon name="chevron-right" size="12"></oas-icon>
          </button>
          <oas-table
            data-testid="orders-table"
            row-key="id"
            columns='[{"key":"id","title":"订单号"},{"key":"customer","title":"客户"},{"key":"amount","title":"金额"},{"key":"status","title":"状态"}]'
            data="[]"
          ></oas-table>
        </oas-card>
        <oas-card title="热销商品 Top5">
          <a class="link-btn" href="#/products" slot="extra">
            查看全部 <oas-icon name="chevron-right" size="12"></oas-icon>
          </a>
          <div id="top5-list" data-testid="top5-list" class="top5-list"></div>
        </oas-card>
        <oas-card class="quick-card" title="快捷操作">
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
          <div class="quick-foot">Web Components 驱动 · 零框架运行时</div>
        </oas-card>
      </div>
    </div>`

  el.querySelector<HTMLElement>('[data-testid="orders-table"]')!.setAttribute(
    'data',
    JSON.stringify(RECENT_ORDERS),
  )

  let skeletonTimer: ReturnType<typeof setTimeout> | null = null
  let currentRange = '7'
  const charts: Array<echarts.ECharts> = []

  function fillStats(): void {
    const grid = el.querySelector<HTMLElement>('#stat-grid')!
    grid.innerHTML = STATS.map((s) => {
      const tone = getToneVars(s.tone)
      const arrow = s.delta >= 0 ? 'arrow-down' : 'arrow-up'
      const deltaCls = s.delta >= 0 ? 'delta-up' : 'delta-down'
      const num = formatNumber(s.value)
      return `
        <oas-card class="stat-card" ${s.testid ? `data-testid="${s.testid}"` : ''}>
          <div class="stat-row">
            <div class="stat-icon" style="--stat-icon-bg:${tone.bg};--stat-icon-color:${tone.icon}">
              <oas-icon name="${s.icon}" size="16"></oas-icon>
            </div>
            <div class="stat-body">
              <div class="stat-label">${s.label}</div>
              <div class="stat-value mono">${num}${s.suffix ?? ''}</div>
              <div class="stat-delta">
                <oas-icon name="${arrow}" size="12" class="${deltaCls}"></oas-icon>
                <span class="${deltaCls}">${s.delta > 0 ? '+' : ''}${s.delta}%</span>
                <span class="stat-delta-label">较昨日</span>
              </div>
            </div>
          </div>
        </oas-card>`
    }).join('')
  }

  function renderTop5(rows: Array<{ name: string; category: string; sold: number }>): void {
    const list = el.querySelector<HTMLElement>('#top5-list')!
    if (rows.length === 0) {
      list.innerHTML = `<oas-empty description="暂无热销数据"></oas-empty>`
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

  function draw(): void {
    for (const c of charts.splice(0)) c.dispose()
    const primary = readTokenColor('--oas-color-primary')
    const success = readTokenColor('--oas-color-success')
    const warning = readTokenColor('--oas-color-warning')
    const danger = readTokenColor('--oas-color-danger')
    const textSecondary = readTokenColor('--oas-color-text-secondary')
    const border = readTokenColor('--oas-color-border')
    const textPrimary = readTokenColor('--oas-color-text-primary')
    const bg = readTokenColor('--oas-color-bg')
    const dark = isDark()
    const pieSuccess = dark ? mixHex(success, bg, 0.3) : success

    const trend = el.querySelector<HTMLDivElement>('#chart-trend')
    if (trend) {
      const days = Number(currentRange)
      const data = makeTrend(days)
      const labels = makeTrendLabels(days)
      const c = echarts.init(trend)
      c.setOption({
        darkMode: isDark(),
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 16, top: 20, bottom: 24 },
        xAxis: {
          type: 'category',
          data: labels,
          axisLine: { lineStyle: { color: border } },
          axisLabel: { color: textSecondary },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisLabel: { color: textSecondary },
          splitLine: { lineStyle: { color: border } },
        },
        series: [
          {
            type: 'line',
            data,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, color: primary },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: `${primary}33` },
                { offset: 1, color: `${primary}05` },
              ]),
            },
          },
        ],
      } as EChartsOption)
      charts.push(c)
    }

    const orders = el.querySelector<HTMLDivElement>('#chart-orders')
    if (orders) {
      const c = echarts.init(orders)
      c.setOption({
        darkMode: isDark(),
        tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
        legend: {
          bottom: 0,
          left: 'center',
          width: '90%',
          itemGap: 8,
          textStyle: { color: textSecondary },
        },
        color: [pieSuccess, primary, warning, danger],
        graphic: [
          {
            type: 'text',
            left: 'center',
            top: '42%',
            style: {
              text: '1,926',
              fontSize: 20,
              fontWeight: 700,
              fill: textPrimary,
              textAlign: 'center',
            },
          },
          {
            type: 'text',
            left: 'center',
            top: '54%',
            style: {
              text: '订单',
              fontSize: 12,
              fill: textSecondary,
              textAlign: 'center',
            },
          },
        ],
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            label: { show: false },
            data: PIE_DATA,
          },
        ],
      } as EChartsOption)
      charts.push(c)
    }
  }

  function onResize(): void {
    for (const c of charts) c.resize()
  }

  skeletonTimer = setTimeout(() => {
    skeletonTimer = null
    fillStats()
  }, 300)

  draw()
  void loadTop5()

  window.addEventListener('resize', onResize)
  document.addEventListener('themechange', draw)

  el.querySelector<HTMLElement>('#dash-refresh')!.addEventListener('click', () => {
    draw()
    message.success('已刷新')
  })

  el.querySelector<HTMLElement>('#dash-export')!.addEventListener('click', () => {
    message.info('演示环境未接入导出')
  })

  el.querySelector<HTMLElement>('#orders-view-all')!.addEventListener('click', () => {
    message.info('演示环境未接入全部订单')
  })

  el.querySelector<HTMLElement>('#trend-range')!.addEventListener('oas-change', (e) => {
    currentRange = (e as CustomEvent<{ value: string }>).detail.value
    draw()
  })

  return () => {
    if (skeletonTimer) clearTimeout(skeletonTimer)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('themechange', draw)
    for (const c of charts.splice(0)) c.dispose()
  }
}
