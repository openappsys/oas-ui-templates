<script setup lang="ts">
// src/pages/users-table.vue —— 用户列表表格（oas-table + 行编辑按钮 + 行点击）
// 行为事实来源：vanilla-html/src/pages/users.ts 的 COLUMNS/cellAction/renderTable/setEmpty 段
// 拆分边界参照 products-table.vue 先例
// 偏差记录（因果链）：
// 1. columns 含 render 函数（action 列返回真实 DOM 节点），JSON 序列化会丢函数，故走 property
//    通道：Vue 3.5 对有 setter 的 custom element 直接 property 赋值（AGENTS.md 第 3 条，
//    oas-table columns setter 双通道接受）；computed 按 locale/roles 重建，对齐 vanilla
//    renderTable 里 table.columns = COLUMNS(...) 的时机
// 2. data 传 JSON 字符串（贴近 vanilla setAttribute('data') 通道）；空态时父组件传空数组，
//    等价 vanilla setEmpty(true) 的 table.setAttribute('data','[]')
// 3. 行编辑按钮：原生 click 是 composed 事件，能冒泡出 oas-table shadow，直绑 oas-table 的
//    @click（Vue 直绑元素本身，无 react 根委托问题），composedPath 匹配 .user-row-edit
//    （对齐 vanilla fromPath 的 matches 语义）；oas-row-click 自定义事件模板直绑（第 1 条）
// 4. 空态显隐：vanilla 手动切 table-hidden 类；本模版由 empty prop 派生 class 绑定，
//    empty-overlay 在父组件（vanilla 与表格同为 #table-wrap 子节点，不额外包 div 以对齐 DOM）
// 5. loading/pagination 布尔 attribute 存在性语义（:loading="loading ? '' : null"，第 2 条）；
//    current/filter-values 的命令式复位经 defineExpose（vanilla 同款 setAttribute 通道）
import { computed, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import type { RoleRow } from '../data/system'
import { readPageSize } from '../settings-init'
import { useT } from '../composables/use-t'

/** 表格展示行（父组件 toDisplay 已把角色名/状态标签本地化） */
export interface UserDisplayRow {
  id: number
  name: string
  email: string
  role: string
  status: string
  created: string
}

const props = defineProps<{
  rows: UserDisplayRow[]
  /** 角色列表（role 列 filters 来源，vanilla COLUMNS(roleFilters)） */
  roles: RoleRow[]
  /** 筛选结果为空：表格隐藏（empty-overlay 由父组件显示） */
  empty: boolean
  loading: boolean
}>()
const emit = defineEmits<{
  'edit-row': [id: number]
  'row-click': [id: number]
}>()

const { t: tt, locale } = useT()

const tableRef = ref<HTMLElement | null>(null)

// vanilla pageSize()：每页条数跟随设置中心（页面生命周期内读取一次）
const pageSize = Number(readPageSize()) || 5

// vanilla cellAction
function cellAction(row: UserDisplayRow): HTMLElement {
  const edit = document.createElement('oas-button')
  edit.className = 'user-row-edit'
  edit.setAttribute('data-testid', 'user-row-edit')
  edit.setAttribute('data-id', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('icon', 'edit')
  edit.setAttribute('aria-label', tt('common.edit'))
  return edit
}

// vanilla COLUMNS()：role/status 可过滤（filters 值为展示串），created 可排序
const columns = computed<TableColumn[]>(() => {
  void locale.value
  return [
    { key: 'id', title: 'ID', width: '60px' },
    { key: 'name', title: tt('users.name') },
    { key: 'email', title: tt('users.email') },
    {
      key: 'role',
      title: tt('users.role'),
      filterable: true,
      filters: props.roles.map((r) => ({ label: r.name, value: r.name })),
    },
    {
      key: 'status',
      title: tt('users.status'),
      filterable: true,
      filters: [
        { label: tt('users.status.active'), value: tt('users.status.active') },
        { label: tt('users.status.disabled'), value: tt('users.status.disabled') },
      ],
    },
    { key: 'created', title: tt('users.created'), sortable: true },
    {
      key: 'action',
      title: tt('users.th.action'),
      width: '80px',
      render: (r) => cellAction(r as unknown as UserDisplayRow),
    },
  ]
})
// data 走 JSON 字符串通道（AGENTS.md 第 3 条）
const rowsJson = computed(() => JSON.stringify(props.rows))

// 行编辑按钮：composed click 冒泡出 shadow（vanilla fromPath 等价）
function onTableClick(e: MouseEvent): void {
  const btn = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('.user-row-edit'))
  if (!btn) return
  const id = Number(btn.getAttribute('data-id'))
  if (id) emit('edit-row', id)
}

// vanilla oas-row-click 段：detail.row 为展示行，按 id 上抛
function onRowClick(e: Event): void {
  const row = (e as CustomEvent<{ row: Record<string, unknown> }>).detail.row
  const id = Number(row.id)
  if (id) emit('row-click', id)
}

// vanilla 搜索/清除筛选时的命令式复位（current/filter-values 非受控属性）
function resetPage(): void {
  tableRef.value?.setAttribute('current', '1')
}
function clearFilterValues(): void {
  tableRef.value?.removeAttribute('filter-values')
}
defineExpose({ resetPage, clearFilterValues })
</script>

<template>
  <oas-table
    ref="tableRef"
    data-testid="users-table"
    row-key="id"
    pagination
    :page-size="pageSize"
    :class="{ 'table-hidden': empty }"
    :columns="columns"
    :data="rowsJson"
    :loading="loading ? '' : null"
    @click="onTableClick"
    @oas-row-click="onRowClick"
  />
</template>
