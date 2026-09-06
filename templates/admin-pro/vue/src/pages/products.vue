<script setup lang="ts">
// src/pages/products.vue —— 商品管理（卡片/列表双视图 + 三表单模式 + 批量操作 + 列设置持久化）
// 行为事实来源：vanilla-html/src/pages/products.ts（755 行，逐块对齐），
// react/src/pages/products.tsx 为已验收参照（拆分边界对齐它）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + setAttribute 回写）；本模版声明式——
//    rows/keyword/category/page/view/selected/columnKeys 全部 ref，表格切片/空态/批量栏
//    显隐/分页属性全部由 state 派生；refresh() 仅重拉数据写 ref，重渲染即最新
// 2. 事件绑定：oas-input/oas-select/oas-segmented/oas-pagination 的 oas-* 自定义事件一律模板
//    直绑（Vue 原生支持 kebab 事件，AGENTS.md 第 1 条，无需 react 版 useOasEvent 桥接）；
//    工具栏按钮原生 click 直绑 @click；卡片编辑按钮 @click 委托 + closest 匹配（vanilla 同款）
// 3. visible 受控同步：表单容器/列设置弹窗的 visible 由 state 持有，组件侧关闭（遮罩/Esc）
//    经 oas-close 回写 state（vanilla 靠组件自摘属性，无此问题）——由子组件上抛 close
// 4. 手动分页：vanilla 超页时静默 state.page = maxPage；本模版派生 current = min(page, maxPage)
//    不回头改 state（显示结果一致，避免渲染期写状态）
// 5. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换；本模版 useT() 订阅后整页
//    重渲染，rules/options/columns/标签随 locale 自动重算（dashboard 同款模式）
// 6. 子组件拆分（单文件 ≤400 行纪律）：表格 ./products-table.vue、表单 ./product-form.vue、
//    批量栏 ./products-batch-bar.vue、列设置弹窗 ./products-columns-modal.vue；
//    page 形态跳 /products/edit（sessionStorage 键 product-edit-id 与 vanilla 逐字一致）
// 7. 布尔 attribute 一律存在性语义（:checked="cond ? '' : null"，AGENTS.md 第 2 条）；
//    hidden 走原生属性反射（:hidden="bool"）；options 等复杂数据传 JSON 字符串（第 3 条）
// 8. oas-pagination 的 hidden 例外：组件 update() 会无条件自摘 hidden（为 hide-on-single
//    预留），声明式 :hidden 会被 total/current 变更触发的同步 update 吞掉（react 版「卡片
//    视图下搜索」场景同样会丢 hidden）。故 pager 的 hidden 改由 watch(flush:'post') 在 Vue
//    补丁与组件同步反应落完后命令式补写（hidden 不在 observedAttributes，不会回环）
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import '../styles/pages/products.css'
import { listCategories } from '../data/categories'
import {
  listProducts,
  removeProduct,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import type { ProductRow } from '../data/products'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import { readFormMode, readPageSize } from '../settings-init'
import { session } from '../store/session'
import { readProductColumns } from './product-columns'
import type { ProductColumnKey } from './product-columns'
import ProductForm from './product-form.vue'
import type { Option } from './product-form.vue'
import ProductsBatchBar from './products-batch-bar.vue'
import ProductsColumnsModal from './products-columns-modal.vue'
import ProductsTable from './products-table.vue'

const VIEW_KEY = 'oas-admin.products-view'
const DEFAULT_PAGE_SIZE = 5

type ViewMode = 'cards' | 'table'

function readView(): ViewMode {
  return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'
}

/** vanilla readPageSize：读 PAGE_SIZE_KEY，非法/缺省回落 5（settings-init 的 readPageSize 返回字符串） */
function readPageSizeNum(): number {
  const n = Number(readPageSize())
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const router = useRouter()

const rows = ref<ProductRow[]>([])
const categories = ref<Option[]>([])
const keyword = ref('')
const category = ref('')
const editingId = ref<number | null>(null)
const page = ref(1)
const view = ref<ViewMode>(readView())
// 页面生命周期内不变（vanilla 同为 render 时读取一次的局部状态）
const formMode = readFormMode()
const pageSize = readPageSizeNum()
const selected = ref<number[]>([])
const columnKeys = ref<ProductColumnKey[]>(readProductColumns())
const surfaceOpen = ref(false)
const columnsOpen = ref(false)

// session 为模块级状态（登录后页面重挂载才变），与 dashboard.vue 同款非响应式取值
const canMutate = session.user?.role !== 'viewer'

const tableCompRef = ref<InstanceType<typeof ProductsTable> | null>(null)
const pagerRef = ref<HTMLElement | null>(null)

// vanilla refresh()：并发拉商品 + 分类；当前筛选分类失效时清空（applyCategoryOptions 语义）
async function refresh(): Promise<void> {
  const [list, cats] = await Promise.all([listProducts(), listCategories()])
  rows.value = list
  const opts = cats.map((c) => ({ label: c.name, value: c.name }))
  categories.value = opts
  if (category.value && !opts.some((c) => c.value === category.value)) category.value = ''
}
onMounted(() => void refresh())

// vanilla filtered()：关键字（小写包含）+ 分类精确匹配
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (category.value && r.category !== category.value) return false
    if (kw && !r.name.toLowerCase().includes(kw)) return false
    return true
  })
})

