import { message } from '@oas-ui/ui/feedback/message'
import {
  createProduct,
  listProducts,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import type { ProductCategory, ProductRow } from '../data/products'

const CATEGORY_OPTIONS = [
  { label: '数码', value: '数码' },
  { label: '服饰', value: '服饰' },
  { label: '家居', value: '家居' },
  { label: '食品', value: '食品' },
]
const FILTER_OPTIONS = [{ label: '全部分类', value: '' }, ...CATEGORY_OPTIONS]

interface PageState {
  rows: ProductRow[]
  keyword: string
  category: ProductCategory | ''
  editingId: number | null
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    keyword: '',
    category: '',
    editingId: null,
  }
  let saving = false

  el.innerHTML = `
    <div class="page">
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
      </div>
      <div class="product-grid" data-testid="product-grid"></div>

      <oas-drawer data-testid="product-drawer" id="product-drawer" title="新建商品" placement="right" size="medium" no-footer>
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
        </oas-form>
      </oas-drawer>
    </div>`

  const grid = el.querySelector<HTMLElement>('[data-testid="product-grid"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="product-search"]')!
  const category = el.querySelector<HTMLElement>('[data-testid="product-category"]')!
  const form = el.querySelector<HTMLElement>('#product-form')!
  const drawer = el.querySelector<HTMLElement>('[data-testid="product-drawer"]')!
  const datePicker = el.querySelector<HTMLElement>('[data-testid="pf-date"]')!
  const upload = el.querySelector<HTMLElement>('[data-testid="pf-cover"]')!

  function filtered(): ProductRow[] {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (state.category && r.category !== state.category) return false
      if (kw && !r.name.toLowerCase().includes(kw)) return false
      return true
    })
  }

  function renderGrid(): void {
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
    datePicker.setAttribute('value', row?.created ?? today())
    ;(upload as unknown as { files: unknown[] }).files = []
    drawer.setAttribute('title', row ? `编辑商品 #${row.id}` : '新建商品')
  }

  function openForm(row: ProductRow | null): void {
    state.editingId = row?.id ?? null
    fillForm(row)
    drawer.setAttribute('visible', '')
  }

  async function refresh(): Promise<void> {
    state.rows = await listProducts()
    renderGrid()
  }

  el.querySelector<HTMLElement>('[data-testid="product-create"]')!.addEventListener('click', () => {
    openForm(null)
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

  el.querySelector<HTMLElement>('[data-testid="pf-cancel"]')!.addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector<HTMLElement>('[data-testid="pf-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  form.addEventListener('oas-submit', async (e) => {
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
        created: datePicker.getAttribute('value') || today(),
      }
      if (state.editingId == null) {
        await createProduct(payload)
        message.success('已创建')
      } else {
        await updateProduct(state.editingId, payload)
        message.success('已保存')
      }
      drawer.removeAttribute('visible')
      void refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value
    renderGrid()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    renderGrid()
  })

  category.addEventListener('oas-change', (e) => {
    state.category = (e as CustomEvent<{ value: string }>).detail.value as ProductCategory | ''
    renderGrid()
  })

  void refresh()
  return () => {}
}
