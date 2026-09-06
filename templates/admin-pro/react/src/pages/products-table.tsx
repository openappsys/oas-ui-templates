// src/pages/products-table.tsx —— 商品列表视图（oas-table + 空态 + 行内编辑 + 行事件委托）
// 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道：
//    React 19 对自定义元素上存在的 property 直接赋值（oas-table 的 columns/data setter
//    refreshText 里 renderColumns 的时机），避免每次渲染重设 property 触发整表重绘
// 2. 行内编辑/勾选/开关：oas-edit/oas-check/oas-change 自定义事件全部 useOasEvent
//   编辑按钮的原生 click 是 composed 事件，能冒泡出 oas-table
//    shadow 到 React 根委托（oas-table 不在 drawer/modal 例外之列），故用容器 onClick +
import { useMemo } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import { stockLevel } from '../data/products'
import type { ProductRow } from '../data/products'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import type { ProductColumnKey } from './product-columns'

export interface ProductsTableProps {
  /** 父组件持有 ref：清空勾选时需 removeAttribute('selected')（vanilla clearSelection 同款） */
  tableRef: React.RefObject<HTMLElement | null>
  /** 当前页切片（父组件手动分页，对齐 vanilla renderTableBody 的 slice） */
  rows: ProductRow[]
  columnKeys: ProductColumnKey[]
  canMutate: boolean
  /** 筛选结果为空：表格隐藏 + 空态显示 */
  empty: boolean
  /** 卡片视图时整个表格容器隐藏 */
  hidden: boolean
  onToggleStatus: (id: number) => void
  onEditRow: (id: number) => void
  onCheck: (keys: number[]) => void
  onInlineEdit: (id: number, column: 'price' | 'stock', value: number) => void
}

type TFunc = (key: string, params?: Record<string, string | number>) => string

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
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

function cellStock(stock: number, t: TFunc): HTMLElement {
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

function cellAction(row: ProductRow, t: TFunc): HTMLElement {
  const btn = document.createElement('oas-button')
  btn.className = 'product-edit'
  btn.setAttribute('data-testid', 'product-edit')
  btn.setAttribute('data-id', String(row.id))
  btn.setAttribute('size', 'small')
  btn.setAttribute('icon', 'edit')
  btn.setAttribute('aria-label', t('common.edit'))
  return btn
}

/** vanilla TABLE_COLUMNS：price/stock 行内可编辑（列级 editable + validate），status 可过滤 */
function buildColumns(t: TFunc): TableColumn[] {
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
      render: (r) => cellStock(Number(r.stock), t),
    },
    {
      key: 'status',
      title: t('products.th.status'),
      filterable: true,
      filters: [
        { label: t('products.status.on'), value: 'on' },
        { label: t('products.status.off'), value: 'off' },
      ],
      render: (r) => cellStatus(r as unknown as ProductRow),
    },
    {
      key: 'action',
      title: t('products.th.action'),
      render: (r) => cellAction(r as unknown as ProductRow, t),
    },
  ]
}

export function ProductsTable({
  tableRef,
  rows,
  columnKeys,
  canMutate,
  empty,
  hidden,
  onToggleStatus,
  onEditRow,
  onCheck,
  onInlineEdit,
}: ProductsTableProps) {
  const { t, locale } = useT()

  // 列定义按 locale 重建（t 内部读当前 locale，闭包随 locale 变化才需重算）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  useOasEvent<{ keys: string[] }>(tableRef, 'oas-check', (detail) => {
    onCheck(detail.keys.map(Number).filter((n) => Number.isFinite(n)))
  })

  useOasEvent<{ key: string; column: string; value: unknown }>(tableRef, 'oas-edit', (detail) => {
    if (!canMutate) return
    const id = Number(detail.key)
    if (!Number.isFinite(id) || (detail.column !== 'price' && detail.column !== 'stock')) return
    onInlineEdit(id, detail.column, Number(detail.value))
  })

  useOasEvent(tableRef, 'oas-change', (_detail, ev) => {
    const sw = ev.composedPath()[0] as HTMLElement
    if (sw.getAttribute('data-testid') !== 'product-switch') return
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    onToggleStatus(id)
  })

  const onWrapClick = (e: React.MouseEvent) => {
    const btn = e.nativeEvent
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('.product-edit'))
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    if (id) onEditRow(id)
  }

  return (
    <div className="table-wrap products-table-wrap" hidden={hidden} onClick={onWrapClick}>
      <oas-table
        ref={tableRef}
        data-testid="product-table"
        row-key="id"
        checkable
        stripe
        editable={canMutate || undefined}
        className={empty ? 'table-hidden' : undefined}
        columns={columns}
        data={rows as unknown as object[]}
        column-keys={JSON.stringify(columnKeys)}
      />
      <div className="product-list-empty" data-testid="product-empty" hidden={!empty}>
        <oas-empty description={t('products.empty')} />
      </div>
    </div>
  )
}