// 手动分页（演示）：宿主 slice + 外部 oas-pagination（users/orders 用表格内置 pagination）
const current = computed(() => Math.min(page.value, Math.max(1, Math.ceil(filtered.value.length / pageSize))))
const pageRows = computed(() =>
  filtered.value.slice((current.value - 1) * pageSize, current.value * pageSize),
)

// oas-pagination hidden 命令式补写（原因见头注释第 8 条；依赖覆盖 total/current/hidden 全部输入）
const pagerHidden = computed(() => view.value !== 'table' || filtered.value.length === 0)
watch(
  [pagerHidden, current, filtered],
  () => {
    if (pagerHidden.value) pagerRef.value?.setAttribute('hidden', '')
    else pagerRef.value?.removeAttribute('hidden')
  },
  { flush: 'post', immediate: true },
)

// 编辑态行（表单回填用；与 editingId 分离以对齐 vanilla 语义）
const editing = computed(() => rows.value.find((r) => r.id === editingId.value) ?? null)

// page 模式以外的表单容器形态（v-if 已排除 'page'，此处只做类型收窄）
const surfaceMode = computed<'dialog' | 'drawer'>(() =>
  formMode === 'dialog' ? 'dialog' : 'drawer',
)

// vanilla openForm：page 模式写 sessionStorage 跳编辑页；其余就地开表单容器
function openForm(row: ProductRow | null): void {
  if (formMode === 'page') {
    if (row) sessionStorage.setItem('product-edit-id', String(row.id))
    else sessionStorage.removeItem('product-edit-id')
    void router.push('/products/edit')
    return
  }
  editingId.value = row?.id ?? null
  surfaceOpen.value = true
}

// vanilla grid/table 开关切换段（共用）
async function toggleStatus(id: number): Promise<void> {
  const updated = await toggleProductStatus(id)
  if (!updated) {
    appMessage.error(tt('products.notFound'))
    return
  }
  appMessage.success(
    updated.status === 'on' ? tt('products.status.on') : tt('products.status.off'),
  )
  void refresh()
}

// vanilla oas-edit 行内编辑持久化段
function inlineEdit(id: number, column: 'price' | 'stock', value: number): void {
  void updateProduct(id, { [column]: value }).then((updated) => {
    if (!updated) appMessage.error(tt('products.notFound'))
    else appMessage.success(tt('common.saved'))
    void refresh()
  })
}

// vanilla clearSelection：清空选中 + 摘掉表格 selected 属性（组件受控集合外的人工复位）
function clearSelection(): void {
  selected.value = []
  tableCompRef.value?.clearSelected()
}

// vanilla batchStatus：逐项 toggle 至目标态，统计变更数
async function batchStatus(target: 'on' | 'off'): Promise<void> {
  if (!canMutate) {
    appMessage.error(tt('common.noPerm'))
    return
  }
  let changed = 0
  for (const id of selected.value) {
    const row = rows.value.find((r) => r.id === id)
    if (!row || row.status === target) continue
    if (await toggleProductStatus(id)) changed++
  }
  clearSelection()
  appMessage.success(tt('products.batch.statusDone', { count: changed }))
  void refresh()
}

// vanilla 批量删除 popconfirm oas-ok 段：逐项删除 + 清选 + 提示 + 刷新
async function batchDelete(): Promise<void> {
  if (!canMutate) {
    appMessage.error(tt('common.noPerm'))
    return
  }
  let removed = 0
  for (const id of selected.value) {
    if (await removeProduct(id)) removed++
  }
  clearSelection()
  appMessage.success(tt('products.batch.deleted', { count: removed }))
  void refresh()
}

// 工具栏事件（oas-* 自定义事件模板直绑，detail 取值对齐 vanilla）
function onSearchInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value
  page.value = 1
}
function onSearchClear(): void {
  keyword.value = ''
  page.value = 1
}
function onCategoryChange(e: Event): void {
  category.value = (e as CustomEvent<{ value: string }>).detail.value
  page.value = 1
}
function onViewChange(e: Event): void {
  const v = (e as CustomEvent<{ value: string }>).detail.value as ViewMode
  if ((v !== 'cards' && v !== 'table') || v === view.value) return
  view.value = v
  page.value = 1
  localStorage.setItem(VIEW_KEY, v)
}
function onPageChange(e: Event): void {
  page.value = (e as CustomEvent<{ page: number }>).detail.page
}

// 卡片视图开关（vanilla grid oas-change 段：composedPath 源头取 data-id）
function onGridChange(e: Event): void {
  const sw = e.composedPath()[0] as HTMLElement
  const id = Number(sw.getAttribute('data-id'))
  if (!id) return
  void toggleStatus(id)
}

