<script lang="ts">
  // src/pages/products.svelte —— 商品管理（卡片/列表双视图 + 三表单模式 + 批量操作 + 列设置持久化）
  // 1. rows/categories 挂载后异步拉取（$effect 一次）；keyword/category/page/view/selected/
  //    columnKeys 全部 $state，表格切片/空态/批量栏显隐/分页属性全部由 state 派生；refresh()
  //    仅重拉数据，响应式重渲即最新（react 版 query 缓存层在 Svelte 无对应物，直连 data 层）
  // 2. 事件绑定：oas-input/oas-select/oas-segmented/oas-pagination 的 oas-* 自定义事件一律
  //    onoas-* 模板直绑；工具栏按钮为 light DOM 原生 click 直绑 onclick
  // 3. visible 受控同步：表单容器/列设置弹窗的 visible 由 state 持有，组件侧关闭（遮罩/Esc）
  //    经 onoas-close 回写（子组件内实现）
  // 4. 子组件拆分（单文件 ≤400 行纪律，拆分边界对齐 react 版）：表格 ./products/products-table.svelte、
  //    表单 ./products/product-form.svelte、批量栏 ./products/products-batch-bar.svelte、
  //    列设置弹窗 ./products/products-columns-modal.svelte
  // 5. oas-pagination 的 hidden 声明式失效（陷阱沉淀）：组件 update() 在 total/current 变更与
  //    语言自刷路径会自摘 hidden，声明式写入会被吞；hidden 不在 observedAttributes（补写不回环），
  //    故保留声明式 hidden 作首渲染兜底，$effect 在提交后以 pagerEl.hidden 命令式补写权威值，
  //    依赖覆盖 hidden 全部输入（view/filtered.length/current + locale）
  import '../styles/pages/products.css'
  import { navigate } from '../router'
  import { listCategories } from '../data/categories'
  import {
    listProducts,
    removeProduct,
    stockLevel,
    toggleProductStatus,
    updateProduct,
  } from '../data/products'
  import type { ProductRow } from '../data/products'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'
  import { readFormMode, readPageSize } from '../settings-init'
  import type { FormMode } from '../settings-init'
  import { session } from '../store/session'
  import ProductForm from './products/product-form.svelte'
  import { readProductColumns } from './products/product-columns'
  import type { ProductColumnKey } from './products/product-columns'
  import ProductsBatchBar from './products/products-batch-bar.svelte'
  import ProductsColumnsModal from './products/products-columns-modal.svelte'
  import ProductsTable from './products/products-table.svelte'

  const VIEW_KEY = 'oas-admin.products-view'
  const DEFAULT_PAGE_SIZE = 5

  type ViewMode = 'cards' | 'table'

  type Option = { label: string; value: string }

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

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  // ---- state ----
  let keyword = $state('')
  let category = $state('')
  let editingId = $state<number | null>(null)
  let page = $state(1)
  let view = $state<ViewMode>(readView())
  const formMode = $state<FormMode>(readFormMode())
  const pageSize = $state(readPageSizeNum())
  let selected = $state<number[]>([])
  let columnKeys = $state<ProductColumnKey[]>(readProductColumns())
  let surfaceOpen = $state(false)
  let columnsOpen = $state(false)
  let rows = $state<ProductRow[]>([])
  let categories = $state<Option[]>([])

  let searchEl = $state<HTMLElement | null>(null)
  let tableEl = $state<HTMLElement | null>(null)
  let pagerEl = $state<HTMLElement | null>(null)

  const canMutate = session.user?.role !== 'viewer'

  // 挂载拉取（refresh 供变更后重取；effect 内同步段不读响应式状态，不会回环）
  function refresh(): void {
    void (async () => {
      const [nextRows, cats] = await Promise.all([listProducts(), listCategories()])
      rows = nextRows
      categories = cats.map((c) => ({ label: c.name, value: c.name }))
    })()
  }

  $effect(() => {
    refresh()
  })

  // ---- 派生 ----
  const filtered = $derived.by(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (category && r.category !== category) return false
      if (kw && !r.name.toLowerCase().includes(kw)) return false
      return true
    })
  })

  // 手动分页（演示）：宿主 slice + 外部 oas-pagination（users/orders 用表格内置 pagination）
  const maxPage = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)))
  const current = $derived(Math.min(page, maxPage))
  const pageRows = $derived(filtered.slice((current - 1) * pageSize, current * pageSize))
  const shouldHidePager = $derived(view !== 'table' || filtered.length === 0)

  // 分页器 hidden 权威值命令式补写（见头注释第 5 条）；依赖须含 filtered.length 与 locale
  $effect(() => {
    void filtered.length
    void current
    void $locale
    if (pagerEl) pagerEl.hidden = shouldHidePager
  })

  // 分类被删后回落到「全部分类」（react 版由 query 数据变化驱动，此处同语义）
  $effect(() => {
    if (category && !categories.some((c) => c.value === category)) category = ''
  })

  // ---- 行为 ----
  function openForm(row: ProductRow | null): void {
    if (formMode === 'page') {
      if (row) sessionStorage.setItem('product-edit-id', String(row.id))
      else sessionStorage.removeItem('product-edit-id')
      navigate('/products/edit')
      return
    }
    editingId = row?.id ?? null
    surfaceOpen = true
  }

  async function toggleStatus(id: number): Promise<void> {
    const updated = await toggleProductStatus(id)
    if (!updated) {
      appMessage.error(t('products.notFound'))
      void refresh()
      return
    }
    appMessage.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
    void refresh()
  }

  async function inlineEdit(id: number, column: 'price' | 'stock', value: number): Promise<void> {
    const updated = await updateProduct(id, { [column]: value })
    if (!updated) appMessage.error(t('products.notFound'))
    else appMessage.success(t('common.saved'))
    void refresh()
  }

  function clearSelection(): void {
    selected = []
    tableEl?.removeAttribute('selected')
  }

  async function batchStatus(target: 'on' | 'off'): Promise<void> {
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    let changed = 0
    for (const id of selected) {
      const row = rows.find((r) => r.id === id)
      if (!row || row.status === target) continue
      if (await toggleProductStatus(id)) changed++
    }
    clearSelection()
    appMessage.success(t('products.batch.statusDone', { count: changed }))
    void refresh()
  }

  async function batchDelete(): Promise<void> {
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    let removed = 0
    for (const id of selected) {
      if (await removeProduct(id)) removed++
    }
    clearSelection()
    appMessage.success(t('products.batch.deleted', { count: removed }))
    void refresh()
  }

  // ---- 工具栏与列表事件（全部 oas-* 自定义事件 → onoas-* 直绑） ----
  function onSearchInput(e: Event): void {
    keyword = (e as CustomEvent<{ value: string }>).detail.value
    page = 1
  }
  function onSearchClear(): void {
    keyword = ''
    page = 1
  }
  function onCategoryChange(e: Event): void {
    category = (e as CustomEvent<{ value: string }>).detail.value
    page = 1
  }
  function onViewChange(e: Event): void {
    const v = (e as CustomEvent<{ value: string }>).detail.value as ViewMode
    if ((v !== 'cards' && v !== 'table') || v === view) return
    view = v
    page = 1
    localStorage.setItem(VIEW_KEY, v)
  }
  function onPagerChange(e: Event): void {
    page = (e as CustomEvent<{ page: number }>).detail.page
  }

  // 卡片网格：开关上下架（oas-change 委托，composedPath[0] 取实际开关）+ 编辑按钮原生 click
  function onGridChange(e: Event): void {
    const sw = e.composedPath()[0] as HTMLElement
    const id = Number(sw.getAttribute?.('data-id'))
    if (!id) return
    void toggleStatus(id)
  }
  function onGridClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest?.('[data-testid="product-edit"]')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = rows.find((r) => r.id === id)
    if (row) openForm(row)
  }

  // ---- 模板派生文案 ----
  const filterOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([{ label: t('products.allCategories'), value: '' }, ...categories])
  })
  const viewOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([
      { label: t('products.viewCards'), value: 'cards' },
      { label: t('products.viewTable'), value: 'table' },
    ])
  })
