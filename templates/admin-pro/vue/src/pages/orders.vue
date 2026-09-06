<script setup lang="ts">
// src/pages/orders.vue —— 订单管理（统计卡 + 状态页签 + 表格 + 详情抽屉 + CSV 导出）
// 拆分边界参照 users/products 先例
//    renderTabs 手动刷）；本模版声明式——rows/keyword/status/selectedId/scopeVisible 全部 ref，
//    表格数据/统计卡/页签 badge/空态显隐由 state 派生；refresh() 仅重拉数据写 ref
// 2. 子组件拆分（单文件 ≤400 行纪律）：表格 ./orders-table.vue（render 列）、详情抽屉
// 3. 事件绑定：oas-input/oas-tabs 的 oas-input/oas-clear/oas-change 模板直绑//    导出/清筛选按钮原生 click 直绑 @click；行点击经子组件上抛 id
//    同逻辑在 refresh 内做（session 为模块级状态，登录后页面重挂载才变，非响应式取值）
//    本模版抽屉上抛 flow(to)，父组件执行持久化/提示/刷新，抽屉行由 state 派生自动更新；
//    本模版 RouterLink 携带 query id（orders-drawer.vue 内），偏差因果在该文件头记录
//    renderTable 重建；本模版 useT() 订阅后整页重渲染，统计/页签/表格列随 locale 自动重算
// 8. 布尔 attribute 存在性语义：drawer visible/scope hidden/loading 走 `cond ? '' : null`
//    表格 current 复位经子组件 resetPage 的 setAttribute 通道
import { computed, onMounted, ref } from 'vue'
import type { OrderStatus } from '../data/orders'
import { useT } from '../composables/use-t'
import { useOrderFlow, useOrdersList } from '../composables/use-orders'
import { appMessage } from '../lib/app-message'
import OrdersDrawer from './orders-drawer.vue'
import OrdersTable from './orders-table.vue'

const TAB_KEYS = ['all', 'pending', 'paid', 'shipping', 'done', 'cancelled'] as const
type TabValue = (typeof TAB_KEYS)[number]

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

// 订单数据：composable（列表 + viewer 只看自己 + 状态流转），会话从 Pinia store 取
const { rows, loading, scopeVisible, refresh } = useOrdersList()
const keyword = ref('')
const status = ref<TabValue>('all')
const selectedId = ref<string | null>(null)
const drawerOpen = ref(false)

const tableRef = ref<InstanceType<typeof OrdersTable> | null>(null)

onMounted(() => void refresh())

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (status.value !== 'all' && r.status !== status.value) return false
    if (kw && !r.customer.toLowerCase().includes(kw)) return false
    return true
  })
})
const empty = computed(() => filtered.value.length === 0)

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

function onRowClick(id: string): void {
  selectedId.value = id
  drawerOpen.value = true
}

const selectedRow = computed(() => rows.value.find((r) => r.id === selectedId.value) ?? null)
const flowTo = computed(() => (selectedRow.value ? FLOW_TO[selectedRow.value.status] ?? null : null))

// 状态流转：composable（flowing 状态 + 提示 + 刷新在 composable 内）
const { flowing, flow } = useOrderFlow({ refresh, selectedId, selectedRow })

function onFlow(to: OrderStatus): void {
  void flow(to)
}

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

function onClearFilters(): void {
  keyword.value = ''
  status.value = 'all'
  tableRef.value?.resetPage()
  searchRef.value?.setAttribute('value', '')
}

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

<style scoped>
/* 订单页样式（自 app.css 迁入）：仅本页使用的统计/工具栏/表格容器 */
.orders-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--oas-space-3);
  margin-bottom: var(--oas-space-3);
}
.orders-stats .stat-card {
  min-height: 96px;
}
.orders-stats .stat-value {
  margin: 4px 0;
}
.stat-progress {
  margin-top: var(--oas-space-2);
}
.stat-progress::part(track) {
  height: 6px;
}
.stat-progress::part(bar) {
  border-radius: inherit;
}

.orders-toolbar {
  display: flex;
  align-items: center;
  gap: var(--oas-space-2);
  flex-wrap: wrap;
}
.orders-toolbar oas-input {
  width: 220px;
}
.orders-toolbar {
  margin-bottom: var(--oas-space-3);
}

#orders-table-wrap {
  overflow: auto;
  border: 1px solid var(--oas-color-border);
  border-radius: var(--oas-radius-md);
}

@media (max-width: 768px) {
  .orders-stats {
    grid-template-columns: 1fr;
  }
}
</style>
