<script setup lang="ts">
// src/pages/orders.vue —— 订单管理（统计卡 + 状态页签 + 表格 + 详情抽屉 + CSV 导出）
// 行为事实来源：vanilla-html/src/pages/orders.ts（448 行，逐块对齐）；
// react 版同期并行开发中仍为占位，以 vanilla 为准（拆分边界参照 users/products 先例）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + setAttribute 回写 + renderTable/renderStats/
//    renderTabs 手动刷）；本模版声明式——rows/keyword/status/selectedId/scopeVisible 全部 ref，
//    表格数据/统计卡/页签 badge/空态显隐由 state 派生；refresh() 仅重拉数据写 ref
// 2. 子组件拆分（单文件 ≤400 行纪律）：表格 ./orders-table.vue（render 列）、详情抽屉
//    ./orders-drawer.vue；TABS/FLOW_TO/STATUS_TAG 等纯映射按 vanilla 分布就近放置
// 3. 事件绑定：oas-input/oas-tabs 的 oas-input/oas-clear/oas-change 模板直绑（AGENTS.md 第 1 条）；
//    导出/清筛选按钮原生 click 直绑 @click；行点击经子组件上抛 id
// 4. viewer 数据范围：vanilla refresh() 里按 session.user.role 过滤 + 显示 scope 提示；本模版
//    同逻辑在 refresh 内做（session 为模块级状态，登录后页面重挂载才变，非响应式取值）
// 5. 流程操作：vanilla 抽屉按钮 click 里 updateOrderStatus → message → refresh → 回填抽屉；
//    本模版抽屉上抛 flow(to)，父组件执行持久化/提示/刷新，抽屉行由 state 派生自动更新；
//    flowing ref 对齐 vanilla 按钮 loading attribute 时机
// 6. 完整详情链接：vanilla 写 sessionStorage('order-detail-id') + href="#/order-detail"；
//    本模版 RouterLink 携带 query id（orders-drawer.vue 内），偏差因果在该文件头记录
// 7. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换 + renderStats/renderTabs/
//    renderTable 重建；本模版 useT() 订阅后整页重渲染，统计/页签/表格列随 locale 自动重算
// 8. 布尔 attribute 存在性语义：drawer visible/scope hidden/loading 走 `cond ? '' : null`
//    （AGENTS.md 第 2 条）；表格 current 复位经子组件 resetPage 的 setAttribute 通道
import { computed, onMounted, ref } from 'vue'
import { listOrders, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'
import { session } from '../store/session'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import OrdersDrawer from './orders-drawer.vue'
import OrdersTable from './orders-table.vue'

// vanilla TABS()：状态页签集合（label 随 locale 重算）
const TAB_KEYS = ['all', 'pending', 'paid', 'shipping', 'done', 'cancelled'] as const
type TabValue = (typeof TAB_KEYS)[number]

// vanilla FLOW_TO：状态流转的下一步映射
const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const rows = ref<OrderRow[]>([])
const keyword = ref('')
const status = ref<TabValue>('all')
const selectedId = ref<string | null>(null)
const drawerOpen = ref(false)
const scopeVisible = ref(false)
const loading = ref(false)
const flowing = ref(false)

const tableRef = ref<InstanceType<typeof OrdersTable> | null>(null)

// vanilla refresh()：拉取 + viewer 范围过滤（creator === 本人时显示提示条）
async function refresh(): Promise<void> {
  loading.value = true
  let list = await listOrders()
  const u = session.user
  if (u?.role === 'viewer') {
    list = list.filter((r) => r.creator === u.name)
    scopeVisible.value = true
  } else {
    scopeVisible.value = false
  }
  rows.value = list
  loading.value = false
}
onMounted(() => void refresh())

// vanilla filtered()：状态页签精确匹配 + 关键字（小写包含）匹配客户名
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (status.value !== 'all' && r.status !== status.value) return false
    if (kw && !r.customer.toLowerCase().includes(kw)) return false
    return true
  })
})
const empty = computed(() => filtered.value.length === 0)

// vanilla renderTabs：每页签带状态计数 badge（all = 全量）
const tabs = computed(() => {
  void locale.value
  const counts: Record<string, number> = { all: rows.value.length }
  for (const r of rows.value) counts[r.status] = (counts[r.status] ?? 0) + 1
  return TAB_KEYS.map((value) => ({
    value,
    label: value === 'all' ? t('orders.tabAll') : t(`orders.status.${value}`),
    badge: counts[value] ? String(counts[value]) : null,
  }))
})

// vanilla renderStats：待处理（pending+paid）、本月销售额、完成率
const stats = computed(() => {
  void locale.value
  const pending = rows.value.filter((r) => r.status === 'pending' || r.status === 'paid').length
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const monthSales = rows.value
    .filter((r) => r.created.startsWith(monthPrefix))
    .reduce((sum, r) => sum + r.amount, 0)
  const doneRate = rows.value.length
    ? Math.round((rows.value.filter((r) => r.status === 'done').length / rows.value.length) * 100)
    : 0
  return {
    pending,
    monthSales: `¥ ${monthSales.toLocaleString('en-US')}`,
    doneRate,
  }
})

// vanilla openDrawer：记录选中行并打开抽屉
function onRowClick(id: string): void {
  selectedId.value = id
  drawerOpen.value = true
}

