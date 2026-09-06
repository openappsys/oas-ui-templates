<script setup lang="ts">
// src/pages/category.vue —— 商品分类（搜索 + 表格 + 新建/编辑弹窗 + popconfirm 删除）
//    rows/keyword/editingId/modalOpen 全部 ref，表格数据/空态显隐由 state 派生
// 2. 子组件拆分（单文件 ≤400 行纪律）：表单弹窗 ./category-form-modal.vue（RULES/fillForm/
// 3. 事件绑定：搜索 oas-input/oas-clear 模板直绑新建按钮原生 click
//    composed click 能冒泡出 oas-table shadow，users-table.vue 先例）
//    从 oas-ok 事件取 source → data-del-id（v2.2.8 popconfirm 原生自驱动，无需手动 open）
//    本模版 useT() 订阅后整页重渲染，columns（含行内标签）随 locale 自动重算
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

function cellTag(row: CategoryRow): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', row.status === 'on' ? 'success' : 'default')
  tag.textContent = tt(row.status === 'on' ? 'category.status.on' : 'category.status.off')
  return tag
}

function cellAction(row: CategoryRow): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'cat-actions'
  ctx.style.cssText = 'display:flex;align-items:center;gap:var(--oas-space-2,8px)'
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

async function refresh(): Promise<void> {
  rows.value = await listCategories()
}
onMounted(() => void refresh())

const filtered = computed(() => {
  const kw = keyword.value.trim()
  return rows.value.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
})
const empty = computed(() => filtered.value.length === 0)
// data 走 JSON 字符串通道
const rowsJson = computed(() => JSON.stringify(filtered.value))

const editing = computed(() => rows.value.find((r) => r.id === editingId.value) ?? null)

function onCreate(): void {
  editingId.value = null
  modalOpen.value = true
}

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

function onFormSaved(): void {
  modalOpen.value = false
  editingId.value = null
  void refresh()
}

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

<style scoped>
/* 分类页样式（自 app.css / dict.css 迁入）：仅本页使用的搜索框与字典右栏头部 */
.category-search {
  width: 280px;
  max-width: 100%;
}
.category-search::part(input) {
  height: 32px;
}
.dict-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oas-space-2);
  margin-bottom: var(--oas-space-2);
}
</style>
