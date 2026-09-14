/**
 * 商品列表页（自 vanilla src/pages/products.ts 去 TS 移植）
 * 卡片 / 列表双视图 + 外部分页（pager hidden 命令式补写）+ 批量操作 + 列设置 + 三形态表单
 * 列定义见 product-table.js、批量/列设置/行内编辑见 product-extras.js、表单体见 product-form.js
 */
import { onLocaleChange, t } from './i18n.js'
import { listCategories } from './data/categories.js'
import {
  createProduct,
  listProducts,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from './data/products.js'
import { readProductColumns } from './product-columns.js'
import {
  bindBatchBar,
  bindColumnsModal,
  bindInlineEdit,
  clearSelection,
  renderColumnList,
  renderColumns,
  updateBatchBar,
} from './product-extras.js'
import { fillProductForm, productFormBody, readFormMode, today } from './product-form.js'
import { formatMoney } from './product-table.js'

const VIEW_KEY = 'oas-admin-cdn.products-view'
const PAGE_SIZE_KEY = 'oas-admin-cdn.settings.page-size'
const DEFAULT_PAGE_SIZE = 5

function readView() {
  return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'
}

function readPageSize() {
  const n = Number(localStorage.getItem(PAGE_SIZE_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE
}

function filterOptions(categories) {
  return [{ label: t('products.allCategories'), value: '' }, ...categories]
}

function viewOptions() {
  return [
    { label: t('products.viewCards'), value: 'cards' },
    { label: t('products.viewTable'), value: 'table' },
  ]
}

export function renderProducts(el) {
  const state = {
    rows: [],
    categories: [],
    keyword: '',
    category: '',
    editingId: null,
    page: 1,
    view: readView(),
    formMode: readFormMode(),
    pageSize: readPageSize(),
    selected: [],
    columnKeys: readProductColumns(),
  }
  let saving = false

  function draw() {
    document.title = `${t('nav.products')} · ${t('app.title')}`
    const surfaceMarkup =
      state.formMode === 'dialog'
        ? `<oas-modal data-testid="product-dialog" id="product-surface" no-footer><div class="modal-body"><h2 id="form-title">${t('products.newProduct')}</h2>${productFormBody('product-form')}</div></oas-modal>`
        : state.formMode === 'drawer'
          ? `<oas-drawer data-testid="product-drawer" id="product-surface" title="${t('products.newProduct')}" placement="right" size="medium" no-footer>${productFormBody('product-form')}</oas-drawer>`
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
        <oas-select data-testid="product-category" placeholder="${t('products.category')}" options='${JSON.stringify(filterOptions([]))}' value=""></oas-select>
        <oas-segmented data-testid="product-view" class="products-view-toggle" options='${JSON.stringify(viewOptions())}' value="${state.view}"></oas-segmented>
        <oas-button data-testid="product-columns" class="products-columns-btn" icon="gear">${t('products.columns.title')}</oas-button>
      </div>
      <div class="product-batch-bar" data-testid="product-batch-bar" hidden>
        <span class="product-batch-count" data-testid="product-batch-count"></span>
        <oas-space class="product-batch-actions" justify="end">
          <oas-button data-testid="product-batch-unlist" size="small">${t('products.batch.unlist')}</oas-button>
          <oas-button data-testid="product-batch-list" size="small">${t('products.batch.list')}</oas-button>
          <oas-popconfirm data-testid="product-batch-del-pop" id="product-batch-del-pop" title="">
            <oas-button data-testid="product-batch-delete" size="small" type="danger">${t('products.batch.delete')}</oas-button>
          </oas-popconfirm>
        </oas-space>
      </div>
      <oas-masonry class="product-grid" data-testid="product-grid" columns="4" gap="12px"${state.view === 'table' ? ' hidden' : ''}></oas-masonry>
      <div class="table-wrap products-table-wrap"${state.view === 'cards' ? ' hidden' : ''}>
        <oas-table data-testid="product-table" row-key="id" checkable stripe></oas-table>
        <div class="product-list-empty" data-testid="product-empty" hidden>
          <oas-empty description="${t('products.empty')}"></oas-empty>
        </div>
      </div>
      <oas-pagination data-testid="product-pager" hidden total="0" page-size="${state.pageSize}" current="1" show-total></oas-pagination>
      ${surfaceMarkup}
      <oas-modal data-testid="product-columns-modal" id="product-columns-modal" title="${t('products.columns.title')}" no-footer>
        <div class="product-columns-list" data-testid="product-columns-list"></div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="product-columns-reset">${t('products.columns.reset')}</oas-button>
            <oas-button data-testid="product-columns-close" type="primary">${t('common.save')}</oas-button>
          </oas-space>
        </div>
      </oas-modal>
    </div>`
    bind()
    renderTableColumns()
    renderColumnList(el, state.columnKeys)
    updateBatchBar(el, state)
    void refresh()
  }

  const q = (sel) => el.querySelector(sel)

  function renderTableColumns() {
    renderColumns(q('[data-testid="product-table"]'), state.columnKeys)
  }

  function filtered() {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (state.category && r.category !== state.category) return false
      if (kw && !r.name.toLowerCase().includes(kw)) return false
      return true
    })
  }

  function renderCards() {
    const grid = q('[data-testid="product-grid"]')
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

  function renderTableBody() {
    const table = q('[data-testid="product-table"]')
    const pager = q('[data-testid="product-pager"]')
    const list = filtered()
    if (list.length === 0) {
      table.setAttribute('data', '[]')
      table.classList.add('table-hidden')
      pager.setAttribute('total', '0')
      pager.setAttribute('current', '1')
      pager.hidden = true
      q('[data-testid="product-empty"]').hidden = false
      return
    }
    // 手动分页模式（演示）：宿主 slice + 外部 oas-pagination；orders/users 用表格内置 pagination
    const maxPage = Math.max(1, Math.ceil(list.length / state.pageSize))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
    table.setAttribute('data', JSON.stringify(slice))
    table.classList.remove('table-hidden')
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
    pager.setAttribute('page-size', String(state.pageSize))
    // oas-pagination 的 update() 在 total/current 变更与语言自刷时无条件自摘 hidden
    //（为 hide-on-single 预留；hidden 非 observedAttributes，补写不回环）——渲染后命令式补写权威值
    pager.hidden = false
    q('[data-testid="product-empty"]').hidden = true
  }

  function renderList() {
    if (state.view === 'cards') renderCards()
    else renderTableBody()
  }

  function applyCategoryOptions() {
    const category = q('[data-testid="product-category"]')
    category.setAttribute('options', JSON.stringify(filterOptions(state.categories)))
    const formCat = q('[data-testid="pf-category"]')
    if (formCat) formCat.setAttribute('options', JSON.stringify(state.categories))
    if (state.category && !state.categories.some((c) => c.value === state.category)) {
      state.category = ''
      category.setAttribute('value', '')
    }
  }

  function openForm(row) {
    if (state.formMode === 'page') {
      if (row) sessionStorage.setItem('product-edit-id', String(row.id))
      else sessionStorage.removeItem('product-edit-id')
      location.hash = '#/products/edit'
      return
    }
    state.editingId = row?.id ?? null
    const surface = q('#product-surface')
    fillProductForm(el, row, state.categories)
    const title = row ? t('products.editItem', { id: row.id }) : t('products.newProduct')
    const titleEl = q('#form-title')
    if (titleEl) titleEl.textContent = title
    else surface?.setAttribute('title', title)
    surface?.setAttribute('visible', '')
  }

  async function refresh() {
    const [rows, cats] = await Promise.all([listProducts(), listCategories()])
    state.rows = rows
    state.categories = cats.map((c) => ({ label: c.name, value: c.name }))
    applyCategoryOptions()
    renderList()
  }

  function bind() {
    q('[data-testid="product-create"]').addEventListener('click', () => openForm(null))

    const table = q('[data-testid="product-table"]')
    bindInlineEdit(table, { refresh })

    table.addEventListener('oas-check', (e) => {
      const keys = e.detail.keys
      state.selected = keys.map(Number).filter((n) => Number.isFinite(n))
      updateBatchBar(el, state)
    })

    bindBatchBar(el, state, { refresh, clear: () => clearSelection(el, state) })
    bindColumnsModal(el, state, { renderTableColumns })

    q('[data-testid="product-view"]').addEventListener('oas-change', (e) => {
      const v = e.detail.value
      if (v === state.view) return
      state.view = v
      state.page = 1
      localStorage.setItem(VIEW_KEY, v)
      q('[data-testid="product-grid"]').hidden = v !== 'cards'
      el.querySelector('.products-table-wrap').hidden = v !== 'table'
      q('[data-testid="product-pager"]').hidden = v !== 'table'
      updateBatchBar(el, state)
      renderList()
    })

    q('[data-testid="product-grid"]').addEventListener('oas-change', async (e) => {
      const sw = e.composedPath()[0]
      const id = Number(sw.getAttribute?.('data-id'))
      if (!id) return
      await toggleOne(id)
    })

    q('[data-testid="product-grid"]').addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-testid="product-edit"]')
      if (!btn) return
      const row = state.rows.find((r) => r.id === Number(btn.getAttribute('data-id')))
      if (row) openForm(row)
    })

    table.addEventListener('oas-change', async (e) => {
      const sw = e.composedPath()[0]
      if (sw.getAttribute?.('data-testid') !== 'product-switch') return
      const id = Number(sw.getAttribute('data-id'))
      if (!id) return
      await toggleOne(id)
    })

    table.addEventListener('click', (e) => {
      const btn = e.composedPath().find((n) => n.matches?.('.product-edit'))
      if (!btn) return
      const row = state.rows.find((r) => r.id === Number(btn.getAttribute('data-id')))
      if (row) openForm(row)
    })

    q('[data-testid="pf-cancel"]')?.addEventListener('click', () => {
      q('#product-surface')?.removeAttribute('visible')
    })

    q('[data-testid="pf-save"]')?.addEventListener('click', () => {
      q('#product-form')?.shadowRoot?.querySelector('form')?.requestSubmit()
    })

    q('#product-form')?.addEventListener('oas-submit', async (e) => {
      await submitProduct(e.detail.values)
    })

    q('[data-testid="product-search"]').addEventListener('oas-input', (e) => {
      state.keyword = e.detail.value ?? ''
      state.page = 1
      renderList()
    })
    q('[data-testid="product-search"]').addEventListener('oas-clear', () => {
      state.keyword = ''
      state.page = 1
      renderList()
    })

    q('[data-testid="product-category"]').addEventListener('oas-change', (e) => {
      state.category = e.detail.value
      state.page = 1
      renderList()
    })

    q('[data-testid="product-pager"]').addEventListener('oas-change', (e) => {
      state.page = e.detail.page
      renderList()
    })
  }

  async function toggleOne(id) {
    const updated = await toggleProductStatus(id)
    if (!updated) {
      OASUI.message.error(t('products.notFound'))
      return
    }
    OASUI.message.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
    void refresh()
  }

  async function submitProduct(values) {
    if (saving) return
    const price = Number(values.price)
    if (!(price > 0)) {
      OASUI.message.error(t('products.priceError'))
      return
    }
    saving = true
    try {
      const editing = state.editingId != null ? state.rows.find((r) => r.id === state.editingId) : null
      const payload = {
        name: values.name,
        category: values.category || state.categories[0]?.value || '',
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? 'on',
        created: q('[data-testid="pf-date"]')?.getAttribute('value') || today(),
      }
      if (state.editingId == null) {
        await createProduct(payload)
        OASUI.message.success(t('common.created'))
      } else {
        await updateProduct(state.editingId, payload)
        OASUI.message.success(t('common.saved'))
      }
      q('#product-surface')?.removeAttribute('visible')
      void refresh()
    } finally {
      saving = false
    }
  }

  draw()
  return onLocaleChange(draw)
}
