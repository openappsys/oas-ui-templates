// src/pages/orders-drawer.tsx —— 订单快捷详情抽屉（orders 页行点击弹出）
// openDrawer/order-detail-link/order-detail-action 段。
//    「flow 后 refresh 再回填 tag/action」的可观察结果）
// 2. 面板内原生 click 例外直绑：「查看完整详情」链接与流程按钮位于
//    oas-drawer panel 内，panel 对原生事件 stopPropagation，React 根委托收不到，故与
//    'order-detail-id'；本模版路由支持 hash/history 双模式，改 preventDefault + react-router
//    navigate('/order-detail')，sessionStorage 键名与写入时机逐字一致
//    state 单一持有，监听 oas-close 回写 state（product-form 同款）
//    :host([hidden]) 生效，可观察结果一致）
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { OrderRow, OrderStatus } from '../data/orders'
import { updateOrderStatus } from '../data/orders'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { formatMoney, statusLabel, tagTypeFor } from './orders-table'

/** vanilla FLOW_TO + flowFor：状态流转（pending→paid→shipping→done） */
const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}

function flowFor(
  status: OrderStatus,
  t: (key: string) => string,
): { label: string; to: OrderStatus } | undefined {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

export interface OrdersDrawerProps {
  open: boolean
  /** 当前选中订单（state.selectedId 同语义；列表刷新后由父组件给出最新行，可能为 null） */
  row: OrderRow | null
  onClose: () => void
  /** 流程按钮：父组件执行 updateOrderStatus + 提示 + refresh（vanilla 同款编排） */
  onApplyFlow: (id: string, target: OrderStatus) => Promise<void>
}

export function OrdersDrawer({ open, row, onClose, onApplyFlow }: OrdersDrawerProps) {
  const { t } = useT()
  const navigate = useNavigate()
  const drawerRef = useRef<HTMLElement | null>(null)
  const actionRef = useRef<HTMLElement | null>(null)
  const linkRef = useRef<HTMLAnchorElement | null>(null)

  // 回调最新化：面板内原生监听只在挂载时绑一次（product-form 同款）
  const rowRef = useRef(row)
  rowRef.current = row
  const onApplyFlowRef = useRef(onApplyFlow)
  onApplyFlowRef.current = onApplyFlow
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const link = linkRef.current
    const action = actionRef.current
    const onLinkClick = (e: Event) => {
      const current = rowRef.current
      if (current?.id) sessionStorage.setItem('order-detail-id', current.id)
      e.preventDefault()
      navigate('/order-detail')
    }
    const onActionClick = async (e: Event) => {
      const current = rowRef.current
      const button = e.currentTarget as HTMLElement
      const target = button.dataset.target as OrderStatus | undefined
      if (!target || !current) return
      button.setAttribute('loading', '')
      await onApplyFlowRef.current(current.id, target)
      button.removeAttribute('loading')
    }
    link?.addEventListener('click', onLinkClick)
    action?.addEventListener('click', onActionClick)
    return () => {
      link?.removeEventListener('click', onLinkClick)
      action?.removeEventListener('click', onActionClick)
    }
  }, [navigate])

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(drawerRef, 'oas-close', () => {
    onCloseRef.current()
  })

  const flow = row ? flowFor(row.status, t) : undefined

  return (
    <oas-drawer
      ref={drawerRef}
      data-testid="order-drawer"
      title={t('orders.detailTitle')}
      placement="right"
      size="medium"
      no-footer
      visible={open}
    >
      <div className="order-detail">
        <div className="order-detail-head">
          <div>
            <div className="order-detail-no mono" id="order-detail-no">
              {row?.id ?? ''}
            </div>
            <div className="order-detail-sub">{t('orders.detailTitle')}</div>
          </div>
          {row && (
            <oas-tag
              data-testid="order-detail-tag"
              id="order-detail-tag"
              type={tagTypeFor(row.status) === 'purple' ? undefined : tagTypeFor(row.status)}
              color={tagTypeFor(row.status) === 'purple' ? 'purple' : undefined}
            >
              {statusLabel(row.status, t)}
            </oas-tag>
          )}
        </div>
        <oas-descriptions id="order-detail-desc" column="1">
          <oas-descriptions-item label={t('orders.th.customer')}>
            {row?.customer ?? ''}
          </oas-descriptions-item>
          <oas-descriptions-item label={t('orders.dl.creator')}>
            {row?.creator ?? ''}
          </oas-descriptions-item>
          <oas-descriptions-item label={t('orders.th.amount')}>
            <span className="mono">{row ? formatMoney(row.amount) : ''}</span>
          </oas-descriptions-item>
          <oas-descriptions-item label={t('orders.th.created')}>
            <span className="mono">{row?.created ?? ''}</span>
          </oas-descriptions-item>
          <oas-descriptions-item label={t('orders.dl.items')}>
            {row?.items.map((it, i) => (
              <oas-tag key={`${it}-${i}`}>{it}</oas-tag>
            ))}
          </oas-descriptions-item>
        </oas-descriptions>
        <div className="order-detail-foot">
          <div className="order-detail-foot-row">
            <oas-button
              ref={actionRef}
              data-testid="order-detail-action"
              id="order-detail-action"
              type="primary"
              hidden={!flow || undefined}
              data-target={flow?.to}
            >
              {flow?.label ?? ''}
            </oas-button>
            <a
              className="link-btn"
              data-testid="order-detail-link"
              href="#/order-detail"
              ref={linkRef}
            >
              {t('orders.fullDetail')}
            </a>
          </div>
          <div className="order-detail-note" id="order-detail-note" hidden={!!flow || undefined}>
            {row ? (row.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')) : ''}
          </div>
        </div>
      </div>
    </oas-drawer>
  )
}
