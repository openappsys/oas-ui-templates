<script setup lang="ts">
// src/pages/orders-table.vue —— 订单列表表格（oas-table 内置分页 + 状态/金额/品名 render 列）
// 行为事实来源：vanilla-html/src/pages/orders.ts 的 TABLE_COLUMNS/statusCell/moneyCell/
// itemSummary 段（react 版同期并行中仍为占位，以 vanilla 为准；拆分边界参照 users-table.vue 先例）
// 偏差记录（因果链）：
// 1. columns 含 render 函数（items 文本摘要/金额 mono/状态标签），JSON 序列化会丢函数，故走
//    property 通道：Vue 3.5 对有 setter 的 custom element 直接 property 赋值（AGENTS.md 第 3 条，
//    oas-table columns setter 双通道接受）；computed 按 locale 重建，对齐 vanilla renderTable
//    里 table.columns = TABLE_COLUMNS() 的时机
// 2. data 传 JSON 字符串（贴近 vanilla setAttribute('data') 通道）；空态时父组件传空数组，
//    等价 vanilla setEmpty(true) 的 table.setAttribute('data','[]')（空态 overlay 由父组件显示）
// 3. 布尔 attribute 存在性语义：loading/pagination 按第 2 条纪律绑定；current 复位经
//    defineExpose 的 resetPage 走同一 setAttribute 通道（users-table.vue 同款）
// 4. 状态标签配色：vanilla setTagType 对 purple 写 color 属性并摘 type，其余反之；本模版用
//    :type/:color 三元绑定（null = 移除属性）达到同一 DOM 结果
import { computed, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import type { OrderRow } from '../data/orders'
import { readPageSize } from '../settings-init'
import { useT } from '../composables/use-t'

const props = defineProps<{
  rows: OrderRow[]
  /** 筛选结果为空：表格隐藏（empty-overlay 由父组件显示） */
  empty: boolean
  loading: boolean
}>()
const emit = defineEmits<{
  'row-click': [id: string]
}>()

const { t: tt, locale } = useT()

const tableRef = ref<HTMLElement | null>(null)

// vanilla pageSize()：每页条数跟随设置中心，未设置时默认 8（页面生命周期内读取一次）
const pageSize = (() => {
  const raw = localStorage.getItem('oas-admin.settings.page-size')
  return raw ? Number(raw) || 8 : 8
})()

// vanilla statusLabel
function statusLabel(status: OrderRow['status']): string {
  return tt(`orders.status.${status}`)
}

// vanilla STATUS_TAG
const STATUS_TAG: Record<OrderRow['status'], string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

// vanilla formatMoney
function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

// vanilla itemSummary：≤2 项直接拼接，超出取前 2 项 + 总数文案
function itemSummary(items: string[]): string {
  if (items.length <= 2) return items.join(tt('orders.itemJoin'))
  return tt('orders.itemSummary', {
    names: items.slice(0, 2).join(tt('orders.itemJoin')),
    total: items.length,
  })
}

// vanilla statusCell（oas-tag 文本 + 配色）
function statusCell(row: OrderRow): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.textContent = statusLabel(row.status)
  const type = STATUS_TAG[row.status]
  if (type === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', type)
    tag.removeAttribute('color')
  }
  return tag
}

// vanilla moneyCell
function moneyCell(row: OrderRow): HTMLElement {
  const span = document.createElement('span')
  span.className = 'mono'
  span.textContent = formatMoney(row.amount)
  return span
}

// vanilla TABLE_COLUMNS()：品名列 ellipsis 文本、金额列右对齐 + summary 合计
const columns = computed<TableColumn[]>(() => {
  void locale.value
  return [
    { key: 'no', title: '#', serialNumber: true, width: '48px' },
    { key: 'id', title: tt('orders.th.no') },
    { key: 'customer', title: tt('orders.th.customer') },
    {
      key: 'items',
      title: tt('orders.th.items'),
      ellipsis: true,
      render: (r) => String(itemSummary((r as unknown as OrderRow).items)),
    },
    {
      key: 'amount',
      title: tt('orders.th.amount'),
      align: 'right',
      summary: 'sum',
      render: (r) => moneyCell(r as unknown as OrderRow),
    },
    {
      key: 'status',
      title: tt('orders.th.status'),
      render: (r) => statusCell(r as unknown as OrderRow),
    },
    { key: 'created', title: tt('orders.th.created') },
  ]
})
// data 走 JSON 字符串通道（AGENTS.md 第 3 条）
const rowsJson = computed(() => JSON.stringify(props.rows))

// vanilla oas-row-click 段：detail.row 为原始 OrderRow，按 id 上抛
function onRowClick(e: Event): void {
  const row = (e as CustomEvent<{ row: Record<string, unknown> }>).detail.row
  const id = row?.id ? String(row.id) : ''
  if (id) emit('row-click', id)
}

// vanilla 搜索/切 tab/清筛选时的命令式复位（current 非受控属性）
function resetPage(): void {
  tableRef.value?.setAttribute('current', '1')
}
defineExpose({ resetPage })
</script>

<template>
  <oas-table
    ref="tableRef"
    data-testid="orders-list"
    row-key="id"
    :empty-text="tt('orders.empty')"
    pagination
    :page-size="pageSize"
    :class="{ 'table-hidden': empty }"
    :columns="columns"
    :data="rowsJson"
    :loading="loading ? '' : null"
    @oas-row-click="onRowClick"
  />
</template>
