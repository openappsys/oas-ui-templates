<script setup lang="ts">
// src/pages/category.vue —— 商品分类（搜索 + 表格 + 新建/编辑弹窗 + popconfirm 删除）
// 行为事实来源：vanilla-html/src/pages/category.ts（317 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + renderTable 手动刷表）；本模版声明式——
//    rows/keyword/editingId/modalOpen 全部 ref，表格数据/空态显隐由 state 派生
// 2. 子组件拆分（单文件 ≤400 行纪律）：表单弹窗 ./category-form-modal.vue（RULES/fillForm/
//    oas-submit 段）；表格列 render（状态标签/操作列）保留本文件（vanilla cellTag/cellAction）
// 3. 事件绑定：搜索 oas-input/oas-clear 模板直绑（AGENTS.md 第 1 条）；新建按钮原生 click
//    直绑 @click；表格行内编辑按钮经 @click composedPath 匹配（vanilla fromPath.matches 同款，
//    composed click 能冒泡出 oas-table shadow，users-table.vue 先例）
// 4. 删除：vanilla popconfirm oas-ok 的 detail.source 带 data-del-id 反查来源；本模版同样
//    从 oas-ok 事件取 source → data-del-id（v2.2.8 popconfirm 原生自驱动，无需手动 open）
// 5. CSS：vanilla 页面顶部 import dict.css；本模版在本文件 import（dict.css 从 vanilla 原样复制）
// 6. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换 + renderTable 重建列与行内标签；
//    本模版 useT() 订阅后整页重渲染，columns（含行内标签）随 locale 自动重算
import '../styles/pages/dict.css'
import { computed, onMounted, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import { listCategories, removeCategory } from '../data/categories'
import type { CategoryRow } from '../data/categories'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import CategoryFormModal from './category-form-modal.vue'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const rows = ref<CategoryRow[]>([])
const keyword = ref('')
const editingId = ref<number | null>(null)
const modalOpen = ref(false)

// vanilla cellTag：状态标签（on=success，off=default）
function cellTag(row: CategoryRow): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', row.status === 'on' ? 'success' : 'default')
  tag.textContent = tt(row.status === 'on' ? 'category.status.on' : 'category.status.off')
  return tag
}

// vanilla cellAction：行内编辑按钮 + popconfirm 包裹的删除按钮（data-del-id 反查来源）
function cellAction(row: CategoryRow): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'cat-actions'
  const edit = document.createElement('oas-button')
  edit.className = 'category-edit'
  edit.setAttribute('data-testid', 'category-edit')
  edit.setAttribute('data-id', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('icon', 'edit')
  edit.setAttribute('aria-label', tt('common.edit'))
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-testid', 'category-del-pop')
  pop.setAttribute('data-del-id', String(row.id))
  pop.setAttribute('title', tt('category.confirmDelete'))
  const del = document.createElement('oas-button')
  del.className = 'category-delete'
  del.setAttribute('data-testid', 'category-delete')
  del.setAttribute('data-id', String(row.id))
  del.setAttribute('size', 'small')
  del.setAttribute('icon', 'trash')
  del.setAttribute('type', 'danger')
  del.setAttribute('aria-label', tt('common.delete'))
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

// vanilla TABLE_COLUMNS()（状态列标签随 locale 重算）
const columns = computed<TableColumn[]>(() => {
  void locale.value
  return [
    { key: 'name', title: tt('category.th.name') },
    { key: 'code', title: tt('category.th.code') },
    { key: 'sort', title: tt('category.th.sort'), align: 'right' },
    { key: 'status', title: tt('category.th.status'), render: (r) => cellTag(r as unknown as CategoryRow) },
    { key: 'action', title: tt('category.th.action'), render: (r) => cellAction(r as unknown as CategoryRow) },
  ]
})

// vanilla refresh()
async function refresh(): Promise<void> {
  rows.value = await listCategories()
}
onMounted(() => void refresh())

// vanilla renderTable 的过滤段：名称/代码包含关键字
const filtered = computed(() => {
  const kw = keyword.value.trim()
  return rows.value.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
})
const empty = computed(() => filtered.value.length === 0)
// data 走 JSON 字符串通道（AGENTS.md 第 3 条）
const rowsJson = computed(() => JSON.stringify(filtered.value))

// 编辑目标行（弹窗回填用；与 editingId 分离以对齐 vanilla 语义）
const editing = computed(() => rows.value.find((r) => r.id === editingId.value) ?? null)

// vanilla category-create 段：fillForm(null) + openModal
function onCreate(): void {
  editingId.value = null
  modalOpen.value = true
}

// vanilla table click 段：composedPath 匹配行内编辑按钮 → fillForm(row) + openModal
// （v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open）
function onTableClick(e: MouseEvent): void {
  const editBtn = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-testid="category-edit"]'))
  if (!editBtn) return
  const row = rows.value.find((r) => r.id === Number(editBtn.getAttribute('data-id')))
  if (row) {
    editingId.value = row.id
    modalOpen.value = true
  }
}

// vanilla popconfirm oas-ok 段：source.data-del-id 反查 → 删除 → 提示 + 刷新
function onDeleteOk(e: Event): void {
  const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
  const raw = src?.hasAttribute?.('data-del-id') ? src.getAttribute('data-del-id') : null
  const id = Number(raw)
  if (!raw || !Number.isFinite(id)) return
  void (async () => {
    await removeCategory(id)
    editingId.value = null
    appMessage.success(tt('common.deleted'))
    void refresh()
  })()
}

// vanilla oas-submit 段的收尾（持久化/提示在子组件）：关闭弹窗 + 清编辑态 + 刷新
function onFormSaved(): void {
  modalOpen.value = false
  editingId.value = null
  void refresh()
}

// vanilla search oas-input/oas-clear 段
function onSearchInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value ?? ''
}
function onSearchClear(): void {
  keyword.value = ''
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.category') }}</h1>
        <p class="page-subtitle">{{ t('category.subtitle') }}</p>
      </div>
      <oas-button data-testid="category-create" type="primary" icon="plus" @click="onCreate">
        {{ t('category.new') }}
      </oas-button>
    </div>
    <div class="dict-items-card">
      <div class="dict-pane-head">
        <oas-input
          data-testid="category-search"
          class="category-search"
          :placeholder="t('category.search')"
          prefix-icon="search"
          clearable
          @oas-input="onSearchInput"
          @oas-clear="onSearchClear"
        />
      </div>
      <div id="category-items-wrap">
        <oas-table
          data-testid="category-table"
          row-key="id"
          :class="{ 'table-hidden': empty }"
          :columns="columns"
          :data="rowsJson"
          @click="onTableClick"
          @oas-ok="onDeleteOk"
        />
        <div class="table-empty" data-testid="category-empty" :hidden="!empty">
          <oas-empty :description="t('category.empty')" />
        </div>
      </div>
    </div>

    <CategoryFormModal
      :open="modalOpen"
      :editing-id="editingId"
      :editing="editing"
      @close="modalOpen = false"
      @saved="onFormSaved"
    />
  </div>
</template>
