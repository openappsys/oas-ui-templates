import { guard, readSession } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { listCategories } from './data/categories.js'
import {
  createProduct,
  listProducts,
  removeProduct,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from './data/products.js'
import {
  PRODUCT_COLUMN_KEYS,
  PRODUCT_COLUMN_MANDATORY,
  readProductColumns,
  writeProductColumns,
} from './product-columns.js'

// 表单呈现方式跟随设置中心；未设置时与 vanilla 默认一致（drawer）
function readFormMode() {
  const v = localStorage.getItem('oas-admin-cdn-mpa.form-mode')
  return v === 'dialog' || v === 'page' ? v : 'drawer'
}

function readView() {
  return localStorage.getItem('oas-admin-cdn-mpa.products-view') === 'table' ? 'table' : 'cards'
}

function readPageSize() {
  const n = Number(localStorage.getItem('oas-admin-cdn-mpa.settings.page-size'))
  return Number.isFinite(n) && n > 0 ? n : 5
}

function formatMoney(n) {
  return `¥ ${n.toLocaleString('en-US')}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fromPath(path, selector) {
  for (const item of path) {
    if (item instanceof HTMLElement && item.matches(selector)) return item
  }
  return null
}

function viewOptions() {
  return [
    { label: t('products.viewCards'), value: 'cards' },
    { label: t('products.viewTable'), value: 'table' },
  ]
}

function filterOptions(categories) {
  return [{ label: t('products.allCategories'), value: '' }, ...categories]
}

function canMutate() {
  return readSession()?.role !== 'viewer'
}

function cellTag(category) {
  const tag = document.createElement('oas-tag')
  tag.className = 'cat-tag'
  tag.textContent = category
  return tag
}

function cellPrice(price) {
  const span = document.createElement('span')
  span.className = 'mono'
  span.textContent = formatMoney(price)
  return span
}

function cellStock(stock) {
  const span = document.createElement('span')
  span.className = `product-stock is-${stockLevel(stock)}`
  span.textContent = tf('products.stock', { n: stock })
  return span
}

function cellStatus(row) {
  const sw = document.createElement('oas-switch')
  sw.setAttribute('data-testid', 'product-switch')
  sw.setAttribute('data-id', String(row.id))
  if (row.status === 'on') sw.setAttribute('checked', '')
  return sw
}

function cellAction(row) {
  const btn = document.createElement('oas-button')
  btn.className = 'product-edit'
  btn.setAttribute('data-testid', 'product-edit')
  btn.setAttribute('data-id', String(row.id))
  btn.setAttribute('size', 'small')
  btn.setAttribute('icon', 'edit')
  btn.setAttribute('aria-label', t('common.edit'))
  return btn
}

function tableColumns() {
  return [
    { key: 'name', title: t('products.th.name') },
    { key: 'category', title: t('products.category'), render: (r) => cellTag(String(r.category)) },
    {
      key: 'price',
      title: t('products.th.price'),
      align: 'right',
      editable: true,
      validate: (value) => {
        const n = Number(value)
        if (!Number.isFinite(n) || n <= 0) return t('products.inlineEdit.priceInvalid')
      },
      render: (r) => cellPrice(Number(r.price)),
    },
    {
      key: 'stock',
      title: t('products.th.stock'),
      editable: true,
      validate: (value) => {
        const n = Number(value)
        if (!Number.isInteger(n) || n < 0) return t('products.inlineEdit.stockInvalid')
      },
      render: (r) => cellStock(Number(r.stock)),
    },
    {
      key: 'status',
      title: t('products.th.status'),
      filterable: true,
      filters: [
        { label: t('products.status.on'), value: 'on' },
        { label: t('products.status.off'), value: 'off' },
      ],
      render: (r) => cellStatus(r),
    },
    { key: 'action', title: t('products.th.action'), render: (r) => cellAction(r) },
  ]
}

// 表单主体（dialog/drawer 共用）；label/占位随 locale 灌入（MPA 切语言 = reload，无需订阅更新）
function formBody() {
  return `
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
}

if (guard()) {
  document.title = `${t('nav.products')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './products.html' })
  renderProducts()
}

function renderProducts() {
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

  const grid = document.querySelector('[data-testid="product-grid"]')
  const search = document.querySelector('[data-testid="product-search"]')
  const category = document.querySelector('[data-testid="product-category"]')
  const viewSeg = document.querySelector('[data-testid="product-view"]')
  const tableWrap = document.querySelector('.products-table-wrap')
  const table = document.querySelector('[data-testid="product-table"]')
  const pager = document.querySelector('[data-testid="product-pager"]')
  const empty = document.querySelector('[data-testid="product-empty"]')
  const createBtn = document.querySelector('[data-testid="product-create"]')
  const batchBar = document.querySelector('[data-testid="product-batch-bar"]')
  const batchCount = document.querySelector('[data-testid="product-batch-count"]')
  const batchDelPop = document.querySelector('[data-testid="product-batch-del-pop"]')
  const columnsBtn = document.querySelector('[data-testid="product-columns"]')
  const columnsModal = document.querySelector('[data-testid="product-columns-modal"]')
  const pageEl = document.querySelector('.products-page')

  // 表单容器：dialog → oas-modal / drawer → oas-drawer / page → 跳 product-edit.html
  let surface = null
  if (state.formMode === 'dialog') {
    pageEl.insertAdjacentHTML(
      'beforeend',
      `<oas-modal data-testid="product-dialog" id="product-surface" no-footer><div style="padding: var(--oas-space-4); min-width: 0"><h2 id="form-title" style="margin:0 0 var(--oas-space-3); font-size:16px">${t('products.newProduct')}</h2>${formBody()}</div></oas-modal>`,
    )
  } else if (state.formMode === 'drawer') {
    pageEl.insertAdjacentHTML(
      'beforeend',
      `<oas-drawer data-testid="product-drawer" id="product-surface" title="${t('products.newProduct')}" placement="right" size="medium" no-footer>${formBody()}</oas-drawer>`,
    )
  }
  surface = document.querySelector('#product-surface')
  const form = document.querySelector('#product-form')
  const datePicker = document.querySelector('[data-testid="pf-date"]')
  const upload = document.querySelector('[data-testid="pf-cover"]')

  function renderColumns() {
    table.columns = tableColumns()
    table.setAttribute('column-keys', JSON.stringify(state.columnKeys))
  }

  function updateBatchBar() {
    const n = state.selected.length
    batchCount.textContent = n > 0 ? tf('products.batch.selected', { count: n }) : ''
    batchDelPop.setAttribute('title', tf('products.batch.confirmDelete', { count: n }))
    batchBar.hidden = state.view !== 'table' || n === 0
    const enabled = canMutate() && n > 0
    for (const key of ['product-batch-list', 'product-batch-unlist', 'product-batch-delete']) {
      const btn = document.querySelector(`[data-testid="${key}"]`)
      if (enabled) btn.removeAttribute('disabled')
      else btn.setAttribute('disabled', '')
    }
  }

  function clearSelection() {
    state.selected = []
    table.removeAttribute('selected')
    updateBatchBar()
  }

  function renderColumnList() {
    const list = document.querySelector('[data-testid="product-columns-list"]')
    list.innerHTML = PRODUCT_COLUMN_KEYS.map((key) => {
      const title = key === 'category' ? t('products.category') : t(`products.th.${key}`)
      const mandatory = PRODUCT_COLUMN_MANDATORY.includes(key)
      const checked = mandatory || state.columnKeys.includes(key)
      return `<label class="product-column-check">
        <oas-checkbox data-testid="product-columns-${key}" value="${key}"${checked ? ' checked' : ''}${mandatory ? ' disabled' : ''}>${title}</oas-checkbox>
      </label>`
    }).join('')
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
            <span class="product-stock is-${stockLevel(r.stock)}">${tf('products.stock', { n: r.stock })}</span>
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
    const list = filtered()
    if (list.length === 0) {
      table.setAttribute('data', '[]')
      table.classList.add('table-hidden')
      pager.setAttribute('total', '0')
      pager.setAttribute('current', '1')
      // oas-pagination update() 会自摘 hidden，属性更新后命令式补写
      pager.setAttribute('hidden', '')
      empty.hidden = false
      return
    }
    // 手动分页模式（演示）：宿主 slice + 外部 oas-pagination；orders 用表格内置 pagination
    const maxPage = Math.max(1, Math.ceil(list.length / state.pageSize))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
    table.setAttribute('data', JSON.stringify(slice))
    table.classList.remove('table-hidden')
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
    pager.setAttribute('page-size', String(state.pageSize))
    pager.removeAttribute('hidden')
    empty.hidden = true
  }

  function renderList() {
    if (state.view === 'cards') {
      renderCards()
    } else {
      renderTableBody()
    }
  }

  function applyView() {
    grid.hidden = state.view !== 'cards'
    tableWrap.hidden = state.view !== 'table'
    // hidden 属性切换同样会被 pagination 内部 update 干扰，统一命令式补写
    if (state.view !== 'table') pager.setAttribute('hidden', '')
    updateBatchBar()
    renderList()
  }

  function resolveCategory(value) {
    if (value && state.categories.some((c) => c.value === value)) return value
    return state.categories[0]?.value ?? ''
  }

  function applyCategoryOptions() {
    category.setAttribute('options', JSON.stringify(filterOptions(state.categories)))
    const formCat = document.querySelector('[data-testid="pf-category"]')
    if (formCat) formCat.setAttribute('options', JSON.stringify(state.categories))
    if (state.category && !state.categories.some((c) => c.value === state.category)) {
      state.category = ''
      category.setAttribute('value', '')
    }
  }

  function fillForm(row) {
    document.querySelector('[data-testid="pf-name"]').setAttribute('value', row?.name ?? '')
    document
      .querySelector('[data-testid="pf-category"]')
      .setAttribute('value', resolveCategory(row?.category))
    document
      .querySelector('[data-testid="pf-price"]')
      .setAttribute('value', row ? String(row.price) : '')
    document
      .querySelector('[data-testid="pf-stock"]')
      .setAttribute('value', row ? String(row.stock) : '')
    if (datePicker) datePicker.setAttribute('value', row?.created ?? today())
    if (upload) upload.files = []
    const title = row ? tf('products.editItem', { id: row.id }) : t('products.newProduct')
    const titleEl = document.querySelector('#form-title')
    if (titleEl) titleEl.textContent = title
    else if (surface) surface.setAttribute('title', title)
  }

  function openForm(row) {
    if (state.formMode === 'page') {
      // 新页面模式：sessionStorage 传 id（product-edit.html 读取）
      if (row) sessionStorage.setItem('product-edit-id', String(row.id))
      else sessionStorage.removeItem('product-edit-id')
      location.href = './product-edit.html'
      return
    }
    state.editingId = row?.id ?? null
    fillForm(row)
    surface?.setAttribute('visible', '')
  }

  async function refresh() {
    const [rows, cats] = await Promise.all([listProducts(), listCategories()])
    state.rows = rows
    state.categories = cats.map((c) => ({ label: c.name, value: c.name }))
    applyCategoryOptions()
    renderList()
  }

  createBtn.addEventListener('click', () => openForm(null))

  // 行内编辑演示（v2.2.7+）：双击 price/stock 单元格进入编辑，validate 校验，oas-edit 持久化
  if (canMutate()) {
    table.setAttribute('editable', '')
    table.addEventListener('oas-edit', (e) => {
      const { key, column, value } = e.detail
      const id = Number(key)
      if (!Number.isFinite(id) || (column !== 'price' && column !== 'stock')) return
      void updateProduct(id, { [column]: Number(value) }).then((updated) => {
        if (!updated) OASUI.message.error(t('products.notFound'))
        else OASUI.message.success(t('common.saved'))
        void refresh()
      })
    })
  }

  table.addEventListener('oas-check', (e) => {
    const keys = e.detail.keys
    state.selected = keys.map(Number).filter((n) => Number.isFinite(n))
    updateBatchBar()
  })

  async function batchStatus(target) {
    if (!canMutate()) {
      OASUI.message.error(t('common.noPerm'))
      return
    }
    let changed = 0
    for (const id of state.selected) {
      const row = state.rows.find((r) => r.id === id)
      if (!row || row.status === target) continue
      if (await toggleProductStatus(id)) changed++
    }
    clearSelection()
    OASUI.message.success(tf('products.batch.statusDone', { count: changed }))
    void refresh()
  }

  document
    .querySelector('[data-testid="product-batch-list"]')
    .addEventListener('click', () => void batchStatus('on'))
  document
    .querySelector('[data-testid="product-batch-unlist"]')
    .addEventListener('click', () => void batchStatus('off'))
  batchDelPop.addEventListener('oas-ok', async () => {
    if (!canMutate()) {
      OASUI.message.error(t('common.noPerm'))
      return
    }
    let removed = 0
    for (const id of state.selected) {
      if (await removeProduct(id)) removed++
    }
    clearSelection()
    OASUI.message.success(tf('products.batch.deleted', { count: removed }))
    void refresh()
  })

  columnsBtn.addEventListener('click', () => {
    renderColumnList()
    columnsModal.setAttribute('visible', '')
  })
  document
    .querySelector('[data-testid="product-columns-close"]')
    .addEventListener('click', () => columnsModal.removeAttribute('visible'))
  document.querySelector('[data-testid="product-columns-reset"]').addEventListener('click', () => {
    state.columnKeys = [...PRODUCT_COLUMN_KEYS]
    writeProductColumns(state.columnKeys)
    renderColumnList()
    renderColumns()
  })
  columnsModal.addEventListener('oas-change', (e) => {
    const detail = e.detail
    if (!detail) return
    const key = detail.value
    if (!PRODUCT_COLUMN_KEYS.includes(key) || PRODUCT_COLUMN_MANDATORY.includes(key)) return
    if (detail.checked) {
      if (!state.columnKeys.includes(key)) state.columnKeys.push(key)
    } else {
      state.columnKeys = state.columnKeys.filter((k) => k !== key)
    }
    writeProductColumns(state.columnKeys)
    renderColumns()
  })

  viewSeg.addEventListener('oas-change', (e) => {
    const v = e.detail.value
    if (v === state.view) return
    state.view = v
    state.page = 1
    localStorage.setItem('oas-admin-cdn-mpa.products-view', v)
    applyView()
  })

  grid.addEventListener('oas-change', async (e) => {
    const sw = e.composedPath()[0]
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    const updated = await toggleProductStatus(id)
    if (!updated) {
      OASUI.message.error(t('products.notFound'))
      return
    }
    OASUI.message.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
    void refresh()
  })

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-testid="product-edit"]')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = state.rows.find((r) => r.id === id)
    if (row) openForm(row)
  })

  table.addEventListener('oas-change', async (e) => {
    const sw = e.composedPath()[0]
    if (sw.getAttribute?.('data-testid') !== 'product-switch') return
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    const updated = await toggleProductStatus(id)
    if (!updated) {
      OASUI.message.error(t('products.notFound'))
      return
    }
    OASUI.message.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
    void refresh()
  })

  table.addEventListener('click', (e) => {
    const btn = fromPath(e.composedPath(), '.product-edit')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = state.rows.find((r) => r.id === id)
    if (row) openForm(row)
  })

  document.querySelector('[data-testid="pf-cancel"]')?.addEventListener('click', () => {
    surface?.removeAttribute('visible')
  })

  document.querySelector('[data-testid="pf-save"]')?.addEventListener('click', () => {
    form?.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  form?.addEventListener('oas-submit', async (e) => {
    if (saving) return
    const values = e.detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      OASUI.message.error(t('products.priceError'))
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
        OASUI.message.success(t('common.created'))
      } else {
        await updateProduct(state.editingId, payload)
        OASUI.message.success(t('common.saved'))
      }
      surface?.removeAttribute('visible')
      void refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = e.detail.value ?? ''
    state.page = 1
    renderList()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    state.page = 1
    renderList()
  })

  category.addEventListener('oas-change', (e) => {
    state.category = e.detail.value ?? ''
    state.page = 1
    renderList()
  })

  pager.addEventListener('oas-change', (e) => {
    state.page = Number(e.detail.page ?? 1)
    renderList()
  })

  // 初始：视图切换件 options + 当前视图渲染
  viewSeg.setAttribute('options', JSON.stringify(viewOptions()))
  viewSeg.setAttribute('value', state.view)
  renderColumns()
  renderColumnList()
  applyView()
  void refresh()
}
