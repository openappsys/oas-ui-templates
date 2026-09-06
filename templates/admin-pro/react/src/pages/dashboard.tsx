// src/pages/dashboard.tsx —— 仪表盘：统计卡 + 趋势/订单构成图表 + 最近订单 + 热销 Top5 + 快捷操作
//    本模版改为「range 状态 → 派生 JSON attribute」的声明式渲染，7/14/30 切换只 setRange，
//    图表 data、订单表 data、donut 图例随重渲染自动联动（oas-chart/oas-table 的 data setter
//    均接受 JSON 字符串，见组件源码 normalizeData/set data）
// 3. 事件绑定：oas-segmented 的 oas-change 走 useOasEvent（React 19 不绑 kebab 事件，见 AGENTS.md）；
//    刷新/导出/查看全部为原生 click，直绑 onClick（目标不在 drawer/modal panel 内）
//    hash/history 双模式按存储值生成），与壳层导航同一出处
//    后整页重渲染，rules/columns/options 等 JSON attribute 随之重算
import { useEffect, useRef, useState } from 'react'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { routeHref } from '../router/mode'
import { session } from '../store/session'
import { listProducts } from '../data/products'
import { orderBreakdown, recentOrders, trendDays, trendSeries } from '../data/dashboard'

interface StatDef {
  testid?: string
  icon: string
  tone: string
  labelKey: string
  value: number
  suffix?: string
  delta: number
}

