import { message } from '@oas-ui/ui/feedback/message'
import { getOrder, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  shipping: '配送中',
  done: '已完成',
  cancelled: '已取消',
}
const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}
const FLOW_STEPS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done']
const STEP_TITLE: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  shipping: '配送中',
  done: '已完成',
}
const FLOW: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  pending: { label: '标记已支付', to: 'paid' },
  paid: { label: '开始配送', to: 'shipping' },
  shipping: { label: '确认完成', to: 'done' },
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

function setTagType(tag: HTMLElement, status: OrderStatus): void {
  const t = STATUS_TAG[status]
  if (t === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', t)
    tag.removeAttribute('color')
  }
}

function buildTimeline(order: OrderRow): Array<{ time: string; title: string; color?: string }> {
  const nodes: Array<{ time: string; title: string; color?: string }> = [
    { time: order.created, title: '创建订单' },
  ]
  if (order.status === 'cancelled') {
    nodes.push({ time: addDays(order.created, 1), title: '已取消', color: 'red' })
    return nodes
  }
  const idx = FLOW_STEPS.indexOf(order.status)
  if (idx >= 1) nodes.push({ time: addDays(order.created, 1), title: '已支付' })
  if (idx >= 2) nodes.push({ time: addDays(order.created, 2), title: '配送中' })
  if (idx >= 3) nodes.push({ time: addDays(order.created, 3), title: '已完成', color: 'green' })
  return nodes
}

export function render(el: HTMLElement): () => void {
  const id = sessionStorage.getItem('order-detail-id') ?? ''
  let order: OrderRow | null = null

  el.innerHTML = `
    <div class="page order-detail-page">
      <oas-page-header data-testid="order-page-header" class="order-detail-ph" title="订单详情">
        <div slot="extra" class="ph-extra">
          <a class="link-btn" href="#/orders" data-testid="order-back">返回列表</a>
          <oas-tag data-testid="order-status-tag">加载中</oas-tag>
        </div>
      </oas-page-header>
      <div id="order-detail-card">
        <oas-card>
          <div id="order-detail-steps" hidden></div>
          <oas-descriptions data-testid="order-detail-basic" id="order-detail-basic" column="2"></oas-descriptions>
          <div class="order-timeline-head">操作日志</div>
          <div id="order-detail-timeline-wrap"></div>
          <div class="order-detail-foot">
            <oas-button data-testid="order-detail-action" type="primary" hidden></oas-button>
            <div class="order-detail-note" id="order-detail-note" hidden></div>
          </div>
        </oas-card>
      </div>
      <div id="order-detail-missing" hidden></div>
    </div>`

  const ph = el.querySelector<HTMLElement>('[data-testid="order-page-header"]')!
  const tag = el.querySelector<HTMLElement>('[data-testid="order-status-tag"]')!
  const stepsWrap = el.querySelector<HTMLElement>('#order-detail-steps')!
  const basic = el.querySelector<HTMLElement>('[data-testid="order-detail-basic"]')!
  const timelineWrap = el.querySelector<HTMLElement>('#order-detail-timeline-wrap')!
  const action = el.querySelector<HTMLElement>('[data-testid="order-detail-action"]')!
  const note = el.querySelector<HTMLElement>('#order-detail-note')!
  const card = el.querySelector<HTMLElement>('#order-detail-card')!
  const missing = el.querySelector<HTMLElement>('#order-detail-missing')!

  function renderSteps(): void {
    if (!order || order.status === 'cancelled') {
      stepsWrap.hidden = true
      return
    }
    const steps = FLOW_STEPS.map((s) => ({ title: STEP_TITLE[s] }))
    const current = FLOW_STEPS.indexOf(order.status)
    stepsWrap.hidden = false
    stepsWrap.innerHTML = `<oas-steps class="order-steps" steps='${JSON.stringify(steps)}' current="${current}"></oas-steps>`
  }

  function renderBasic(): void {
    if (!order) return
    basic.innerHTML = `
      <oas-descriptions-item label="客户"><span id="odb-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="金额"><span id="odb-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="联系电话"><span id="odb-phone" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="加急"><span id="odb-urgent"></span></oas-descriptions-item>
      <oas-descriptions-item label="创建日期"><span id="odb-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="商品"><span id="odb-items"></span></oas-descriptions-item>`
    el.querySelector<HTMLElement>('#odb-customer')!.textContent = order.customer
    el.querySelector<HTMLElement>('#odb-amount')!.textContent = formatMoney(order.amount)
    el.querySelector<HTMLElement>('#odb-phone')!.textContent = order.phone ?? '-'
    el.querySelector<HTMLElement>('#odb-urgent')!.textContent = order.urgent ? '加急配送' : '普通配送'
    el.querySelector<HTMLElement>('#odb-created')!.textContent = order.created
    el.querySelector<HTMLElement>('#odb-items')!.innerHTML = order.items
      .map((it) => `<oas-tag>${it}</oas-tag>`)
      .join(' ')
  }

  function renderTimeline(): void {
    if (!order) return
    timelineWrap.innerHTML = `<oas-timeline data-testid="order-detail-timeline">${buildTimeline(order)
      .map(
        (n) =>
          `<oas-timeline-item time="${n.time}"${n.color ? ` color="${n.color}"` : ''}>${n.title}</oas-timeline-item>`,
      )
      .join('')}</oas-timeline>`
  }

  function renderAction(): void {
    if (!order) return
    const act = FLOW[order.status]
    if (act) {
      action.style.display = ''
      note.hidden = true
      action.textContent = act.label
      action.dataset.target = act.to
    } else {
      action.style.display = 'none'
      note.hidden = false
      note.textContent = order.status === 'done' ? '订单已完成，无需后续操作' : '订单已取消'
    }
  }

  function renderAll(): void {
    if (!order) return
    ph.setAttribute('title', order.id)
    tag.textContent = STATUS_LABEL[order.status]
    setTagType(tag, order.status)
    renderSteps()
    renderBasic()
    renderTimeline()
    renderAction()
  }

  async function load(): Promise<void> {
    order = await getOrder(id)
    if (!order) {
      card.hidden = true
      missing.hidden = false
      missing.innerHTML = `<oas-empty description="订单不存在或已被移除"></oas-empty>`
      ph.setAttribute('title', '订单详情')
      return
    }
    renderAll()
  }

  action.addEventListener('click', async (e) => {
    if (!order) return
    const button = e.currentTarget as HTMLElement
    const target = button.dataset.target as OrderStatus | undefined
    if (!target) return
    button.setAttribute('loading', '')
    const updated = await updateOrderStatus(order.id, target)
    button.removeAttribute('loading')
    if (!updated) {
      message.error('该订单不存在')
      return
    }
    message.success(`已${button.textContent}`)
    order = updated
    renderAll()
  })

  void load()
  return () => {}
}
