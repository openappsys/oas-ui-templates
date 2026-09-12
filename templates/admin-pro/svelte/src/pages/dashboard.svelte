<script lang="ts">
  // src/pages/dashboard.svelte —— 仪表盘：统计卡 + 趋势/订单构成图表 + 最近订单 + 热销 Top5 + 快捷操作
  // range 状态驱动：7/14/30 切换只改 range（onoas-change 直绑 segmented），图表/订单表/图例
  // 随 $derived / $effect 联动（对齐 react 版「range 状态 → 派生数据」的声明式渲染）。
  // oas-chart / oas-table 数据走 property 通道（bind:this + $effect 赋值，计划纪律第 3 条）：
  // property setter 收原生对象（见组件源码 set data/set columns），比 JSON attribute 少一层序列化；
  // effect 依赖 days + $locale，切天数/切语言自动重赋值，组件内部整体重绘。
  // 商品列表（热销 Top5 数据源）用 listProducts 异步拉取进 $state（等价 react useQuery 缓存）；
  // 统计卡先 skeleton 300ms 再换实卡。
  import "./dashboard.css"
  import { useT } from "../lib/use-t.svelte"
  import { appMessage } from "../lib/app-message"
  import { routeHref } from "../router/mode"
  import { session } from "../store/session"
  import { listProducts, type ProductRow } from "../data/products"
  import { orderBreakdown, recentOrders, trendDays, trendSeries } from "../data/dashboard"

  /** oas-chart property 通道（bind:this 拿到的 host 元素） */
  interface ChartElement extends HTMLElement {
    data: unknown
    options: unknown
  }

  /** oas-table property 通道（columns 含 render 函数时必须走 property，attribute 序列化会丢函数） */
  interface TableElement extends HTMLElement {
    columns: unknown
    data: unknown
  }

  interface StatDef {
    testid?: string
    icon: string
    tone: string
    labelKey: string
    value: number
    suffix?: string
    delta: number
  }

  interface QuickAction {
    href: string
    icon: string
    label: string
  }

  const STATS: StatDef[] = [
    {
      testid: "stat-visits",
      icon: "eye",
      tone: "blue",
      labelKey: "dashboard.stat.visits",
      value: 12480,
      delta: 12.4,
    },
    { icon: "user", tone: "green", labelKey: "dashboard.stat.users", value: 328, delta: 8.2 },
    { icon: "arrow-up", tone: "violet", labelKey: "dashboard.stat.orders", value: 1926, delta: 3.1 },
    {
      icon: "clock",
      tone: "orange",
      labelKey: "dashboard.stat.conversion",
      value: 4.6,
      suffix: "%",
      delta: -0.4,
    },
  ]

  const DONUT_COLORS = [
    "var(--oas-color-success)",
    "var(--oas-color-primary)",
    "var(--oas-color-warning)",
    "var(--oas-color-danger)",
  ]

  function todayLabel(locale: string): string {
    const tag = locale === "en" ? "en-US" : "zh-CN"
    return new Intl.DateTimeFormat(tag, { year: "numeric", month: "long", day: "numeric" }).format(
      new Date(),
    )
  }

  function trendLabels(
    days: number,
    t: (key: string, params?: Record<string, string | number>) => string,
  ): string[] {
    return trendDays(days).map((d) => (d === "" ? "" : t("dashboard.rangeDays", { days: d })))
  }

  function formatNumber(n: number): string {
    return n.toLocaleString("en-US")
  }

  function formatMoney(n: number): string {
    return `¥ ${formatNumber(n)}`
  }

  function getToneVars(tone: string): { bg: string; icon: string } {
    if (tone === "blue") return { bg: "var(--oas-color-primary)", icon: "var(--oas-color-primary)" }
    if (tone === "green")
      return { bg: "var(--oas-color-success)", icon: "var(--oas-color-success)" }
    if (tone === "violet")
      return { bg: "var(--oas-tint-violet)", icon: "var(--oas-tint-violet)" }
    return { bg: "var(--oas-color-warning)", icon: "var(--oas-color-warning)" }
  }

  /** 统计卡图标内联变量（scoped style 不便穿透自定义元素，走 style attribute 与 react 版等价） */
  function statIconStyle(tone: string): string {
    const v = getToneVars(tone)
    return `--stat-icon-bg: ${v.bg}; --stat-icon-color: ${v.icon}`
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const user = session.user
  const name = user?.name ?? ""
  const isAdmin = user?.role === "admin"

  let statsReady = $state(false)
  let range = $state("7")

  // 统计卡 skeleton 300ms → 实卡（对齐 react 版延时）
  $effect(() => {
    const timer = setTimeout(() => (statsReady = true), 300)
    return () => clearTimeout(timer)
  })

  // 热销 Top5：与商品列表同源（商品变更失效后重进页面即联动）
  let products = $state<ProductRow[] | null>(null)
  $effect(() => {
    let cancelled = false
    listProducts().then((rows) => {
      if (!cancelled) products = rows
    })
    return () => {
      cancelled = true
    }
  })

  const top5 = $derived.by(() => {
    if (!products) return null
    return products
      .filter((p) => p.sold != null)
      .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
      .slice(0, 5)
      .map((p) => ({ name: p.name, category: p.category, sold: p.sold ?? 0 }))
  })

  const days = $derived(Number(range))
  const breakdown = $derived(orderBreakdown(days))

  const welcome = $derived.by(() => {
    void $locale
    return t("dashboard.welcome", { name, date: todayLabel($locale) })
  })

  // 纯数据走 JSON attribute：segmented 选项（切语言随 $locale 重算）
  const segmentedOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([
      { label: t("dashboard.rangeDays", { days: "7" }), value: "7" },
      { label: t("dashboard.rangeDays", { days: "14" }), value: "14" },
      { label: t("dashboard.rangeDays", { days: "30" }), value: "30" },
    ])
  })

  const onRangeChange = (e: Event): void => {
    range = (e as CustomEvent<{ value: string }>).detail.value
  }

  // ---- property 通道：oas-chart / oas-table 数据（依赖 days + $locale，联动重赋值）----
  let trendChartEl = $state<ChartElement | null>(null)
  $effect(() => {
    void $locale
    const el = trendChartEl
    if (!el) return
    el.options = { smooth: true, gradient: true }
    el.data = {
      labels: trendLabels(days, t),
      series: [{ name: t("dashboard.stat.visits"), data: trendSeries(days) }],
    }
  })

  let donutChartEl = $state<ChartElement | null>(null)
  $effect(() => {
    void $locale
    const el = donutChartEl
    if (!el) return
    el.options = { colors: DONUT_COLORS }
    el.data = breakdown.slices.map((s) => ({ label: t(`orders.status.${s.status}`), value: s.value }))
  })

  let ordersTableEl = $state<TableElement | null>(null)
  $effect(() => {
    void $locale
    const el = ordersTableEl
    if (!el) return
    el.columns = [
      { key: "id", title: t("orders.th.no") },
      { key: "customer", title: t("orders.th.customer") },
      { key: "amount", title: t("orders.th.amount") },
      { key: "status", title: t("orders.th.status") },
    ]
    el.data = recentOrders(days).map((r) => ({
      id: r.id,
      customer: r.customer,
      amount: formatMoney(r.amount),
      status: t(`orders.status.${r.status}`),
    }))
  })

  // 快捷操作按角色条件渲染（admin 多两条入口）
  const quickActions = $derived.by<QuickAction[]>(() => {
    void $locale
    return [
      { href: routeHref("/form"), icon: "plus", label: t("nav.createOrder") },
      ...(isAdmin
        ? [{ href: routeHref("/products"), icon: "edit", label: t("products.newProduct") }]
        : []),
      { href: routeHref("/orders"), icon: "calendar", label: t("nav.orders") },
      ...(isAdmin ? [{ href: routeHref("/users"), icon: "user", label: t("nav.users") }] : []),
    ]
  })

  const refresh = (): void => {
    appMessage.success(t("dashboard.refreshed"))
  }
  const exportDemo = (): void => {
    appMessage.info(t("dashboard.demoExport"))
  }
  const viewAllOrders = (): void => {
    appMessage.info(t("dashboard.demoOrders"))
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt("nav.dashboard")}</h1>
      <p class="page-subtitle">{welcome}</p>
    </div>
    <oas-space>
      <oas-button id="dash-refresh" icon="refresh" onclick={refresh}>
        {tt("common.refresh")}
      </oas-button>
      <oas-button id="dash-export" icon="download" onclick={exportDemo}>
        {tt("dashboard.export")}
      </oas-button>
    </oas-space>
  </div>

  <div class="stat-grid" id="stat-grid">
    {#if statsReady}
      {#each STATS as s (s.labelKey)}
        <oas-card class="stat-card" data-testid={s.testid}>
          <div class="stat-row">
            <div class="stat-icon" style={statIconStyle(s.tone)}>
              <oas-icon name={s.icon} size="16"></oas-icon>
            </div>
            <div class="stat-body">
              <div class="stat-label">{tt(s.labelKey)}</div>
              <div class="stat-value mono">{formatNumber(s.value)}{s.suffix ?? ""}</div>
              <div class="stat-delta">
                <oas-icon name={s.delta >= 0 ? "arrow-up" : "arrow-down"} size="12" class={s.delta >= 0 ? "delta-up" : "delta-down"}></oas-icon>
                <span class={s.delta >= 0 ? "delta-up" : "delta-down"}>
                  {s.delta > 0 ? "+" : ""}{s.delta}%
                </span>
                <span class="stat-delta-label">{tt("dashboard.vsYesterday")}</span>
              </div>
            </div>
          </div>
        </oas-card>
      {/each}
    {:else}
      {#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
        <oas-card class="stat-card stat-card--skeleton">
          <oas-skeleton active rows="3"></oas-skeleton>
        </oas-card>
      {/each}
    {/if}
  </div>

  <div class="chart-grid">
    <oas-card title={tt("dashboard.trendTitle")}>
      <oas-segmented
        id="trend-range"
        slot="extra"
        options={segmentedOptions}
        value={range}
        onoas-change={onRangeChange}
      ></oas-segmented>
      <oas-chart
        bind:this={trendChartEl}
        id="chart-trend"
        class="chart"
        type="area"
        aria-label={tt("dashboard.trendTitle")}
      ></oas-chart>
    </oas-card>
    <oas-card title={tt("dashboard.ordersTitle")}>
      <oas-chart
        bind:this={donutChartEl}
        id="chart-orders"
        class="chart"
        type="donut"
        aria-label={tt("dashboard.ordersTitle")}
      ></oas-chart>
      <div id="donut-legend-wrap">
        <div class="donut-legend" data-testid="donut-legend">
          <div class="donut-total">
            <span class="mono">{formatNumber(breakdown.total)}</span>
            <span>{tt("dashboard.ordersLabel")}</span>
          </div>
          <div class="donut-legend-items">
            {#each breakdown.slices as s, i (s.status)}
              <span class="donut-legend-item" style={`--dot: ${DONUT_COLORS[i]}`}>
                <i class="donut-dot"></i>
                <span>{tt(`orders.status.${s.status}`)}</span>
                <span class="donut-legend-pct mono">
                  {Math.round((s.value / breakdown.total) * 100)}%
                </span>
              </span>
            {/each}
          </div>
        </div>
      </div>
    </oas-card>
  </div>

  <div class="bottom-grid">
    <oas-card title={tt("dashboard.recentOrders")}>
      <button id="orders-view-all" class="link-btn" slot="extra" onclick={viewAllOrders}>
        {tt("dashboard.viewAll")}
        <oas-icon name="chevron-right" size="12"></oas-icon>
      </button>
      <oas-table bind:this={ordersTableEl} data-testid="orders-table" row-key="id"></oas-table>
    </oas-card>
    <oas-card title={tt("dashboard.topProducts")}>
      <a class="link-btn" href={routeHref("/products")} slot="extra">
        {tt("dashboard.viewAll")}
        <oas-icon name="chevron-right" size="12"></oas-icon>
      </a>
      <div id="top5-list" data-testid="top5-list" class="top5-list">
        {#if top5 !== null}
          {#if top5.length === 0}
            <oas-empty description={tt("dashboard.noTop5")}></oas-empty>
          {:else}
            {#each top5 as p, i (p.name)}
              <div class="top5-row">
                <span class="top5-rank rank-{i + 1}">{i + 1}</span>
                <div class="top5-main">
                  <div class="top5-line">
                    <span class="top5-name" title={p.name}>{p.name}</span>
                    <oas-tag class="top5-tag">{p.category}</oas-tag>
                  </div>
                  <div class="top5-line top5-foot">
                    <oas-progress
                      class="top5-bar"
                      percent={Math.round((p.sold / (top5[0]?.sold ?? 1)) * 100)}
                      show-text="false"
                    ></oas-progress>
                    <span class="top5-sold mono">{p.sold}</span>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        {/if}
      </div>
    </oas-card>
    <oas-card class="quick-card" title={tt("dashboard.quickActions")}>
      <div class="quick-actions" data-testid="quick-actions">
        {#each quickActions as a (a.href)}
          <a class="quick-action" href={a.href}>
            <oas-icon name={a.icon} size="16"></oas-icon>
            <span>{a.label}</span>
          </a>
        {/each}
      </div>
      <div class="quick-foot">{tt("dashboard.techNote")}</div>
    </oas-card>
  </div>
</div>
