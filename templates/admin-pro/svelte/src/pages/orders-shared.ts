// src/pages/orders-shared.ts —— 订单域页面（orders-table / orders-drawer / order-detail）共用的
// 纯函数助手与常量：状态→标签色映射、状态文案、金额/品名摘要格式化（自 react 版 orders-table.tsx
// 抽出，逻辑逐字对齐）
import type { OrderStatus } from '../data/orders'

export type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla STATUS_TAG：状态 → 标签色（shipping 用 purple 需走 color 通道） */
export const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

/** vanilla STATUS_TAG 读取：状态 → 标签色值（purple 需走 color 通道，见 setTagType） */
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

export function statusLabel(status: OrderStatus, t: TFunc): string {
  return t(`orders.status.${status}`)
}

/** vanilla formatMoney（列表页版本：千分位 + ¥ 前缀空格） */
export function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

/** vanilla itemSummary：≤2 项直接拼接，超出「前两项 等 N 项」 */
export function itemSummary(items: string[], t: TFunc): string {
  if (items.length <= 2) return items.join(t('orders.itemJoin'))
  return t('orders.itemSummary', {
    names: items.slice(0, 2).join(t('orders.itemJoin')),
    total: items.length,
  })
}
