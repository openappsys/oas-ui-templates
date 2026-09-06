<script setup lang="ts">
// src/pages/dict.vue —— 字典管理：左类型列表 + 右键值表格（双弹窗新建/编辑）
// 行为事实来源：vanilla-html/src/pages/dict.ts（439 行，逐块对齐）；
// react 版同期并行开发中仍为占位，以 vanilla 为准
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + renderTypeList/renderItems 手动刷）；
//    本模版声明式——types/counts/selectedTypeId/loadedItems 全部 ref，列表/表头/空态由
//    state 派生（wrap hidden 与 table-hidden 类两层显隐与 vanilla 一致）
// 2. 子组件拆分（单文件 ≤400 行纪律）：类型弹窗 ./dict-type-modal.vue、键值弹窗
//    ./dict-item-modal.vue（RULES/fillForm/oas-submit 段）；表格列 render（操作列）
//    保留本文件（vanilla itemActionCell）
// 3. 事件绑定：类型列表点击 closest([data-id]) 直绑；表格行内编辑按钮经 @click
//    composedPath 匹配（category.vue 同款）；popconfirm 删除从 oas-ok 的
//    detail.source 带 data-del 反查（v2.2.8 popconfirm 原生自驱动）
// 4. CSS：vanilla 页面顶部 import dict.css；本模版在本文件 import（批次 A 已复制）
// 5. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换 + renderTypeList/renderItems
//    重建；本模版 useT() 订阅后整页重渲染，columns（含行内标签）随 locale 自动重算
import '../styles/pages/dict.css'
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

// ---- 页面状态（对齐 vanilla PageState） ----
const types = ref<DictType[]>([])
const counts = ref<Record<number, number>>({})
const selectedTypeId = ref<number | null>(null)
const editingTypeId = ref<number | null>(null)
const editingItemId = ref<number | null>(null)
const loadedItems = ref<DictItem[]>([])

const typeModalOpen = ref(false)
const itemModalOpen = ref(false)

const selectedType = computed(() => types.value.find((x) => x.id === selectedTypeId.value) ?? null)
// 编辑回填目标（弹窗 watch 依赖；与 editingId 分离以对齐 vanilla 语义）
const editingType = computed(() => types.value.find((x) => x.id === editingTypeId.value) ?? null)
const editingItem = computed(
  () => loadedItems.value.find((x) => x.id === editingItemId.value) ?? null,
)

// vanilla ITEM_COLUMNS()：操作列（编辑 + popconfirm 删除）随 locale 重建
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

// data 走 JSON 字符串通道（AGENTS.md 第 3 条）；itemsEmpty → table-hidden 类（vanilla 同款）
const itemsJson = computed(() => JSON.stringify(loadedItems.value))
const itemsEmpty = computed(() => loadedItems.value.length === 0)

// vanilla refresh()：类型 + 全量计数，选中失效回落首个
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

// vanilla refreshItems()：选中类型的键值 + 计数回写
async function refreshItems(): Promise<void> {
  if (selectedTypeId.value == null) {
    loadedItems.value = []
    return
  }
  loadedItems.value = await listDictItems(selectedTypeId.value)
  counts.value = { ...counts.value, [selectedTypeId.value]: loadedItems.value.length }
}
onMounted(() => void refresh())

// vanilla typeList click 段：closest([data-id]) 切类型 → 刷新键值
function onTypeClick(e: MouseEvent): void {
  const item = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
  if (!item) return
  selectedTypeId.value = Number(item.getAttribute('data-id'))
  void refreshItems()
}

// vanilla dict-type-create 段：openTypeForm(null)
function onNewType(): void {
  editingTypeId.value = null
  typeModalOpen.value = true
}

// vanilla dict-item-create 段：无选中类型先警告
function onNewItem(): void {
  if (selectedTypeId.value == null) {
    appMessage.warning(t('dict.warn.selectType'))
    return
  }
  editingItemId.value = null
  itemModalOpen.value = true
}

// vanilla table click 段：composedPath 匹配行内编辑按钮 → openItemForm(item)
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

// vanilla onItemDelete：oas-ok 的 detail.source 带 data-del 反查来源 → 删除 → 提示 + 刷新
function onDeleteOk(e: Event): void {
  const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
  if (!src?.hasAttribute?.('data-del')) return
  void removeDictItem(Number(src.getAttribute('data-del'))).then(() => {
    appMessage.success(tt('common.deleted'))
    void refreshItems()
  })
}

// vanilla typeForm oas-submit 段收尾（持久化在弹窗子组件）：关弹窗 + 清选中 + 整页刷新
function onTypeSaved(): void {
  typeModalOpen.value = false
  editingTypeId.value = null
  selectedTypeId.value = null
  loadedItems.value = []
  void refresh()
}

// vanilla itemForm oas-submit 段收尾：关弹窗 + 刷新键值
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
