/**
 * 商品表格列定义与单元格构造（自 vanilla products.ts TABLE_COLUMNS / cell* 去 TS 移植）
 */
import { t } from './i18n.js'
import { stockLevel } from './data/products.js'

export function formatMoney(n) {
  return `¥ ${n.toLocaleString('en-US')}`
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
  span.textContent = t('products.stock', { n: stock })
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

/** 列定义随语言重建（含 price/stock 行内编辑校验与状态过滤项文案） */
export function tableColumns() {
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
