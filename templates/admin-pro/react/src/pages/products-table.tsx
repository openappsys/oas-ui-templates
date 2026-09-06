// src/pages/products-table.tsx —— 商品列表视图（oas-table + 空态 + 行内编辑 + 行事件委托）
// 行为事实来源：vanilla-html/src/pages/products.ts 的 TABLE_COLUMNS/cellXxx/renderTableBody 段。
// 偏差记录（因果链）：
// 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道：
//    React 19 对自定义元素上存在的 property 直接赋值（oas-table 的 columns/data setter
//    双通道均支持，见组件源码注释）；columns 用 useMemo 按 locale 重建（对齐 vanilla
//    refreshText 里 renderColumns 的时机），避免每次渲染重设 property 触发整表重绘
// 2. 行内编辑/勾选/开关：oas-edit/oas-check/oas-change 自定义事件全部 useOasEvent
//   （AGENTS.md 第 1 条）；编辑按钮的原生 click 是 composed 事件，能冒泡出 oas-table
//    shadow 到 React 根委托（oas-table 不在 drawer/modal 例外之列），故用容器 onClick +
//    composedPath 匹配 .product-edit（对齐 vanilla fromPath 的 matches 语义）
// 3. 空态：vanilla 手动切换 table-hidden 类与 empty 节点 hidden；本模版由 empty prop 派生
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

// 以下 cellXxx 逐函数对齐 vanilla（render 返回 Node 走富内容挂载通道）
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

  // 勾选 → 批量栏（vanilla oas-check 段）
  useOasEvent<{ keys: string[] }>(tableRef, 'oas-check', (detail) => {
    onCheck(detail.keys.map(Number).filter((n) => Number.isFinite(n)))
  })

  // 行内编辑持久化（vanilla oas-edit 段；仅 price/stock 两列）
  useOasEvent<{ key: string; column: string; value: unknown }>(tableRef, 'oas-edit', (detail) => {
    if (!canMutate) return
    const id = Number(detail.key)
    if (!Number.isFinite(id) || (detail.column !== 'price' && detail.column !== 'stock')) return
    onInlineEdit(id, detail.column, Number(detail.value))
  })

  // 状态开关（vanilla table oas-change 段：按 composedPath 源头识别 switch）
  useOasEvent(tableRef, 'oas-change', (_detail, ev) => {
    const sw = ev.composedPath()[0] as HTMLElement
    if (sw.getAttribute('data-testid') !== 'product-switch') return
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    onToggleStatus(id)
  })

  // 编辑按钮：composed click 冒泡出 shadow 后经 React 根委托到此（vanilla fromPath 等价）
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
