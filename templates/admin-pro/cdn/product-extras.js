/**
 * 商品页批量栏 / 列设置弹窗 / 行内编辑（自 vanilla products.ts 对应段落去 TS 移植）
 * 以 (el, state, hooks) 上下文函数形态与页面解耦，便于单文件行数纪律
 */
import { t } from './i18n.js'
import { removeProduct, toggleProductStatus, updateProduct } from './data/products.js'
import { PRODUCT_COLUMN_KEYS, PRODUCT_COLUMN_MANDATORY, writeProductColumns } from './product-columns.js'
import { tableColumns } from './product-table.js'

/** 列定义 + 可见列（column-keys）一次性写入表格 */
export function renderColumns(table, columnKeys) {
  table.columns = tableColumns()
  table.setAttribute('column-keys', JSON.stringify(columnKeys))
}

/** 批量栏文案 / 显隐 / 按钮可用态 */
export function updateBatchBar(el, state) {
  const n = state.selected.length
  el.querySelector('[data-testid="product-batch-count"]').textContent = n > 0 ? t('products.batch.selected', { count: n }) : ''
  el.querySelector('[data-testid="product-batch-del-pop"]').setAttribute('title', t('products.batch.confirmDelete', { count: n }))
  el.querySelector('[data-testid="product-batch-bar"]').hidden = state.view !== 'table' || n === 0
  for (const key of ['product-batch-list', 'product-batch-unlist', 'product-batch-delete']) {
    const btn = el.querySelector(`[data-testid="${key}"]`)
    if (n > 0) btn.removeAttribute('disabled')
    else btn.setAttribute('disabled', '')
  }
}

export function clearSelection(el, state) {
  state.selected = []
  el.querySelector('[data-testid="product-table"]').removeAttribute('selected')
  updateBatchBar(el, state)
}

/** 列设置弹窗内复选列表（必选列禁用勾选） */
export function renderColumnList(el, columnKeys) {
  const list = el.querySelector('[data-testid="product-columns-list"]')
  list.innerHTML = PRODUCT_COLUMN_KEYS.map((key) => {
    const title = key === 'category' ? t('products.category') : t(`products.th.${key}`)
    const mandatory = PRODUCT_COLUMN_MANDATORY.includes(key)
    const checked = mandatory || columnKeys.includes(key)
    return `<label class="product-column-check">
        <oas-checkbox data-testid="product-columns-${key}" value="${key}"${checked ? ' checked' : ''}${mandatory ? ' disabled' : ''}>${title}</oas-checkbox>
      </label>`
  }).join('')
}

/** 行内编辑（v2.2.7+）：双击 price/stock 单元格编辑，validate 校验，oas-edit 持久化 */
export function bindInlineEdit(table, { refresh }) {
  table.setAttribute('editable', '')
  table.addEventListener('oas-edit', (e) => {
    const { key, column, value } = e.detail
    const id = Number(key)
    if (!Number.isFinite(id) || (column !== 'price' && column !== 'stock')) return
    const updated = () => updateProduct(id, { [column]: Number(value) })
    void updated().then((row) => {
      if (!row) OASUI.message.error(t('products.notFound'))
      else OASUI.message.success(t('common.saved'))
      void refresh()
    })
  })
}

/** 批量上架 / 下架 / 删除（popconfirm ok 自驱动） */
export function bindBatchBar(el, state, { refresh, clear }) {
  async function batchStatus(target) {
    let changed = 0
    for (const id of state.selected) {
      const row = state.rows.find((r) => r.id === id)
      if (!row || row.status === target) continue
      if (await toggleProductStatus(id)) changed++
    }
    // stale 守卫：批量循环逐条 await，期间导航离开后 clear() 的新查询会在脱离文档的 el 上抛 TypeError
    if (!el.isConnected) return
    clear()
    OASUI.message.success(t('products.batch.statusDone', { count: changed }))
    void refresh()
  }

  async function batchDelete() {
    let removed = 0
    for (const id of state.selected) {
      if (await removeProduct(id)) removed++
    }
    // stale 守卫：同 batchStatus，导航离开后不再操作脱离文档的 DOM
    if (!el.isConnected) return
    clear()
    OASUI.message.success(t('products.batch.deleted', { count: removed }))
    void refresh()
  }

  el.querySelector('[data-testid="product-batch-list"]').addEventListener('click', () => void batchStatus('on'))
  el.querySelector('[data-testid="product-batch-unlist"]').addEventListener('click', () => void batchStatus('off'))
  el.querySelector('[data-testid="product-batch-del-pop"]').addEventListener('oas-ok', () => void batchDelete())
}

/** 列设置弹窗：打开 / 关闭 / 恢复默认 / 勾选变更即时持久化 */
export function bindColumnsModal(el, state, { renderTableColumns }) {
  el.querySelector('[data-testid="product-columns"]').addEventListener('click', () => {
    renderColumnList(el, state.columnKeys)
    el.querySelector('[data-testid="product-columns-modal"]').setAttribute('visible', '')
  })
  el.querySelector('[data-testid="product-columns-close"]').addEventListener('click', () => {
    el.querySelector('[data-testid="product-columns-modal"]').removeAttribute('visible')
  })
  el.querySelector('[data-testid="product-columns-reset"]').addEventListener('click', () => {
    state.columnKeys = [...PRODUCT_COLUMN_KEYS]
    writeProductColumns(state.columnKeys)
    renderColumnList(el, state.columnKeys)
    renderTableColumns()
  })
  el.querySelector('[data-testid="product-columns-modal"]').addEventListener('oas-change', (e) => {
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
    renderTableColumns()
  })
}
