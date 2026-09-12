<script lang="ts">
  // src/pages/category.svelte —— 商品分类（表格 + 搜索 + modal 表单 + popconfirm 删除）
  // 对齐 react 版 category.tsx：rows 挂载时经 listCategories 拉取，keyword/editingId/modalOpen
  // 全部 $state，过滤/空态/弹窗标题由 state 派生；CRUD 后刷新列表。
  // 1. 事件绑定：search 的 oas-input/oas-clear、form 的 oas-submit、popconfirm 的 oas-ok、
  //    modal 的 oas-close 模板直绑；新建按钮与弹窗面板内按钮为原生 click 直绑
  // 2. columns 含 render 函数（cellTag/cellAction 返回真实 DOM 节点），走 property 通道；
  //    行内编辑按钮经 oas-table 宿主 click 委托 + composedPath 识别（shadow 内原生 click 可冒出）
  // 3. popconfirm v2.2.8 起原生自驱动：oas-ok 事件从 detail.source 取 data-del-id
  // 4. 子组件拆分（单文件 ≤400 行纪律）：表单弹窗 ./category-form-modal.svelte
  import { onMount } from 'svelte'
  import type { TableColumn } from '@oas-ui/ui/data/table'
  type CategoryRow = import('../data/categories').CategoryRow
  import { listCategories, removeCategory } from '../data/categories'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'
  import CategoryFormModal from './category-form-modal.svelte'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let rows = $state<CategoryRow[]>([])
  let keyword = $state('')
  let editingId = $state<number | null>(null)
  let modalOpen = $state(false)

  let tableEl: HTMLElement | null = $state(null)

  async function refresh(): Promise<void> {
    rows = await listCategories()
  }

  onMount(() => {
    void refresh()
  })

  /** vanilla cellTag：行内状态标签 */
  function cellTag(row: CategoryRow): HTMLElement {
    const tag = document.createElement('oas-tag')
    tag.setAttribute('type', row.status === 'on' ? 'success' : 'default')
    tag.textContent = tt(row.status === 'on' ? 'category.status.on' : 'category.status.off')
    return tag
  }

  /** vanilla cellAction：编辑按钮 + popconfirm 包裹的删除按钮（testid/data-id 逐字对齐） */
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

  /** vanilla TABLE_COLUMNS；含 render 函数走 property 通道，随 locale 重算 */
  const columns = $derived.by<TableColumn[]>(() => {
    void $locale
    return [
      { key: 'name', title: tt('category.th.name') },
      { key: 'code', title: tt('category.th.code') },
      { key: 'sort', title: tt('category.th.sort'), align: 'right' },
      { key: 'status', title: tt('category.th.status'), render: (r) => cellTag(r as unknown as CategoryRow) },
      { key: 'action', title: tt('category.th.action'), render: (r) => cellAction(r as unknown as CategoryRow) },
    ]
  })

  // columns 走 property 通道（attribute 会把函数 JSON 掉）；每次重算整组赋值
  $effect(() => {
    if (tableEl) (tableEl as HTMLElement & { columns: TableColumn[] }).columns = columns
  })

  const filtered = $derived.by(() => {
    const kw = keyword.trim()
    return rows.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
  })

  // data 走 JSON 字符串通道
  const rowsJson = $derived(JSON.stringify(filtered))

  const editing = $derived(editingId != null ? (rows.find((r) => r.id === editingId) ?? null) : null)

  function onCreate(): void {
    editingId = null
    modalOpen = true
  }

  function onModalClose(): void {
    modalOpen = false
  }

  function onFormSaved(): void {
    modalOpen = false
    editingId = null
    void refresh()
  }

  /** 行点击委托：composedPath 识别行内编辑按钮（shadow 内原生 click 可冒出 oas-table） */
  function onTableClick(e: MouseEvent): void {
    const btn = e
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.matches('[data-testid="category-edit"]'),
      )
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    if (rows.some((r) => r.id === id)) {
      editingId = id
      modalOpen = true
    }
  }

  function onDeleteOk(e: Event): void {
    const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
    const raw = src?.hasAttribute?.('data-del-id') ? src.getAttribute('data-del-id') : null
    const id = Number(raw)
    if (!raw || !Number.isFinite(id)) return
    void (async () => {
      await removeCategory(id)
      editingId = null
      appMessage.success(tt('common.deleted'))
      void refresh()
    })()
  }

  function onSearchInput(e: Event): void {
    keyword = (e as CustomEvent<{ value: string }>).detail.value ?? ''
  }
  function onSearchClear(): void {
    keyword = ''
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.category')}</h1>
      <p class="page-subtitle">{tt('category.subtitle')}</p>
    </div>
    <oas-button data-testid="category-create" type="primary" icon="plus" onclick={onCreate}>
      {tt('category.new')}
    </oas-button>
  </div>
  <div class="dict-items-card">
    <div class="dict-pane-head">
      <oas-input
        data-testid="category-search"
        class="category-search"
        placeholder={tt('category.search')}
        prefix-icon="search"
        clearable
        onoas-input={onSearchInput}
        onoas-clear={onSearchClear}
      ></oas-input>
    </div>
    <div id="category-items-wrap" class:table-hidden={filtered.length === 0}>
      <oas-table
        bind:this={tableEl}
        data-testid="category-table"
        row-key="id"
        data={rowsJson}
        onclick={onTableClick}
        onoas-ok={onDeleteOk}
      ></oas-table>
      <div
        class="table-empty"
        data-testid="category-empty"
        hidden={filtered.length !== 0}
      >
        <oas-empty description={tt('category.empty')}></oas-empty>
      </div>
    </div>
  </div>

  <CategoryFormModal
    open={modalOpen}
    {editingId}
    {editing}
    onClose={onModalClose}
    onSaved={onFormSaved}
  />
</div>

<style>
  /* 分类页样式（自 react 版 category.css 迁入）：仅本页使用的搜索框高度修正 */
  .category-search {
    width: 280px;
    max-width: 100%;
  }
  .category-search::part(input) {
    height: 32px;
  }
</style>
