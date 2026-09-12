<script lang="ts">
  // src/pages/orders.svelte —— 订单管理（统计卡 + 状态 tabs + 表格 + 快捷详情抽屉 + CSV 导出）
  // 对齐 react 版 orders.tsx：列表数据挂载时经 listOrders 拉取（viewer 角色只看自己创建的订单，
  // 与 query 内过滤同语义），过滤/统计/tabs 徽标/空态全部由 rows + 过滤状态派生；
  // 状态流转成功后提示 + 异步刷新（抽屉行随刷新自动更新）。
  // 1. 搜索的 oas-input/oas-clear、tabs 的 oas-change、表格的 oas-row-click 模板直绑；
  //    导出/清筛选按钮为原生 click 直绑
  // 2. 搜索/切 tab 后经子组件 resetPage() 复位首屏（vanilla setAttribute('current','1') 同款）
  // 3. 子组件拆分（单文件 ≤400 行纪律）：表格 ./orders-table.svelte、快捷详情抽屉 ./orders-drawer.svelte
  import { onMount } from 'svelte'
  import { fromStore } from 'svelte/store'
  import '../styles/pages/orders.css'
  type OrderStatus = import('../data/orders').OrderStatus
  type OrderRow = import('../data/orders').OrderRow
  import { listOrders, updateOrderStatus } from '../data/orders'
  import { session } from '../store/session'
  import { PAGE_SIZE_KEY } from '../settings-init'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'
  import { sessionUser } from '../lib/session-user'
  import { statusLabel } from './orders-shared'
  import OrdersDrawer from './orders-drawer.svelte'
  import OrdersTable from './orders-table.svelte'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const user = fromStore(sessionUser)

  /** vanilla pageSize()：每页条数跟随设置中心；未设置时保持原默认 8 */
  function readPageSizeNum(): number {
    const raw = localStorage.getItem(PAGE_SIZE_KEY)
    return raw ? Number(raw) || 8 : 8
  }
  const pageSize = readPageSizeNum()

  /** vanilla TABS：全部 + 五状态（文案随 locale 重算） */
  const STATUS_KEYS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done', 'cancelled']

  let rows = $state<OrderRow[]>([])
  let loading = $state(true)
  let keyword = $state('')
  let status = $state<'all' | OrderStatus>('all')
  let selectedId = $state<string | null>(null)
  let drawerOpen = $state(false)

  let tableComp: ReturnType<typeof OrdersTable> | null = $state(null)
  let searchEl: HTMLElement | null = $state(null)
  let listCardEl: HTMLElement | null = $state(null)

  // title 命中 HTMLElement.prototype.title（property 通道会把未升级元素的 attribute 遮蔽掉），
  // oas-* 元素上的 title 必须走 setAttribute 通道
  $effect(() => {
    listCardEl?.setAttribute('title', tt('orders.listTitle'))
  })

  const isViewer = $derived(user.current?.role === 'viewer')

  /** 列表拉取：viewer 只能看自己创建的（过滤逻辑留在数据侧单一出口，与 react queryFn 对齐） */
  async function load(): Promise<void> {
    loading = true
    let list = await listOrders()
    const u = session.user
    if (u?.role === 'viewer') list = list.filter((r) => r.creator === u.name)
    rows = list
    loading = false
  }

  onMount(() => {
    void load()
  })

  const filtered = $derived.by(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (kw && !r.customer.toLowerCase().includes(kw)) return false
      return true
    })
  })

  const tabCounts = $derived.by(() => {
    const counts: Partial<Record<'all' | OrderStatus, number>> = { all: rows.length }
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1
    return counts
  })

  const stats = $derived.by(() => {
    const pending = rows.filter((r) => r.status === 'pending' || r.status === 'paid').length
    const monthPrefix = new Date().toISOString().slice(0, 7)
    const monthSales = rows
      .filter((r) => r.created.startsWith(monthPrefix))
      .reduce((sum, r) => sum + r.amount, 0)
    const doneRate = rows.length
      ? Math.round((rows.filter((r) => r.status === 'done').length / rows.length) * 100)
      : 0
    return { pending, monthSales, doneRate }
  })

  const tabItems = $derived.by(() => {
    void $locale
    return [
      { label: tt('orders.tabAll'), value: 'all' as 'all' | OrderStatus },
      ...STATUS_KEYS.map((s) => ({ label: statusLabel(s, tt), value: s as 'all' | OrderStatus })),
    ]
  })

  function backToFirstPage(): void {
    tableComp?.resetPage()
  }

  function onSearchInput(e: Event): void {
    keyword = (e as CustomEvent<{ value: string }>).detail.value
    backToFirstPage()
  }
  function onSearchClear(): void {
    keyword = ''
    backToFirstPage()
  }
  function onTabChange(e: Event): void {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    status = value === 'all' ? 'all' : (value as OrderStatus)
    backToFirstPage()
  }

  function onClearFilter(): void {
    keyword = ''
    status = 'all'
    backToFirstPage()
    searchEl?.setAttribute('value', '')
  }

  function onExport(): void {
    const list = filtered
    if (list.length === 0) {
      appMessage.info(tt('orders.noExportable'))
      return
    }
    const header = tt('orders.exportHeader')
    const body = list.map((r) =>
      [r.id, r.customer, r.amount, statusLabel(r.status, tt), r.items.join(' | '), r.created].join(
        ',',
      ),
    )
    const csv = `\ufeff${[header, ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    appMessage.success(tt('orders.exported', { count: list.length }))
  }

  function openDrawer(row: OrderRow): void {
    selectedId = row.id
    drawerOpen = true
  }

  /** 状态流转：提示 + 异步刷新（react 版失效缓存重取的同款可观察行为） */
  async function applyFlow(id: string, target: OrderStatus): Promise<void> {
    const prev = rows.find((r) => r.id === id)
    const updated = await updateOrderStatus(id, target)
    if (!updated) {
      appMessage.error(tt('orders.notFound'))
      return
    }
    appMessage.success(
      tt('orders.flowApplied', { action: prev ? tt(`orders.flow.${prev.status}`) : '' }),
    )
    void load()
  }

  const selectedRow = $derived(rows.find((r) => r.id === selectedId) ?? null)
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.orders')}</h1>
      <p class="page-subtitle">{tt('orders.subtitle')}</p>
    </div>
    <oas-button data-testid="orders-export" type="primary" icon="download" onclick={onExport}>
      {tt('orders.exportCsv')}
    </oas-button>
  </div>
  <div id="orders-scope" class="orders-scope" hidden={!isViewer}>
    <oas-icon size="16" name="info"></oas-icon>
    <span data-testid="orders-scope-text">{tt('orders.scopeOnlySelf')}</span>
  </div>
  <div class="orders-stats" id="orders-stats">
    <oas-card class="stat-card">
      <div class="stat-label">{tt('orders.stat.pending')}</div>
      <div class="stat-value mono">{stats.pending}</div>
      <div class="stat-foot">{tt('orders.stat.pendingHint')}</div>
    </oas-card>
    <oas-card class="stat-card">
      <div class="stat-label">{tt('orders.stat.monthSales')}</div>
      <div class="stat-value mono">{`¥ ${stats.monthSales.toLocaleString('en-US')}`}</div>
      <div class="stat-foot">{tt('orders.stat.monthHint')}</div>
    </oas-card>
    <oas-card class="stat-card">
      <div class="stat-label">{tt('orders.stat.doneRate')}</div>
      <div class="stat-value mono">{stats.doneRate}%</div>
      <oas-progress class="stat-progress" percent={stats.doneRate} show-text="false"></oas-progress>
    </oas-card>
  </div>
  <oas-card bind:this={listCardEl} class="list-card">
    <div class="orders-toolbar" slot="extra">
      <oas-input
        bind:this={searchEl}
        data-testid="orders-search"
        placeholder={tt('orders.search')}
        clearable
        prefix-icon="search"
        onoas-input={onSearchInput}
        onoas-clear={onSearchClear}
      ></oas-input>
    </div>
    <oas-tabs data-testid="orders-tabs" active={status} onoas-change={onTabChange}>
      {#each tabItems as item (item.value)}
        <oas-tab-panel
          label={item.label}
          value={item.value}
          badge={tabCounts[item.value] || null}
        ></oas-tab-panel>
      {/each}
    </oas-tabs>
    <OrdersTable
      bind:this={tableComp}
      rows={filtered}
      empty={filtered.length === 0}
      {loading}
      {pageSize}
      onRowOpen={openDrawer}
      onClearFilter={onClearFilter}
    />
  </oas-card>

  <OrdersDrawer
    open={drawerOpen}
    row={selectedRow}
    onClose={() => (drawerOpen = false)}
    onApplyFlow={applyFlow}
  />
</div>

<style>
  /* vanilla .orders-scope 内联样式（页面内的权限范围提示条） */
  .orders-scope {
    display: flex;
    align-items: center;
    gap: var(--oas-space-2);
    margin-bottom: var(--oas-space-3);
    padding: var(--oas-space-3) var(--oas-space-4);
    border: 1px solid color-mix(in srgb, var(--oas-color-info-text) 30%, transparent);
    border-radius: var(--oas-radius-md);
    background: color-mix(in srgb, var(--oas-color-info-text) 10%, transparent);
    color: var(--oas-color-text-primary);
    font-size: var(--oas-font-size-sm);
  }
  .orders-scope oas-icon {
    color: var(--oas-color-info-text);
    flex-shrink: 0;
  }
</style>
