import { message } from '@oas-ui/ui/feedback/message'
import type { OASTable, TableColumn } from '@oas-ui/ui/data/table'
import { t } from '../i18n'
import { listCategories } from '../data/categories'
import {
  createProduct,
  listProducts,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import type { ProductRow } from '../data/products'
import '../styles/pages/products.css'

const VIEW_KEY = 'oas-admin.products-view'
const FORM_MODE_KEY = 'oas-admin.form-mode'
const DENSITY_KEY = 'oas-admin.settings.table-density'
const PAGE_SIZE_KEY = 'oas-admin.settings.page-size'
const DEFAULT_PAGE_SIZE = 5

type ViewMode = 'cards' | 'table'
type FormMode = 'dialog' | 'drawer' | 'page'
type Density = 'compact' | 'default' | 'large'

type Option = { label: string; value: string }

const FILTER_OPTIONS = (categories: Option[]): Option[] => [
  { label: t('products.allCategories'), value: '' },
  ...categories,
]
const VIEW_OPTIONS = (): Array<{ label: string; value: string }> => [
  { label: t('products.viewCards'), value: 'cards' },
  { label: t('products.viewTable'), value: 'table' },
]
const DENSITY_PAD: Record<Density, string> = {
  compact: '6px',
  default: '12px',
  large: '16px',
}

interface PageState {
  rows: ProductRow[]
  categories: Option[]
  keyword: string
  category: string
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

function cellAction(row: ProductRow): HTMLElement {
  const btn = document.createElement('oas-button')
  btn.className = 'product-edit'
  btn.setAttribute('data-testid', 'product-edit')
  btn.setAttribute('data-id', String(row.id))
  btn.setAttribute('size', 'small')
  btn.setAttribute('icon', 'edit')
  btn.setAttribute('aria-label', t('common.edit'))
  return btn
}

const TABLE_COLUMNS = (): TableColumn[] => [
  { key: 'name', title: t('products.th.name') },
  { key: 'category', title: t('products.category'), render: (r) => cellTag(String(r.category)) },
  {
    key: 'price',
    title: t('products.th.price'),
    align: 'right',
    render: (r) => cellPrice(Number(r.price)),
  },
  { key: 'stock', title: t('products.th.stock'), render: (r) => cellStock(Number(r.stock)) },
  {
    key: 'status',
    title: t('products.th.status'),
    render: (r) => cellStatus(r as unknown as ProductRow),
  },
  {
    key: 'action',
    title: t('products.th.action'),
    render: (r) => cellAction(r as unknown as ProductRow),
  },
]

const FORM_BODY = (): string => `
  <oas-form id="product-form" rules='${JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })}'>
    <div class="product-form">
      <div class="form-field">
        <label class="form-label">${t('products.form.name')}</label>
        <oas-input data-testid="pf-name" name="name" placeholder="${t('products.form.namePlaceholder')}"></oas-input>
      </div>
      <div class="form-field">
        <label class="form-label">${t('products.category')}</label>
        <oas-select data-testid="pf-category" name="category"></oas-select>
      </div>
      <div class="form-field">
        <label class="form-label">${t('products.th.price')}</label>
        <oas-input-number data-testid="pf-price" name="price" min="0.01" precision="2" placeholder="0.00"></oas-input-number>
      </div>
      <div class="form-field">
        <label class="form-label">${t('products.th.stock')}</label>
        <oas-input-number data-testid="pf-stock" name="stock" min="0" placeholder="0"></oas-input-number>
      </div>
      <div class="form-field">
        <label class="form-label">${t('products.form.listedDate')}</label>
        <oas-date-picker data-testid="pf-date" placeholder="${t('products.form.datePlaceholder')}"></oas-date-picker>
      </div>
      <div class="form-field">
        <label class="form-label">${t('products.form.cover')}</label>
        <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture"></oas-upload>
      </div>
      <div class="form-actions">
        <oas-space justify="end">
          <oas-button data-testid="pf-cancel">${t('common.cancel')}</oas-button>
          <oas-button data-testid="pf-save" type="primary">${t('common.save')}</oas-button>
        </oas-space>
      </div>
    </div>
  </oas-form>`

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    categories: [],
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
      ? `<oas-modal data-testid="product-dialog" id="product-surface" no-footer><div class="modal-body"><h2 id="form-title">${t('products.newProduct')}</h2>${FORM_BODY()}</div></oas-modal>`
      : state.formMode === 'drawer'
        ? `<oas-drawer data-testid="product-drawer" id="product-surface" title="${t('products.newProduct')}" placement="right" size="medium" no-footer>${FORM_BODY()}</oas-drawer>`
        : ''

  el.innerHTML = `
    <div class="page products-page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.products')}</h1>
          <p class="page-subtitle">${t('products.subtitle')}</p>
        </div>
        <oas-button data-testid="product-create" type="primary" icon="plus">${t('products.newProduct')}</oas-button>
      </div>
      <div class="products-toolbar">
        <oas-input data-testid="product-search" placeholder="${t('products.search')}" clearable prefix-icon="search"></oas-input>
        <oas-select data-testid="product-category" placeholder="${t('products.category')}" options='${JSON.stringify(FILTER_OPTIONS([]))}' value=""></oas-select>
        <oas-segmented data-testid="product-view" class="products-view-toggle" options='${JSON.stringify(VIEW_OPTIONS())}' value="${state.view}"></oas-segmented>
      </div>
      <div class="product-grid" data-testid="product-grid"${state.view === 'table' ? ' hidden' : ''}></div>
      <div class="table-wrap products-table-wrap"${state.view === 'cards' ? ' hidden' : ''}>
        <oas-table data-testid="product-table" row-key="id"></oas-table>
        <div class="product-list-empty" data-testid="product-empty" hidden>
          <oas-empty description="${t('products.empty')}"></oas-empty>
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

  if (table) table.columns = TABLE_COLUMNS()

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
      grid.innerHTML = `<oas-empty description="${t('products.empty')}"></oas-empty>`
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
            <span class="product-stock is-${stockLevel(r.stock)}">${t('products.stock', { n: r.stock })}</span>
            <span class="product-date mono">${r.created}</span>
          </div>
          <div class="product-card-foot">
            <div class="product-status">
              <oas-switch data-testid="product-switch" data-id="${r.id}"${r.status === 'on' ? ' checked' : ''}></oas-switch>
              <span class="product-status-label">${r.status === 'on' ? t('products.status.on') : t('products.status.off')}</span>
            </div>
            <oas-button class="product-edit" size="small" icon="edit" data-testid="product-edit" data-id="${r.id}" aria-label="${t('common.edit')}"></oas-button>
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

  function resolveCategory(value?: string): string {
    if (value && state.categories.some((c) => c.value === value)) return value
    return state.categories[0]?.value ?? ''
  }

  function applyCategoryOptions(): void {
    category.setAttribute('options', JSON.stringify(FILTER_OPTIONS(state.categories)))
    const formCat = el.querySelector<HTMLElement>('[data-testid="pf-category"]')
    if (formCat) formCat.setAttribute('options', JSON.stringify(state.categories))
    if (state.category && !state.categories.some((c) => c.value === state.category)) {
      state.category = ''
      category.setAttribute('value', '')
    }
  }

  function fillForm(row: ProductRow | null): void {
    el.querySelector<HTMLElement>('[data-testid="pf-name"]')!.setAttribute('value', row?.name ?? '')
    el.querySelector<HTMLElement>('[data-testid="pf-category"]')!.setAttribute(
      'value',
      resolveCategory(row?.category),
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
    if (titleEl)
      titleEl.textContent = row
        ? t('products.editItem').replace('#{id}', String(row.id))
        : t('products.newProduct')
    else if (surface)
      surface.setAttribute(
        'title',
        row ? t('products.editItem').replace('#{id}', String(row.id)) : t('products.newProduct'),
      )
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
    const [rows, cats] = await Promise.all([listProducts(), listCategories()])
    state.rows = rows
    state.categories = cats.map((c) => ({ label: c.name, value: c.name }))
    applyCategoryOptions()
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
      message.error(t('products.notFound'))
      return
    }
    message.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
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
      message.error(t('products.notFound'))
      return
    }
    message.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
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
        values: { name: string; category: string; price: string; stock: string }
      }>
    ).detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      message.error(t('products.priceError'))
      return
    }
    saving = true
    try {
      const editing =
        state.editingId != null ? state.rows.find((r) => r.id === state.editingId) : null
      const payload = {
        name: values.name,
        category: values.category || resolveCategory(),
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? 'on',
        created: datePicker?.getAttribute('value') || today(),
      }
      if (state.editingId == null) {
        await createProduct(payload)
        message.success(t('common.created'))
      } else {
        await updateProduct(state.editingId, payload)
        message.success(t('common.saved'))
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
    state.category = (e as CustomEvent<{ value: string }>).detail.value
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
