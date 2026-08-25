import { message } from '@oas-ui/ui/feedback/message'
import type { OASTable, TableColumn } from '@oas-ui/ui/data/table'
import {
  createProduct,
  listProducts,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import type { ProductCategory, ProductRow } from '../data/products'
import '../styles/pages/products.css'

const VIEW_KEY = 'oas-admin.products-view'
const FORM_MODE_KEY = 'oas-admin.form-mode'
const DENSITY_KEY = 'oas-admin.settings.table-density'
const PAGE_SIZE_KEY = 'oas-admin.settings.page-size'
const DEFAULT_PAGE_SIZE = 5

type ViewMode = 'cards' | 'table'
type FormMode = 'dialog' | 'drawer' | 'page'
type Density = 'compact' | 'default' | 'large'

const CATEGORY_OPTIONS = [
  { label: '数码', value: '数码' },
  { label: '服饰', value: '服饰' },
  { label: '家居', value: '家居' },
  { label: '食品', value: '食品' },
]
const FILTER_OPTIONS = [{ label: '全部分类', value: '' }, ...CATEGORY_OPTIONS]
const VIEW_OPTIONS = [
  { label: '卡片', value: 'cards' },
  { label: '列表', value: 'table' },
]
const DENSITY_PAD: Record<Density, string> = {
  compact: '6px',
  default: '12px',
  large: '16px',
}

interface PageState {
  rows: ProductRow[]
  keyword: string
  category: ProductCategory | ''
  editingId: number | null
  page: number
  view: ViewMode
  formMode: FormMode
  density: Density
  pageSize: number
}

function readView(): ViewMode {
  return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'
}

function readFormMode(): FormMode {
  const v = localStorage.getItem(FORM_MODE_KEY)
  return v === 'dialog' || v === 'page' ? v : 'drawer'
}

function readDensity(): Density {
  const v = localStorage.getItem(DENSITY_KEY)
  return v === 'compact' || v === 'large' ? v : 'default'
}

function readPageSize(): number {
  const n = Number(localStorage.getItem(PAGE_SIZE_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fromPath(path: EventTarget[], selector: string): HTMLElement | null {
  for (const item of path) {
    if (item instanceof HTMLElement && item.matches(selector)) return item
  }
  return null
}

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

function cellStock(stock: number): HTMLElement {
  const span = document.createElement('span')
  span.className = `product-stock is-${stockLevel(stock)}`
  span.textContent = `库存 ${stock}`
  return span
}

function cellStatus(row: ProductRow): HTMLElement {
  const sw = document.createElement('oas-switch')
  sw.setAttribute('data-testid', 'product-switch')
  sw.setAttribute('data-id', String(row.id))
  if (row.status === 'on') sw.setAttribute('checked', '')
  return sw
}

function cellAction(row: ProductRow): HTMLElement {
  const btn = document.createElement('oas-button')
  btn.className = 'product-edit'
  btn.setAttribute('data-testid', 'product-edit')
  btn.setAttribute('data-id', String(row.id))
  btn.setAttribute('size', 'small')
  btn.setAttribute('icon', 'edit')
  btn.setAttribute('aria-label', '编辑')
  return btn
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'name', title: '名称' },
  { key: 'category', title: '分类', render: (r) => cellTag(String(r.category)) },
  { key: 'price', title: '价格', align: 'right', render: (r) => cellPrice(Number(r.price)) },
  { key: 'stock', title: '库存', render: (r) => cellStock(Number(r.stock)) },
  { key: 'status', title: '状态', render: (r) => cellStatus(r as unknown as ProductRow) },
  { key: 'action', title: '操作', render: (r) => cellAction(r as unknown as ProductRow) },
]

const FORM_BODY = `
  <oas-form id="product-form" rules='{"name":[{"required":true,"message":"请输入商品名称"}]}'>
    <div class="product-form">
      <div class="form-field">
        <label class="form-label">商品名称</label>
        <oas-input data-testid="pf-name" name="name" placeholder="请输入名称"></oas-input>
      </div>
      <div class="form-field">
        <label class="form-label">分类</label>
        <oas-select data-testid="pf-category" name="category" options='${JSON.stringify(CATEGORY_OPTIONS)}' value="数码"></oas-select>
      </div>
      <div class="form-field">
        <label class="form-label">价格</label>
        <oas-input-number data-testid="pf-price" name="price" min="0.01" precision="2" placeholder="0.00"></oas-input-number>
      </div>
      <div class="form-field">
        <label class="form-label">库存</label>
        <oas-input-number data-testid="pf-stock" name="stock" min="0" placeholder="0"></oas-input-number>
      </div>
      <div class="form-field">
        <label class="form-label">上架日期</label>
        <oas-date-picker data-testid="pf-date" placeholder="选择日期"></oas-date-picker>
      </div>
      <div class="form-field">
        <label class="form-label">封面</label>
        <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture"></oas-upload>
      </div>
      <div class="form-actions">
        <oas-space justify="end">
          <oas-button data-testid="pf-cancel">取消</oas-button>
          <oas-button data-testid="pf-save" type="primary">保存</oas-button>
        </oas-space>
      </div>
    </div>
  </oas-form>`

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    keyword: '',
    category: '',
    editingId: null,
    page: 1,
    view: readView(),
    formMode: readFormMode(),
    density: readDensity(),
    pageSize: readPageSize(),
  }
  let saving = false

  const surfaceMarkup =
    state.formMode === 'dialog'
      ? `<oas-modal data-testid="product-dialog" id="product-surface" no-footer><div class="modal-body"><h2 id="form-title">新建商品</h2>${FORM_BODY}</div></oas-modal>`
      : state.formMode === 'drawer'
        ? `<oas-drawer data-testid="product-drawer" id="product-surface" title="新建商品" placement="right" size="medium" no-footer>${FORM_BODY}</oas-drawer>`
        : ''

  el.innerHTML = `
    <div class="page products-page">
      <div class="page-head">
        <div>
          <h1 class="page-title">商品管理</h1>
          <p class="page-subtitle">维护商品资料与上下架状态</p>
        </div>
        <oas-button data-testid="product-create" type="primary" icon="plus">新建商品</oas-button>
      </div>
      <div class="products-toolbar">
        <oas-input data-testid="product-search" placeholder="搜索商品名称" clearable prefix-icon="search"></oas-input>
        <oas-select data-testid="product-category" placeholder="分类" options='${JSON.stringify(FILTER_OPTIONS)}' value=""></oas-select>
        <oas-segmented data-testid="product-view" class="products-view-toggle" options='${JSON.stringify(VIEW_OPTIONS)}' value="${state.view}"></oas-segmented>
      </div>
      <div class="product-grid" data-testid="product-grid"${state.view === 'table' ? ' hidden' : ''}></div>
      <div class="table-wrap products-table-wrap"${state.view === 'cards' ? ' hidden' : ''}>
        <oas-table data-testid="product-table" row-key="id"></oas-table>
        <div class="product-list-empty" data-testid="product-empty" hidden>
          <oas-empty description="未找到匹配商品"></oas-empty>
        </div>
      </div>
      <oas-pagination data-testid="product-pager" hidden total="0" page-size="${state.pageSize}" current="1" show-total></oas-pagination>
      ${surfaceMarkup}
    </div>`

  const grid = el.querySelector<HTMLElement>('[data-testid="product-grid"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="product-search"]')!
  const category = el.querySelector<HTMLElement>('[data-testid="product-category"]')!
  const viewSeg = el.querySelector<HTMLElement>('[data-testid="product-view"]')!
  const tableWrap = el.querySelector<HTMLElement>('.products-table-wrap')!
  const table = el.querySelector<OASTable>('[data-testid="product-table"]')!
  const pager = el.querySelector<HTMLElement>('[data-testid="product-pager"]')!
  const empty = el.querySelector<HTMLElement>('[data-testid="product-empty"]')!
  const createBtn = el.querySelector<HTMLElement>('[data-testid="product-create"]')!
  const surface = el.querySelector<HTMLElement>('#product-surface')
  const form = el.querySelector<HTMLElement>('#product-form')
  const datePicker = el.querySelector<HTMLElement>('[data-testid="pf-date"]')
  const upload = el.querySelector<HTMLElement>('[data-testid="pf-cover"]')

  if (table) table.columns = TABLE_COLUMNS
  if (table) table.style.setProperty('--oas-table-cell-padding-block', DENSITY_PAD[state.density])

  function filtered(): ProductRow[] {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (state.category && r.category !== state.category) return false
      if (kw && !r.name.toLowerCase().includes(kw)) return false
      return true
    })
  }

  function renderCards(): void {
    const list = filtered()
    if (list.length === 0) {
      grid.innerHTML = `<oas-empty description="未找到匹配商品"></oas-empty>`
      return
    }
    grid.innerHTML = list
      .map(
        (r) => `
        <oas-card class="product-card" data-id="${r.id}">
          <div class="product-card-head">
            <div class="product-name">${r.name}</div>
            <oas-tag class="cat-tag">${r.category}</oas-tag>
          </div>
          <div class="product-price mono">${formatMoney(r.price)}</div>
          <div class="product-meta">
            <span class="product-stock is-${stockLevel(r.stock)}">库存 ${r.stock}</span>
            <span class="product-date mono">${r.created}</span>
          </div>
          <div class="product-card-foot">
            <div class="product-status">
              <oas-switch data-testid="product-switch" data-id="${r.id}"${r.status === 'on' ? ' checked' : ''}></oas-switch>
              <span class="product-status-label">${r.status === 'on' ? '已上架' : '已下架'}</span>
            </div>
            <oas-button class="product-edit" size="small" icon="edit" data-testid="product-edit" data-id="${r.id}" aria-label="编辑"></oas-button>
          </div>
        </oas-card>`,
      )
      .join('')
  }

  function renderTableBody(): void {
    const list = filtered()
    if (list.length === 0) {
      table.setAttribute('data', '[]')
      table.classList.add('table-hidden')
      pager.setAttribute('total', '0')
      pager.setAttribute('current', '1')
      pager.hidden = true
      empty.hidden = false
      return
    }
    const maxPage = Math.max(1, Math.ceil(list.length / state.pageSize))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
    table.setAttribute('data', JSON.stringify(slice))
    table.classList.remove('table-hidden')
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
    pager.setAttribute('page-size', String(state.pageSize))
    pager.hidden = false
    empty.hidden = true
  }

  function renderList(): void {
    if (state.view === 'cards') {
      renderCards()
    } else {
      renderTableBody()
    }
  }

  function fillForm(row: ProductRow | null): void {
    el.querySelector<HTMLElement>('[data-testid="pf-name"]')!.setAttribute('value', row?.name ?? '')
    el.querySelector<HTMLElement>('[data-testid="pf-category"]')!.setAttribute(
      'value',
      row?.category ?? '数码',
    )
    el.querySelector<HTMLElement>('[data-testid="pf-price"]')!.setAttribute(
      'value',
      row ? String(row.price) : '',
    )
    el.querySelector<HTMLElement>('[data-testid="pf-stock"]')!.setAttribute(
      'value',
      row ? String(row.stock) : '',
    )
    if (datePicker) datePicker.setAttribute('value', row?.created ?? today())
    if (upload) (upload as unknown as { files: unknown[] }).files = []
    const titleEl = el.querySelector<HTMLElement>('#form-title')
    if (titleEl) titleEl.textContent = row ? `编辑商品 #${row.id}` : '新建商品'
    else if (surface) surface.setAttribute('title', row ? `编辑商品 #${row.id}` : '新建商品')
  }

  function openForm(row: ProductRow | null): void {
    if (state.formMode === 'page') {
      if (row) sessionStorage.setItem('product-edit-id', String(row.id))
      else sessionStorage.removeItem('product-edit-id')
      location.hash = '/products/edit'
      return
    }
    state.editingId = row?.id ?? null
    fillForm(row)
    surface?.setAttribute('visible', '')
  }

  async function refresh(): Promise<void> {
    state.rows = await listProducts()
    renderList()
  }

  createBtn.addEventListener('click', () => openForm(null))

  viewSeg.addEventListener('oas-change', (e) => {
    const v = (e as CustomEvent<{ value: string }>).detail.value as ViewMode
    if (v === state.view) return
    state.view = v
    state.page = 1
    localStorage.setItem(VIEW_KEY, v)
    grid.hidden = v !== 'cards'
    tableWrap.hidden = v !== 'table'
    pager.hidden = v !== 'table'
    renderList()
  })

  grid.addEventListener('oas-change', async (e) => {
    const sw = e.composedPath()[0] as HTMLElement
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    const updated = await toggleProductStatus(id)
    if (!updated) {
      message.error('该商品不存在')
      return
    }
    message.success(updated.status === 'on' ? '已上架' : '已下架')
    void refresh()
  })

  grid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-testid="product-edit"]')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = state.rows.find((r) => r.id === id)
    if (row) openForm(row)
  })

  table.addEventListener('oas-change', async (e) => {
    const sw = e.composedPath()[0] as HTMLElement
    if (sw.getAttribute('data-testid') !== 'product-switch') return
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    const updated = await toggleProductStatus(id)
    if (!updated) {
      message.error('该商品不存在')
      return
    }
    message.success(updated.status === 'on' ? '已上架' : '已下架')
    void refresh()
  })

  table.addEventListener('click', (e) => {
    const btn = fromPath(e.composedPath(), '.product-edit')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = state.rows.find((r) => r.id === id)
    if (row) openForm(row)
  })

  el.querySelector<HTMLElement>('[data-testid="pf-cancel"]')?.addEventListener('click', () => {
    surface?.removeAttribute('visible')
  })

  el.querySelector<HTMLElement>('[data-testid="pf-save"]')?.addEventListener('click', () => {
    ;(form?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  form?.addEventListener('oas-submit', async (e) => {
    if (saving) return
    const values = (
      e as CustomEvent<{
        values: { name: string; category: ProductCategory; price: string; stock: string }
      }>
    ).detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      message.error('价格需大于 0')
      return
    }
    saving = true
    try {
      const editing =
        state.editingId != null ? state.rows.find((r) => r.id === state.editingId) : null
      const payload = {
        name: values.name,
        category: values.category || '数码',
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? 'on',
        created: datePicker?.getAttribute('value') || today(),
      }
      if (state.editingId == null) {
        await createProduct(payload)
        message.success('已创建')
      } else {
        await updateProduct(state.editingId, payload)
        message.success('已保存')
      }
      surface?.removeAttribute('visible')
      void refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value
    state.page = 1
    renderList()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    state.page = 1
    renderList()
  })

  category.addEventListener('oas-change', (e) => {
    state.category = (e as CustomEvent<{ value: string }>).detail.value as ProductCategory | ''
    state.page = 1
    renderList()
  })

  pager.addEventListener('oas-change', (e) => {
    state.page = (e as CustomEvent<{ page: number }>).detail.page
    renderList()
  })

  void refresh()
  return () => {}
}
