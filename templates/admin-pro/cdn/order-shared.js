/**
 * 订单页共享工具（自 vanilla orders.ts / order-detail.ts 顶部常量与纯函数去 TS 移植，逻辑逐字保留）
 */
import { t } from './i18n.js'

/** @typedef {'pending' | 'paid' | 'shipping' | 'done' | 'cancelled'} OrderStatus */

/** 状态 → 标签色（shipping 用 purple 需走 color 通道） */
export const STATUS_TAG = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

/** 详情页步骤条节点顺序 */
export const FLOW_STEPS = ['pending', 'paid', 'shipping', 'done']

/** 流转动作：当前状态 → 下一状态 */
export const FLOW_TO = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}

/** @param {OrderStatus} status */
export function statusLabel(status) {
  return t(`orders.status.${status}`)
}

/**
 * @param {OrderStatus} status
 * @returns {{ label: string, to: OrderStatus } | undefined}
 */
export function flowFor(status) {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

/** 列表金额：¥ + 千分位 */
export function formatMoney(n) {
  return `¥ ${n.toLocaleString('en-US')}`
}

/** 详情金额：¥ + 千分位 + 两位小数（vanilla order-detail 同款） */
export function formatMoneyPrecise(n) {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** @param {string} dateStr @param {number} n */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

/**
 * purple 走 color 属性、其余走 type 属性（互斥；vanilla setTagType 同款）
 * @param {HTMLElement} tag
 * @param {OrderStatus} status
 */
export function setTagType(tag, status) {
  const type = STATUS_TAG[status]
  if (type === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', type)
    tag.removeAttribute('color')
  }
}

/**
 * 详情时间线节点（vanilla buildTimeline 逐字移植）
 * @param {import('./data/orders.js').OrderRow} order
 */
export function buildTimeline(order) {
  const nodes = [{ time: order.created, title: t('orderDetail.timeline.created') }]
  if (order.status === 'cancelled') {
    nodes.push({ time: addDays(order.created, 1), title: statusLabel('cancelled'), color: 'red' })
    return nodes
  }
  const idx = FLOW_STEPS.indexOf(order.status)
  if (idx >= 1) nodes.push({ time: addDays(order.created, 1), title: statusLabel('paid') })
  if (idx >= 2) nodes.push({ time: addDays(order.created, 2), title: statusLabel('shipping') })
  if (idx >= 3)
    nodes.push({ time: addDays(order.created, 3), title: statusLabel('done'), color: 'green' })
  return nodes
}
