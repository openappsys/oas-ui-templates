<script setup lang="ts">
// src/pages/products-table.vue —— 商品列表视图（oas-table + 空态 + 行内编辑 + 行事件）
// 行为事实来源：vanilla-html/src/pages/products.ts 的 TABLE_COLUMNS/cellXxx/renderTableBody 段，
// react/src/pages/products-table.tsx 为已验收参照（拆分边界/事件语义对齐）。
// 偏差记录（因果链）：
// 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道：
//    Vue 3.5 对有 setter 的 custom element 直接 property 赋值（AGENTS.md 第 3 条，oas-table
//    columns setter 双通道接受）；computed 按 locale 重建（对齐 vanilla refreshText 里
//    renderColumns 的时机），避免每次渲染重设 property 触发整表重绘
// 2. data/column-keys 传 JSON 字符串（贴近 vanilla setAttribute 通道）
// 3. 行内编辑/勾选/开关：oas-edit/oas-check/oas-change 自定义事件模板直绑（AGENTS.md 第 1 条，
//    无需 react 版 useOasEvent 桥接）；编辑按钮的原生 click 是 composed 事件，能冒泡出
//    oas-table shadow 到容器 div 的 @click（Vue 直绑元素本身，无 react 根委托问题），
//    composedPath 匹配 .product-edit（对齐 vanilla fromPath 的 matches 语义）
// 4. 空态：vanilla 手动切换 table-hidden 类与 empty 节点 hidden；本模版由 empty prop 派生
// 5. editable 布尔存在性语义：:editable="canMutate ? '' : null"（AGENTS.md 第 2 条）
import { computed, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import { stockLevel } from '../data/products'
import type { ProductRow } from '../data/products'
import { useT } from '../composables/use-t'
import type { ProductColumnKey } from './product-columns'

const props = defineProps<{
  /** 当前页切片（父组件手动分页，对齐 vanilla renderTableBody 的 slice） */
  rows: ProductRow[]
  columnKeys: ProductColumnKey[]
  canMutate: boolean
  /** 筛选结果为空：表格隐藏 + 空态显示 */
  empty: boolean
  /** 卡片视图时整个表格容器隐藏 */
  hidden: boolean
}>()
const emit = defineEmits<{
  'toggle-status': [id: number]
  'edit-row': [id: number]
  check: [keys: number[]]
  'inline-edit': [id: number, column: 'price' | 'stock', value: number]
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

type TFunc = (key: string, params?: Record<string, string | number>) => string

const tableRef = ref<HTMLElement | null>(null)

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

// 以下 cellXxx 逐函数对齐 vanilla（render 返回 Node 走富内容挂载通道）
function cellTag(category: string): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.className = 'cat-tag'
  tag.textContent = category
  return tag
}

function cellPrice(price: number): HTMLElement {
  const span = document.createElement('span')
  span.className = 'mono'
  span.textContent = formatMoney(price)
  return span
}

function cellStock(stock: number, t: TFunc): HTMLElement {
  const span = document.createElement('span')
  span.className = `product-stock is-${stockLevel(stock)}`
  span.textContent = t('products.stock', { n: stock })
  return span
}

function cellStatus(row: ProductRow): HTMLElement {
  const sw = document.createElement('oas-switch')
  sw.setAttribute('data-testid', 'product-switch')
  sw.setAttribute('data-id', String(row.id))
  if (row.status === 'on') sw.setAttribute('checked', '')
  return sw
}

function cellAction(row: ProductRow, t: TFunc): HTMLElement {
  const btn = document.createElement('oas-button')
  btn.className = 'product-edit'
  btn.setAttribute('data-testid', 'product-edit')
  btn.setAttribute('data-id', String(row.id))
  btn.setAttribute('size', 'small')
  btn.setAttribute('icon', 'edit')
  btn.setAttribute('aria-label', t('common.edit'))
  return btn
}

/** vanilla TABLE_COLUMNS：price/stock 行内可编辑（列级 editable + validate），status 可过滤 */
function buildColumns(t: TFunc): TableColumn[] {
  return [
    { key: 'name', title: t('products.th.name') },
    { key: 'category', title: t('products.category'), render: (r) => cellTag(String(r.category)) },
    {
      key: 'price',
      title: t('products.th.price'),
      align: 'right',
      editable: true,
      validate: (value) => {
        const n = Number(value)
        if (!Number.isFinite(n) || n <= 0) return t('products.inlineEdit.priceInvalid')
      },
      render: (r) => cellPrice(Number(r.price)),
    },
    {
      key: 'stock',
      title: t('products.th.stock'),
      editable: true,
      validate: (value) => {
        const n = Number(value)
        if (!Number.isInteger(n) || n < 0) return t('products.inlineEdit.stockInvalid')
      },
      render: (r) => cellStock(Number(r.stock), t),
    },
    {
      key: 'status',
      title: t('products.th.status'),
      filterable: true,
      filters: [
        { label: t('products.status.on'), value: 'on' },
        { label: t('products.status.off'), value: 'off' },
      ],
      render: (r) => cellStatus(r as unknown as ProductRow),
    },
    {
      key: 'action',
      title: t('products.th.action'),
      render: (r) => cellAction(r as unknown as ProductRow, t),
    },
  ]
}

// 列定义按 locale 重建（tt 内部读当前 locale，闭包随 locale 变化才需重算）
const columns = computed<TableColumn[]>(() => {
  void locale.value
  return buildColumns(tt)
})
// data/column-keys 走 JSON 字符串通道（AGENTS.md 第 3 条）
const rowsJson = computed(() => JSON.stringify(props.rows))
const columnKeysJson = computed(() => JSON.stringify(props.columnKeys))

// 勾选 → 批量栏（vanilla oas-check 段）
function onCheck(e: Event): void {
  const { keys } = (e as CustomEvent<{ keys: string[] }>).detail
  emit(
    'check',
    keys.map(Number).filter((n) => Number.isFinite(n)),
  )
}

// 行内编辑持久化（vanilla oas-edit 段；仅 price/stock 两列）
function onInlineEdit(e: Event): void {
  if (!props.canMutate) return
  const { key, column, value } = (
    e as CustomEvent<{ key: string; column: string; value: unknown }>
  ).detail
  const id = Number(key)
  if (!Number.isFinite(id) || (column !== 'price' && column !== 'stock')) return
  emit('inline-edit', id, column, Number(value))
}

// 状态开关（vanilla table oas-change 段：按 composedPath 源头识别 switch）
function onTableChange(e: Event): void {
  const sw = e.composedPath()[0] as HTMLElement
  if (sw.getAttribute('data-testid') !== 'product-switch') return
  const id = Number(sw.getAttribute('data-id'))
  if (!id) return
  emit('toggle-status', id)
}

// 编辑按钮：composed click 冒泡出 shadow 后到达容器（vanilla fromPath 等价）
function onWrapClick(e: MouseEvent): void {
  const btn = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('.product-edit'))
  if (!btn) return
  const id = Number(btn.getAttribute('data-id'))
  if (id) emit('edit-row', id)
}

// 父组件清空勾选时同步摘掉表格 selected 属性（vanilla clearSelection 同款人工复位）
function clearSelected(): void {
  tableRef.value?.removeAttribute('selected')
}
defineExpose({ clearSelected })
</script>

<template>
  <div class="table-wrap products-table-wrap" :hidden="hidden" @click="onWrapClick">
    <oas-table
      ref="tableRef"
      data-testid="product-table"
      row-key="id"
      checkable
      stripe
      :editable="canMutate ? '' : null"
      :class="{ 'table-hidden': empty }"
      :columns="columns"
      :data="rowsJson"
      :column-keys="columnKeysJson"
      @oas-check="onCheck"
      @oas-edit="onInlineEdit"
      @oas-change="onTableChange"
    />
    <div class="product-list-empty" data-testid="product-empty" :hidden="!empty">
      <oas-empty :description="t('products.empty')" />
    </div>
  </div>
</template>