</script>

<div class="page products-page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.products')}</h1>
      <p class="page-subtitle">{tt('products.subtitle')}</p>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button
      data-testid="product-create"
      type="primary"
      icon="plus"
      onclick={() => openForm(null)}
    >
      {tt('products.newProduct')}
    </oas-button>
  </div>
  <div class="products-toolbar">
    <oas-input
      bind:this={searchEl}
      data-testid="product-search"
      placeholder={tt('products.search')}
      clearable
      prefix-icon="search"
      onoas-input={onSearchInput}
      onoas-clear={onSearchClear}
    ></oas-input>
    <oas-select
      data-testid="product-category"
      placeholder={tt('products.category')}
      options={filterOptions}
      value={category}
      onoas-change={onCategoryChange}
    ></oas-select>
    <oas-segmented
      data-testid="product-view"
      class="products-view-toggle"
      options={viewOptions}
      value={view}
      onoas-change={onViewChange}
    ></oas-segmented>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button
      data-testid="product-columns"
      class="products-columns-btn"
      icon="gear"
      onclick={() => (columnsOpen = true)}
    >
      {tt('products.columns.title')}
    </oas-button>
  </div>
  <ProductsBatchBar
    hidden={view !== 'table' || selected.length === 0}
    selectedCount={selected.length}
    canMutate={canMutate}
    onBatchStatus={(target) => void batchStatus(target)}
    onBatchDelete={() => void batchDelete()}
  />
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <oas-masonry
    class="product-grid"
    data-testid="product-grid"
    columns="4"
    gap="12px"
    hidden={view !== 'cards'}
    onclick={onGridClick}
    onoas-change={onGridChange}
  >
    {#if filtered.length === 0}
      <oas-empty description={tt('products.empty')}></oas-empty>
    {:else}
      {#each filtered as r (r.id)}
        <oas-card class="product-card" data-id={r.id}>
          <div class="product-card-head">
            <div class="product-name">{r.name}</div>
            <oas-tag class="cat-tag">{r.category}</oas-tag>
          </div>
          <div class="product-price mono">{formatMoney(r.price)}</div>
          <div class="product-meta">
            <span class={`product-stock is-${stockLevel(r.stock)}`}>
              {tt('products.stock', { n: r.stock })}
            </span>
            <span class="product-date mono">{r.created}</span>
          </div>
          <div class="product-card-foot">
            <div class="product-status">
              <oas-switch data-testid="product-switch" data-id={r.id} checked={r.status === 'on' ? '' : null}></oas-switch>
              <span class="product-status-label">
                {r.status === 'on' ? tt('products.status.on') : tt('products.status.off')}
              </span>
            </div>
            <oas-button
              class="product-edit"
              size="small"
              icon="edit"
              data-testid="product-edit"
              data-id={r.id}
              aria-label={tt('common.edit')}
            ></oas-button>
          </div>
        </oas-card>
      {/each}
    {/if}
  </oas-masonry>
  <ProductsTable
    bind:tableEl
    rows={pageRows}
    {columnKeys}
    {canMutate}
    empty={filtered.length === 0}
    hidden={view !== 'table'}
    onToggleStatus={(id) => void toggleStatus(id)}
    onEditRow={(id) => {
      const row = rows.find((r) => r.id === id)
      if (row) openForm(row)
    }}
    onCheck={(keys) => (selected = keys)}
    onInlineEdit={(id, column, value) => void inlineEdit(id, column, value)}
  />
  <!-- hidden 声明式仅首渲染兜底，权威值由上方 $effect 命令式补写（头注释第 5 条） -->
  <oas-pagination
    bind:this={pagerEl}
    data-testid="product-pager"
    hidden={shouldHidePager}
    total={filtered.length}
    page-size={pageSize}
    current={current}
    show-total
    onoas-change={onPagerChange}
  ></oas-pagination>
  {#if formMode !== 'page'}
    <ProductForm
      mode={formMode}
      open={surfaceOpen}
      {editingId}
      editing={rows.find((r) => r.id === editingId) ?? null}
      {categories}
      onClose={() => (surfaceOpen = false)}
      onSaved={() => {
        surfaceOpen = false
        void refresh()
      }}
    />
  {/if}
  <ProductsColumnsModal
    open={columnsOpen}
    {columnKeys}
    onChange={(keys) => (columnKeys = keys)}
    onClose={() => (columnsOpen = false)}
  />
</div>
