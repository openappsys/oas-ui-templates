<script setup lang="ts">
// src/pages/dict.vue —— 字典管理：左类型列表 + 右键值表格（双弹窗新建/编辑）
//    本模版声明式——types/counts/selectedTypeId/loadedItems 全部 ref，列表/表头/空态由
// 2. 子组件拆分（单文件 ≤400 行纪律）：类型弹窗 ./dict-type-modal.vue、键值弹窗
//    ./dict-item-modal.vue（RULES/fillForm/oas-submit 段）；表格列 render（操作列）
// 3. 事件绑定：类型列表点击 closest([data-id]) 直绑；表格行内编辑按钮经 @click
//    composedPath 匹配（category.vue 同款）；popconfirm 删除从 oas-ok 的
//    detail.source 带 data-del 反查（v2.2.8 popconfirm 原生自驱动）
//    重建；本模版 useT() 订阅后整页重渲染，columns（含行内标签）随 locale 自动重算
import { computed, onMounted, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import {
  createDictItem,
  createDictType,
  listDictItems,
  listDictTypes,
  removeDictItem,
  updateDictItem,
  updateDictType,
} from '../data/system'
import type { DictItem, DictType } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import DictTypeModal from './dict-type-modal.vue'
import DictItemModal from './dict-item-modal.vue'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const types = ref<DictType[]>([])
const counts = ref<Record<number, number>>({})
const selectedTypeId = ref<number | null>(null)
const editingTypeId = ref<number | null>(null)
const editingItemId = ref<number | null>(null)
const loadedItems = ref<DictItem[]>([])

const typeModalOpen = ref(false)
const itemModalOpen = ref(false)

const selectedType = computed(() => types.value.find((x) => x.id === selectedTypeId.value) ?? null)
const editingType = computed(() => types.value.find((x) => x.id === editingTypeId.value) ?? null)
const editingItem = computed(
  () => loadedItems.value.find((x) => x.id === editingItemId.value) ?? null,
)

function itemActionCell(item: DictItem): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(item.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = tt('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(item.id))
  pop.setAttribute('title', tt('dict.confirmDeleteItem'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = tt('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

const itemColumns = computed<TableColumn[]>(() => {
  void locale.value
  return [
    { key: 'label', title: tt('dict.th.label') },
    { key: 'value', title: tt('dict.th.value') },
    { key: 'sort', title: tt('dict.th.sort'), align: 'right' },
    { key: 'action', title: tt('dict.th.action'), render: (r) => itemActionCell(r as unknown as DictItem) },
  ]
})

const itemsJson = computed(() => JSON.stringify(loadedItems.value))
const itemsEmpty = computed(() => loadedItems.value.length === 0)

async function refresh(): Promise<void> {
  types.value = await listDictTypes()
  if (selectedTypeId.value == null || !types.value.some((x) => x.id === selectedTypeId.value)) {
    selectedTypeId.value = types.value[0]?.id ?? null
  }
  loadedItems.value = []
  const next: Record<number, number> = {}
  await Promise.all(
    types.value.map(async (ty) => {
      next[ty.id] = (await listDictItems(ty.id)).length
    }),
  )
  counts.value = next
  await refreshItems()
}

async function refreshItems(): Promise<void> {
  if (selectedTypeId.value == null) {
    loadedItems.value = []
    return
  }
  loadedItems.value = await listDictItems(selectedTypeId.value)
  counts.value = { ...counts.value, [selectedTypeId.value]: loadedItems.value.length }
}
onMounted(() => void refresh())

function onTypeClick(e: MouseEvent): void {
  const item = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
  if (!item) return
  selectedTypeId.value = Number(item.getAttribute('data-id'))
  void refreshItems()
}

function onNewType(): void {
  editingTypeId.value = null
  typeModalOpen.value = true
}

function onNewItem(): void {
  if (selectedTypeId.value == null) {
    appMessage.warning(t('dict.warn.selectType'))
    return
  }
  editingItemId.value = null
  itemModalOpen.value = true
}

// （v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open）
function onTableClick(e: MouseEvent): void {
  const btn = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
  if (!btn) return
  const item = loadedItems.value.find((d) => d.id === Number(btn.getAttribute('data-edit')))
  if (item) {
    editingItemId.value = item.id
    itemModalOpen.value = true
  }
}

function onDeleteOk(e: Event): void {
  const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
  if (!src?.hasAttribute?.('data-del')) return
  void removeDictItem(Number(src.getAttribute('data-del'))).then(() => {
    appMessage.success(tt('common.deleted'))
    void refreshItems()
  })
}

function onTypeSaved(): void {
  typeModalOpen.value = false
  editingTypeId.value = null
  selectedTypeId.value = null
  loadedItems.value = []
  void refresh()
}

function onItemSaved(): void {
  itemModalOpen.value = false
  editingItemId.value = null
  void refreshItems()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.dict') }}</h1>
        <p class="page-subtitle">{{ t('dict.subtitle') }}</p>
      </div>
    </div>
    <div class="dict-layout">
      <oas-card class="dict-type-card" :title="t('dict.typeTitle')">
        <div class="dict-type-list" data-testid="dict-type-list">
          <div v-if="types.length === 0" class="dict-empty">{{ t('dict.empty.types') }}</div>
          <template v-else>
            <div
              v-for="ty in types"
              :key="ty.id"
              class="dict-type-item"
              :class="{ 'is-selected': ty.id === selectedTypeId }"
              :data-id="ty.id"
              data-testid="dict-type-item"
              @click="onTypeClick"
            >
              <span class="dict-type-name">{{ ty.name }}</span>
              <span class="dict-type-code mono">{{ ty.code }}</span>
              <span class="dict-type-count">{{ counts[ty.id] ?? 0 }}</span>
            </div>
          </template>
        </div>
      </oas-card>
      <oas-card class="dict-items-card" :title="t('dict.itemTitle')">
        <div class="dict-pane-head">
          <div>
            <template v-if="selectedType">
              <span class="dict-pane-title">{{ selectedType.name }}</span>
              <div class="dict-pane-sub">
                {{ t('dict.itemCount', { code: selectedType.code, count: counts[selectedType.id] ?? 0 }) }}
              </div>
            </template>
            <template v-else>
              <span class="dict-pane-title">{{ t('dict.itemTitle') }}</span>
              <div class="dict-pane-sub">{{ t('dict.empty.selectType') }}</div>
            </template>
          </div>
          <div>
            <oas-button data-testid="dict-type-create" type="text" icon="plus" @click="onNewType">
              {{ t('dict.newType') }}
            </oas-button>
            <oas-button data-testid="dict-item-create" type="primary" icon="plus" @click="onNewItem">
              {{ t('dict.newItem') }}
            </oas-button>
          </div>
        </div>
        <div :hidden="!selectedType">
          <oas-table
            data-testid="dict-items-table"
            row-key="id"
            :class="{ 'table-hidden': itemsEmpty }"
            :columns="itemColumns"
            :data="itemsJson"
            @click="onTableClick"
            @oas-ok="onDeleteOk"
          />
        </div>
      </oas-card>
    </div>

    <DictTypeModal
      :open="typeModalOpen"
      :editing-id="editingTypeId"
      :editing="editingType"
      @close="typeModalOpen = false"
      @saved="onTypeSaved"
    />
    <DictItemModal
      :open="itemModalOpen"
      :editing-id="editingItemId"
      :editing="editingItem"
      :type-id="selectedTypeId"
      @close="itemModalOpen = false"
      @saved="onItemSaved"
    />
  </div>
</template>

<style scoped>
/* 字典页样式（自 dict.css 迁入）：.dict-form-body 在三个弹窗组件内各自 scoped 持有，本页不含 */
.dict-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--oas-space-3);
  margin-bottom: var(--oas-space-3);
  align-items: start;
}
.dict-type-card::part(body) {
  padding: 0;
}
.dict-type-list {
  padding: var(--oas-space-1);
}
.dict-type-item {
  display: flex;
  align-items: center;
  gap: var(--oas-space-2);
  padding: var(--oas-space-2) var(--oas-space-3);
  border-radius: var(--oas-radius-md);
  cursor: pointer;
  transition: background 0.15s ease;
}
.dict-type-item:hover {
  background: var(--oas-color-bg-hover);
}
.dict-type-item.is-selected {
  background: color-mix(in srgb, var(--oas-color-primary) 12%, transparent);
}
.dict-type-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
  font-weight: 500;
}
.dict-type-code {
  font-family: var(--app-mono);
  font-size: 11px;
  color: var(--oas-color-text-secondary);
}
.dict-type-count {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--oas-color-bg-hover);
  color: var(--oas-color-text-secondary);
  font-family: var(--app-mono);
  font-size: 11px;
}
.dict-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oas-space-2);
  margin-bottom: var(--oas-space-2);
}
.dict-pane-title {
  font-size: var(--oas-font-size-sm);
  font-weight: 600;
  color: var(--oas-color-text-primary);
}
.dict-pane-sub {
  font-size: var(--oas-font-size-xs);
  color: var(--oas-color-text-secondary);
}
.dict-empty {
  text-align: center;
  padding: var(--oas-space-6);
  color: var(--oas-color-text-secondary);
  font-size: var(--oas-font-size-sm);
}
@media (max-width: 992px) {
  .dict-layout {
    grid-template-columns: 1fr;
  }
}
</style>
