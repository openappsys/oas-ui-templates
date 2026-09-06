// src/pages/orders-table.tsx —— 订单列表（oas-table + 空态覆盖层 + 行事件）
// itemSummary/renderTable/setEmpty 段。
// 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道
//   （oas-table 的 columns setter 双通道均支持，AGENTS.md 第 3 条例外）；columns 用 useMemo
//    empty prop 派生（is-empty/hidden 两处同一事实来源，data 由父组件传入的 dataJson 表达）
// 3. 行事件：oas-row-click 自定义事件走 useOasEvent（AGENTS.md 第 1 条），detail.row 即
// 4. 清筛选按钮为 light DOM 原生 click，直绑 onClick
import { useMemo } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import type { OrderRow, OrderStatus } from '../data/orders'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

export interface OrdersTableProps {
  /** 父组件持有 ref：搜索/切 tab 时 setAttribute('current','1')、refresh 时切 loading（vanilla 同款） */
  tableRef: React.RefObject<HTMLElement | null>
  /** 过滤后的行 JSON（vanilla setAttribute('data', JSON) 同通道，空数组即 '[]'） */
  dataJson: string
  /** 关键字/状态过滤结果为空：空态覆盖层显示 */
  empty: boolean
  pageSize: number
  onRowOpen: (row: OrderRow) => void
  onClearFilter: () => void
}

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla STATUS_TAG：状态 → 标签色（shipping 用 purple 需走 color 通道） */
const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

export function statusLabel(status: OrderStatus, t: TFunc): string {
  return t(`orders.status.${status}`)
}

/** vanilla STATUS_TAG 读取：状态 → 标签色值（purple 需走 color 通道，见 tagAttrs） */
export function tagTypeFor(status: OrderStatus): string {
  return STATUS_TAG[status]
}

/** vanilla setTagType：purple 走 color 属性，其余走 type 属性（互斥） */
export function setTagType(tag: HTMLElement, status: OrderStatus): void {
  const type = STATUS_TAG[status]
  if (type === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', type)
    tag.removeAttribute('color')
  }
}

/** vanilla formatMoney：千分位 + ¥ 前缀 */
export function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

/** vanilla itemSummary：≤2 项直接拼接，超出「前两项 等 N 项」 */
function itemSummary(items: string[], t: TFunc): string {
  if (items.length <= 2) return items.join(t('orders.itemJoin'))
  return t('orders.itemSummary', {
    names: items.slice(0, 2).join(t('orders.itemJoin')),
    total: items.length,
  })
}

/** vanilla statusCell：行内状态标签节点 */
function statusCell(row: OrderRow, t: TFunc): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.textContent = statusLabel(row.status, t)
  setTagType(tag, row.status)
  return tag
}

/** vanilla moneyCell：右对齐金额（mono 类） */
function moneyCell(row: OrderRow): HTMLElement {
  const span = document.createElement('span')
  span.className = 'mono'
  span.textContent = formatMoney(row.amount)
  return span
}

/** vanilla TABLE_COLUMNS：序号/金额汇总/富内容列逐字对齐 */
function buildColumns(t: TFunc): TableColumn[] {
  return [
    { key: 'no', title: '#', serialNumber: true, width: '48px' },
    { key: 'id', title: t('orders.th.no') },
    { key: 'customer', title: t('orders.th.customer') },
    {
      key: 'items',
      title: t('orders.th.items'),
      ellipsis: true,
      render: (r) => itemSummary((r as unknown as OrderRow).items, t),
    },
    {
      key: 'amount',
      title: t('orders.th.amount'),
      align: 'right',
      summary: 'sum',
      render: (r) => moneyCell(r as unknown as OrderRow),
    },
    {
      key: 'status',
      title: t('orders.th.status'),
      render: (r) => statusCell(r as unknown as OrderRow, t),
    },
    { key: 'created', title: t('orders.th.created') },
  ]
}

export function OrdersTable({
  tableRef,
  dataJson,
  empty,
  pageSize,
  onRowOpen,
  onClearFilter,
}: OrdersTableProps) {
  const { t, locale } = useT()

  // 列定义按 locale 重建（vanilla renderTable 里重设 columns 同款时机）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  // 行点击 → 快捷详情抽屉（vanilla oas-row-click 段）
  useOasEvent<{ row: OrderRow }>(tableRef, 'oas-row-click', (detail) => {
    if (detail.row?.id) onRowOpen(detail.row)
  })

  return (
    <div className={`table-wrap${empty ? ' is-empty' : ''}`} id="orders-table-wrap">
      <oas-table
        ref={tableRef}
        data-testid="orders-list"
        row-key="id"
        empty-text={t('orders.empty')}
        columns={columns}
        data={dataJson}
        pagination
        page-size={pageSize}
      />
      <div className="empty-overlay" id="orders-empty" hidden={!empty}>
        <oas-empty description={t('orders.empty')} />
        <oas-button id="orders-clear" type="primary" onClick={onClearFilter}>
          {t('common.clearFilter')}
        </oas-button>
      </div>
    </div>
  )
}