const STATS: StatDef[] = [
  {
    testid: 'stat-visits',
    icon: 'eye',
    tone: 'blue',
    labelKey: 'dashboard.stat.visits',
    value: 12480,
    delta: 12.4,
  },
  { icon: 'user', tone: 'green', labelKey: 'dashboard.stat.users', value: 328, delta: 8.2 },
  { icon: 'arrow-up', tone: 'violet', labelKey: 'dashboard.stat.orders', value: 1926, delta: 3.1 },
  {
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

interface Top5Row {
  name: string
  category: string
  sold: number
}

function todayLabel(locale: string): string {
  const tag = locale === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(),
  )
}

function trendLabels(
  days: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string[] {
  return trendDays(days).map((d) => (d === '' ? '' : t('dashboard.rangeDays', { days: d })))
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatMoney(n: number): string {
  return `¥ ${formatNumber(n)}`
}

function getToneVars(tone: string): { bg: string; icon: string } {
  if (tone === 'blue') return { bg: 'var(--oas-color-primary)', icon: 'var(--oas-color-primary)' }
  if (tone === 'green') return { bg: 'var(--oas-color-success)', icon: 'var(--oas-color-success)' }
  if (tone === 'violet') return { bg: 'var(--oas-tint-violet)', icon: 'var(--oas-tint-violet)' }
  return { bg: 'var(--oas-color-warning)', icon: 'var(--oas-color-warning)' }
}

export default function DashboardPage() {
  const { t, locale } = useT()
  const user = session.user
  const name = user?.name ?? ''
  const isAdmin = user?.role === 'admin'

  // 统计卡 skeleton 加载态（vanilla：300ms 后 fillStats）
  const [statsReady, setStatsReady] = useState(false)
  // 7/14/30 天联动：vanilla currentRange 局部变量
  const [range, setRange] = useState('7')
  // 热销 Top5：vanilla loadTop5() 异步拉取（null = 加载中，对齐 vanilla 初始空容器）
  const [top5, setTop5] = useState<Top5Row[] | null>(null)
  const segmentedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setStatsReady(true), 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let alive = true
    void listProducts().then((products) => {
      if (!alive) return
      setTop5(
        products
          .filter((p) => p.sold != null)
          .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
          .slice(0, 5)
          .map((p) => ({ name: p.name, category: p.category, sold: p.sold ?? 0 })),
      )
    })
    return () => {
      alive = false
    }
  }, [])

  // 天数切换联动：oas-segmented 的 oas-change 走 useOasEvent
  useOasEvent<{ value: string }>(segmentedRef, 'oas-change', (detail) => {
    setRange(detail.value)
  })

  const days = Number(range)
  const breakdown = orderBreakdown(days)

  // 复杂数据走 JSON attribute 通道（AGENTS.md 第 3 条）
  const segmentedOptions = JSON.stringify([
    { label: t('dashboard.rangeDays', { days: '7' }), value: '7' },
    { label: t('dashboard.rangeDays', { days: '14' }), value: '14' },
    { label: t('dashboard.rangeDays', { days: '30' }), value: '30' },
  ])
  const trendData = JSON.stringify({
    labels: trendLabels(days, t),
    series: [{ name: t('dashboard.stat.visits'), data: trendSeries(days) }],
  })
  const trendOptions = JSON.stringify({ smooth: true, gradient: true })
  const donutData = JSON.stringify(
    breakdown.slices.map((s) => ({ label: t(`orders.status.${s.status}`), value: s.value })),
  )
  const donutOptions = JSON.stringify({ colors: DONUT_COLORS })
  const orderColumns = JSON.stringify([
    { key: 'id', title: t('orders.th.no') },
    { key: 'customer', title: t('orders.th.customer') },
    { key: 'amount', title: t('orders.th.amount') },
    { key: 'status', title: t('orders.th.status') },
  ])
  const orderRows = JSON.stringify(
    recentOrders(days).map((r) => ({
      id: r.id,
      customer: r.customer,
      amount: formatMoney(r.amount),
      status: t(`orders.status.${r.status}`),
    })),
  )

  const quickActions = [
    { href: routeHref('/form'), icon: 'plus', label: t('nav.createOrder') },
    ...(isAdmin
      ? [{ href: routeHref('/products'), icon: 'edit', label: t('products.newProduct') }]
      : []),
    { href: routeHref('/orders'), icon: 'calendar', label: t('nav.orders') },
    ...(isAdmin ? [{ href: routeHref('/users'), icon: 'user', label: t('nav.users') }] : []),
  ]

  // 刷新：数据全部由 range/state 派生，重渲染即最新，仅保留提示（对齐 vanilla 提示行为）
  const refresh = () => appMessage.success(t('dashboard.refreshed'))
  const exportDemo = () => appMessage.info(t('dashboard.demoExport'))
  const viewAllOrders = () => appMessage.info(t('dashboard.demoOrders'))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.dashboard')}</h1>
          <p className="page-subtitle">
            {t('dashboard.welcome', { name, date: todayLabel(locale) })}
          </p>
        </div>
        <oas-space>
          <oas-button id="dash-refresh" icon="refresh" onClick={refresh}>
            {t('common.refresh')}
          </oas-button>
          <oas-button id="dash-export" icon="download" onClick={exportDemo}>
            {t('dashboard.export')}
          </oas-button>
        </oas-space>
      </div>

      <div className="stat-grid" id="stat-grid">
        {statsReady
          ? STATS.map((s) => {
              const tone = getToneVars(s.tone)
              const arrow = s.delta >= 0 ? 'arrow-up' : 'arrow-down'
              const deltaCls = s.delta >= 0 ? 'delta-up' : 'delta-down'
              return (
                <oas-card key={s.labelKey} className="stat-card" data-testid={s.testid}>
                  <div className="stat-row">
                    <div
                      className="stat-icon"
                      style={
                        {
                          '--stat-icon-bg': tone.bg,
                          '--stat-icon-color': tone.icon,
                        } as React.CSSProperties
                      }
                    >
                      <oas-icon name={s.icon} size="16" />
                    </div>
                    <div className="stat-body">
                      <div className="stat-label">{t(s.labelKey)}</div>
                      <div className="stat-value mono">
                        {formatNumber(s.value)}
                        {s.suffix ?? ''}
                      </div>
                      <div className="stat-delta">
                        <oas-icon name={arrow} size="12" className={deltaCls} />
                        <span className={deltaCls}>
                          {s.delta > 0 ? '+' : ''}
                          {s.delta}%
                        </span>
                        <span className="stat-delta-label">{t('dashboard.vsYesterday')}</span>
                      </div>
                    </div>
                  </div>
                </oas-card>
              )
            })
          : Array.from({ length: 4 }, (_, i) => (
              <oas-card key={i} className="stat-card stat-card--skeleton">
                <oas-skeleton active rows="3" />
              </oas-card>
            ))}
      </div>

      <div className="chart-grid">
        <oas-card title={t('dashboard.trendTitle')}>
          <oas-segmented
            ref={segmentedRef}
            id="trend-range"
            slot="extra"
            options={segmentedOptions}
            value={range}
          />
          <oas-chart
            id="chart-trend"
            className="chart"
            type="area"
            options={trendOptions}
            data={trendData}
            aria-label={t('dashboard.trendTitle')}
          />
        </oas-card>
        <oas-card title={t('dashboard.ordersTitle')}>
          <oas-chart
            id="chart-orders"
            className="chart"
            type="donut"
            options={donutOptions}
            data={donutData}
            aria-label={t('dashboard.ordersTitle')}
          />
          <div id="donut-legend-wrap">
            <div className="donut-legend" data-testid="donut-legend">
              <div className="donut-total">
                <span className="mono">{formatNumber(breakdown.total)}</span>
                <span>{t('dashboard.ordersLabel')}</span>
              </div>
              <div className="donut-legend-items">
                {breakdown.slices.map((s, i) => {
                  const pct = Math.round((s.value / breakdown.total) * 100)
                  return (
                    <span
                      key={s.status}
                      className="donut-legend-item"
                      style={{ '--dot': DONUT_COLORS[i] } as React.CSSProperties}
                    >
                      <i className="donut-dot" />
                      <span>{t(`orders.status.${s.status}`)}</span>
                      <span className="donut-legend-pct mono">{pct}%</span>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </oas-card>
      </div>

      <div className="bottom-grid">
        <oas-card title={t('dashboard.recentOrders')}>
          <button id="orders-view-all" className="link-btn" slot="extra" onClick={viewAllOrders}>
            {t('dashboard.viewAll')} <oas-icon name="chevron-right" size="12" />
          </button>
          <oas-table
            data-testid="orders-table"
            row-key="id"
            columns={orderColumns}
            data={orderRows}
          />
        </oas-card>
        <oas-card title={t('dashboard.topProducts')}>
          <a className="link-btn" href={routeHref('/products')} slot="extra">
            {t('dashboard.viewAll')} <oas-icon name="chevron-right" size="12" />
          </a>
          <div id="top5-list" data-testid="top5-list" className="top5-list">
            {top5 !== null &&
              (top5.length === 0 ? (
                <oas-empty description={t('dashboard.noTop5')} />
              ) : (
                top5.map((p, i) => {
                  const pct = Math.round((p.sold / (top5[0]?.sold ?? 1)) * 100)
                  return (
                    <div className="top5-row" key={p.name}>
                      <span className={`top5-rank rank-${i + 1}`}>{i + 1}</span>
                      <div className="top5-main">
                        <div className="top5-line">
                          <span className="top5-name" title={p.name}>
                            {p.name}
                          </span>
                          <oas-tag className="top5-tag">{p.category}</oas-tag>
                        </div>
                        <div className="top5-line top5-foot">
                          <oas-progress className="top5-bar" percent={pct} show-text="false" />
                          <span className="top5-sold mono">{p.sold}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ))}
          </div>
        </oas-card>
        <oas-card className="quick-card" title={t('dashboard.quickActions')}>
          <div className="quick-actions" data-testid="quick-actions">
            {quickActions.map((a) => (
              <a className="quick-action" href={a.href} key={a.href}>
                <oas-icon name={a.icon} size="16" />
                <span>{a.label}</span>
              </a>
            ))}
          </div>
          <div className="quick-foot">{t('dashboard.techNote')}</div>
        </oas-card>
      </div>
    </div>
  )
}
