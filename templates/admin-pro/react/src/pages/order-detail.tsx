// src/pages/order-detail.tsx —— 订单详情页（步骤条 + 描述列表 + 时间线 + 状态流转）
//    sessionStorage('order-detail-id') 后经 href="#/order-detail" 跳转（URL 不带 id 参数，
//    hidden+parent 路由仅用于面包屑）；本模版 orders-drawer 以同键同时机写入 + navigate
//    驱动全部动态区（标题/标签/步骤/描述/时间线/操作），flow 成功后 setOrder(updated) 即最新
// 3. 事件绑定：操作按钮位于 oas-card 内容区（非 drawer/modal panel），原生 click 用 React
//    双模式均正确，product-edit 同款）
//    重渲染，步骤/描述/时间线/操作随 locale 自动重算
//    load 语义一致）
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getOrder, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { statusLabel, tagTypeFor } from './orders-table'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla FLOW_STEPS / FLOW_TO：流转顺序与下一步映射 */
const FLOW_STEPS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done']

const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}

function flowFor(status: OrderStatus, t: TFunc): { label: string; to: OrderStatus } | undefined {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

/** vanilla formatMoney（详情页版本：两位小数、无空格——与列表页金额格式刻意不同，逐字对齐） */
function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** vanilla addDays：yyyy-MM-dd 加 n 天 */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

interface TimelineNode {
  time: string
  title: string
  color?: string
}

/** vanilla buildTimeline：创建 → 已按状态推进的各节点（取消态只有取消节点） */
function buildTimeline(order: OrderRow, t: TFunc): TimelineNode[] {
  const nodes: TimelineNode[] = [{ time: order.created, title: t('orderDetail.timeline.created') }]
  if (order.status === 'cancelled') {
    nodes.push({
      time: addDays(order.created, 1),
      title: statusLabel('cancelled', t),
      color: 'red',
    })
    return nodes
  }
  const idx = FLOW_STEPS.indexOf(order.status)
  if (idx >= 1) nodes.push({ time: addDays(order.created, 1), title: statusLabel('paid', t) })
  if (idx >= 2) nodes.push({ time: addDays(order.created, 2), title: statusLabel('shipping', t) })
  if (idx >= 3)
    nodes.push({ time: addDays(order.created, 3), title: statusLabel('done', t), color: 'green' })
  return nodes
}

export default function OrderDetailPage() {
  const { t } = useT()
  // vanilla：id 取自 sessionStorage（orders 页抽屉链接写入，键名逐字一致）
  const [id] = useState(() => sessionStorage.getItem('order-detail-id') ?? '')
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [missing, setMissing] = useState(false)

  // vanilla load()：取单失败显示空态 + 标题回落导航名；成功后 renderAll（此处声明式派生）
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const row = await getOrder(id)
      if (cancelled) return
      if (!row) setMissing(true)
      else setOrder(row)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // vanilla 操作按钮段：loading → 更新状态 → 提示 → 以返回行重渲
  const onAction = async (e: React.MouseEvent) => {
    if (!order) return
    const button = e.currentTarget as HTMLElement
    const target = button.dataset.target as OrderStatus | undefined
    if (!target) return
    button.setAttribute('loading', '')
    const updated = await updateOrderStatus(order.id, target)
    button.removeAttribute('loading')
    if (!updated) {
      appMessage.error(t('orders.notFound'))
      return
    }
    appMessage.success(t('orders.flowApplied', { action: button.textContent }))
    setOrder(updated)
  }

  const flow = order ? flowFor(order.status, t) : undefined
  const steps =
    order && order.status !== 'cancelled'
      ? FLOW_STEPS.map((s) => ({ title: statusLabel(s, t) }))
      : null
  const timeline = order ? buildTimeline(order, t) : []

  return (
    <div className="page order-detail-page">
      <oas-page-header
        data-testid="order-page-header"
        className="order-detail-ph"
        title={order ? order.id : t('nav.orderDetail')}
      >
        <div slot="extra" className="ph-extra">
          <Link className="link-btn" to="/orders" data-testid="order-back">
            {t('orderDetail.backList')}
          </Link>
          <oas-tag
            data-testid="order-status-tag"
            type={
              order
                ? tagTypeFor(order.status) === 'purple'
                  ? undefined
                  : tagTypeFor(order.status)
                : undefined
            }
            color={order && tagTypeFor(order.status) === 'purple' ? 'purple' : undefined}
          >
            {order ? statusLabel(order.status, t) : t('orderDetail.loading')}
          </oas-tag>
        </div>
      </oas-page-header>
      <div id="order-detail-card" hidden={missing || undefined}>
        <oas-card>
          <div id="order-detail-steps" hidden={!steps || undefined}>
            {steps && order && (
              <oas-steps
                className="order-steps"
                steps={JSON.stringify(steps)}
                current={FLOW_STEPS.indexOf(order.status)}
              />
            )}
          </div>
          <oas-descriptions data-testid="order-detail-basic" id="order-detail-basic" column="2">
            <oas-descriptions-item label={t('orders.th.customer')}>
              {order?.customer ?? ''}
            </oas-descriptions-item>
            <oas-descriptions-item label={t('orders.th.amount')}>
              <span className="mono">{order ? formatMoney(order.amount) : ''}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('form.label.phone')}>
              <span className="mono">{order?.phone ?? '-'}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('form.summary.urgent')}>
              {order
                ? order.urgent
                  ? t('form.label.urgent')
                  : t('form.summary.normalDelivery')
                : ''}
            </oas-descriptions-item>
            <oas-descriptions-item label={t('orders.th.created')}>
              <span className="mono">{order?.created ?? ''}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('orders.th.items')}>
              {order?.items.map((it, i) => (
                <oas-tag key={`${it}-${i}`}>{it}</oas-tag>
              ))}
            </oas-descriptions-item>
          </oas-descriptions>
          <div className="order-timeline-head">{t('orderDetail.timelineTitle')}</div>
          <div id="order-detail-timeline-wrap">
            <oas-timeline data-testid="order-detail-timeline">
              {timeline.map((n, i) => (
                <oas-timeline-item key={`${n.time}-${i}`} time={n.time} color={n.color}>
                  {n.title}
                </oas-timeline-item>
              ))}
            </oas-timeline>
          </div>
          <div className="order-detail-foot">
            <oas-button
              data-testid="order-detail-action"
              type="primary"
              hidden={!flow || undefined}
              data-target={flow?.to}
              onClick={(e) => void onAction(e)}
            >
              {flow?.label ?? ''}
            </oas-button>
            <div className="order-detail-note" id="order-detail-note" hidden={!!flow || undefined}>
              {order
                ? order.status === 'done'
                  ? t('orders.noteDone')
                  : t('orders.noteCancelled')
                : ''}
            </div>
          </div>
        </oas-card>
      </div>
      <div id="order-detail-missing" hidden={!missing || undefined}>
        {missing && <oas-empty description={t('orderDetail.missing')} />}
      </div>
    </div>
  )
}