// 抽屉当前行（流程操作成功刷新后自动同步，对齐 vanilla refresh 后回填 tag/renderAction）
const selectedRow = computed(() => rows.value.find((r) => r.id === selectedId.value) ?? null)
const flowTo = computed(() => (selectedRow.value ? FLOW_TO[selectedRow.value.status] ?? null : null))

// vanilla order-detail-action click 段：loading → updateOrderStatus → 提示 → refresh（抽屉随 rows 派生更新）
// 提示文案的 action 参数为操作按钮文本（t('orders.flow.<操作前状态>')），对齐 vanilla
// 在点击时读 button.textContent 的取值时机
async function onFlow(to: OrderStatus): Promise<void> {
  if (!selectedId.value) return
  const actionLabel = t(`orders.flow.${selectedRow.value?.status ?? ''}`)
  flowing.value = true
  const updated = await updateOrderStatus(selectedId.value, to)
  flowing.value = false
  if (!updated) {
    appMessage.error(tt('orders.notFound'))
    return
  }
  appMessage.success(tt('orders.flowApplied', { action: actionLabel }))
  await refresh()
}

// vanilla orders-export click 段：空数据提示；否则拼 BOM CSV 下载
function onExport(): void {
  const list = filtered.value
  if (list.length === 0) {
    appMessage.info(tt('orders.noExportable'))
    return
  }
  const header = tt('orders.exportHeader')
  const body = list.map((r) =>
    [r.id, r.customer, r.amount, t(`orders.status.${r.status}`), r.items.join(' | '), r.created].join(','),
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

// vanilla orders-clear 段：关键字/状态/页码/搜索框值全部复位
function onClearFilters(): void {
  keyword.value = ''
  status.value = 'all'
  tableRef.value?.resetPage()
  searchRef.value?.setAttribute('value', '')
}

// vanilla search oas-input/oas-clear 段 + tabs oas-change 段（复位表格页码走子组件通道）
const searchRef = ref<HTMLElement | null>(null)
function onSearchInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value
  tableRef.value?.resetPage()
}
function onSearchClear(): void {
  keyword.value = ''
  tableRef.value?.resetPage()
}
function onTabChange(e: Event): void {
  const value = (e as CustomEvent<{ value: string }>).detail.value
  status.value = (value === 'all' ? 'all' : value) as TabValue
  tableRef.value?.resetPage()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.orders') }}</h1>
        <p class="page-subtitle">{{ t('orders.subtitle') }}</p>
      </div>
      <oas-button data-testid="orders-export" type="primary" icon="download" @click="onExport">
        {{ t('orders.exportCsv') }}
      </oas-button>
    </div>
    <div
      id="orders-scope"
      class="orders-scope"
      data-testid="orders-scope"
      :hidden="!scopeVisible"
    >
      <oas-icon size="16" name="info" />
      <span data-testid="orders-scope-text">{{ t('orders.scopeOnlySelf') }}</span>
    </div>
    <div id="orders-stats" class="orders-stats">
      <oas-card class="stat-card">
        <div class="stat-label">{{ t('orders.stat.pending') }}</div>
        <div class="stat-value mono">{{ stats.pending }}</div>
        <div class="stat-foot">{{ t('orders.stat.pendingHint') }}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">{{ t('orders.stat.monthSales') }}</div>
        <div class="stat-value mono">{{ stats.monthSales }}</div>
        <div class="stat-foot">{{ t('orders.stat.monthHint') }}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">{{ t('orders.stat.doneRate') }}</div>
        <div class="stat-value mono">{{ stats.doneRate }}%</div>
        <oas-progress class="stat-progress" :percent="stats.doneRate" show-text="false" />
      </oas-card>
    </div>
    <oas-card class="list-card" :title="t('orders.listTitle')">
      <div class="orders-toolbar" slot="extra">
        <oas-input
          ref="searchRef"
          data-testid="orders-search"
          :placeholder="t('orders.search')"
          clearable
          prefix-icon="search"
          @oas-input="onSearchInput"
          @oas-clear="onSearchClear"
        />
      </div>
      <oas-tabs
        data-testid="orders-tabs"
        id="orders-tabs"
        :active="status"
        @oas-change="onTabChange"
      >
        <oas-tab-panel
          v-for="tab in tabs"
          :key="tab.value"
          :label="tab.label"
          :value="tab.value"
          :badge="tab.badge"
        />
      </oas-tabs>
      <div class="table-wrap" id="orders-table-wrap" :class="{ 'is-empty': empty }">
        <OrdersTable ref="tableRef" :rows="filtered" :empty="empty" :loading="loading" @row-click="onRowClick" />
        <div class="empty-overlay" id="orders-empty" :hidden="!empty">
          <oas-empty :description="t('orders.empty')" />
          <oas-button id="orders-clear" type="primary" @click="onClearFilters">
            {{ t('common.clearFilter') }}
          </oas-button>
        </div>
      </div>
    </oas-card>

    <OrdersDrawer
      :open="drawerOpen"
      :row="selectedRow"
      :flow-to="flowTo"
      :flowing="flowing"
      @close="drawerOpen = false"
      @flow="void onFlow($event)"
    />
  </div>
</template>