// 卡片视图编辑按钮：light DOM 子节点，@click 委托（vanilla closest 匹配同款）
function onGridClick(e: MouseEvent): void {
  const btn = (e.target as HTMLElement).closest('[data-testid="product-edit"]')
  if (!btn) return
  const id = Number(btn.getAttribute('data-id'))
  const row = rows.value.find((r) => r.id === id)
  if (row) openForm(row)
}

// 表格行编辑按钮上抛：按 id 找行后走 openForm
function onEditRow(id: number): void {
  const row = rows.value.find((r) => r.id === id)
  if (row) openForm(row)
}

function onFormSaved(): void {
  surfaceOpen.value = false
  void refresh()
}

// 复杂数据走 JSON attribute 通道（AGENTS.md 第 3 条）
const filterOptions = computed(() =>
  JSON.stringify([{ label: t('products.allCategories'), value: '' }, ...categories.value]),
)
const viewOptions = computed(() =>
  JSON.stringify([
    { label: t('products.viewCards'), value: 'cards' },
    { label: t('products.viewTable'), value: 'table' },
  ]),
)
</script>

<template>
  <div class="page products-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.products') }}</h1>
        <p class="page-subtitle">{{ t('products.subtitle') }}</p>
      </div>
      <oas-button data-testid="product-create" type="primary" icon="plus" @click="openForm(null)">
        {{ t('products.newProduct') }}
      </oas-button>
    </div>
    <div class="products-toolbar">
      <oas-input
        data-testid="product-search"
        :placeholder="t('products.search')"
        clearable
        prefix-icon="search"
        @oas-input="onSearchInput"
        @oas-clear="onSearchClear"
      />      <oas-select
        data-testid="product-category"
        :placeholder="t('products.category')"
        :options="filterOptions"
        :value="category"
        @oas-change="onCategoryChange"
      />
      <oas-segmented
        data-testid="product-view"
        class="products-view-toggle"
        :options="viewOptions"
        :value="view"
        @oas-change="onViewChange"
      />
      <oas-button data-testid="product-columns" class="products-columns-btn" icon="gear" @click="columnsOpen = true">
        {{ t('products.columns.title') }}
      </oas-button>
    </div>
    <ProductsBatchBar
      :hidden="view !== 'table' || selected.length === 0"
      :selected-count="selected.length"
      :can-mutate="canMutate"
      @batch-status="(target) => void batchStatus(target)"
      @batch-delete="void batchDelete()"
    />
    <oas-masonry
      class="product-grid"
      data-testid="product-grid"
      columns="4"
      gap="12px"
      :hidden="view !== 'cards'"
      @click="onGridClick"
      @oas-change="onGridChange"
    >
      <oas-empty v-if="filtered.length === 0" :description="t('products.empty')" />
      <template v-else>
        <oas-card v-for="r in filtered" :key="r.id" class="product-card" :data-id="r.id">
          <div class="product-card-head">
            <div class="product-name">{{ r.name }}</div>
            <oas-tag class="cat-tag">{{ r.category }}</oas-tag>
          </div>
          <div class="product-price mono">{{ formatMoney(r.price) }}</div>
          <div class="product-meta">
            <span class="product-stock" :class="`is-${stockLevel(r.stock)}`">
              {{ t('products.stock', { n: r.stock }) }}
            </span>
            <span class="product-date mono">{{ r.created }}</span>
          </div>
          <div class="product-card-foot">
            <div class="product-status">
              <oas-switch data-testid="product-switch" :data-id="r.id" :checked="r.status === 'on' ? '' : null" />
              <span class="product-status-label">
                {{ r.status === 'on' ? t('products.status.on') : t('products.status.off') }}
              </span>
            </div>
            <oas-button class="product-edit" size="small" icon="edit" data-testid="product-edit" :data-id="r.id" :aria-label="t('common.edit')" />
          </div>
        </oas-card>
      </template>
    </oas-masonry>
    <ProductsTable
      ref="tableCompRef"
      :rows="pageRows"
      :column-keys="columnKeys"
      :can-mutate="canMutate"
      :empty="filtered.length === 0"
      :hidden="view !== 'table'"
      @toggle-status="(id) => void toggleStatus(id)"
      @edit-row="onEditRow"
      @check="selected = $event"
      @inline-edit="inlineEdit"
    />
    <!-- pager 不绑 :hidden（会被组件 update 吞掉），由 watch 命令式补写，见头注释第 8 条 -->
    <oas-pagination
      ref="pagerRef"
      data-testid="product-pager"
      :total="filtered.length"
      :page-size="pageSize"
      :current="current"
      show-total
      @oas-change="onPageChange"
    />
    <ProductForm
      v-if="formMode !== 'page'"
      :mode="surfaceMode"
      :open="surfaceOpen"
      :editing-id="editingId"
      :editing="editing"
      :categories="categories"
      @close="surfaceOpen = false"
      @saved="onFormSaved"
    />
    <ProductsColumnsModal
      :open="columnsOpen"
      :column-keys="columnKeys"
      @change="columnKeys = $event"
      @close="columnsOpen = false"
    />
  </div>
</template>
