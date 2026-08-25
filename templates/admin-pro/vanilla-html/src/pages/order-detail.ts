import { message } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'
import { getOrder, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'

function statusLabel(status: OrderStatus): string {
  return t(`orders.status.${status}`)
}

const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}
const FLOW_STEPS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done']
const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}

function flowFor(status: OrderStatus): { label: string; to: OrderStatus } | undefined {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    { time: order.created, title: t('orderDetail.timeline.created') },
  ]
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

export function render(el: HTMLElement): () => void {
  const id = sessionStorage.getItem('order-detail-id') ?? ''
  let order: OrderRow | null = null

  el.innerHTML = `
    <div class="page order-detail-page">
      <oas-page-header data-testid="order-page-header" class="order-detail-ph" title="${t('nav.orderDetail')}">
        <div slot="extra" class="ph-extra">
          <a class="link-btn" href="#/orders" data-testid="order-back">${t('orderDetail.backList')}</a>
          <oas-tag data-testid="order-status-tag">${t('orderDetail.loading')}</oas-tag>
        </div>
      </oas-page-header>
      <div id="order-detail-card">
        <oas-card>
          <div id="order-detail-steps" hidden></div>
          <oas-descriptions data-testid="order-detail-basic" id="order-detail-basic" column="2"></oas-descriptions>
          <div class="order-timeline-head">${t('orderDetail.timelineTitle')}</div>
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
    const steps = FLOW_STEPS.map((s) => ({ title: statusLabel(s) }))
    const current = FLOW_STEPS.indexOf(order.status)
    stepsWrap.hidden = false
    stepsWrap.innerHTML = `<oas-steps class="order-steps" steps='${JSON.stringify(steps)}' current="${current}"></oas-steps>`
  }

  function renderBasic(): void {
    if (!order) return
    basic.innerHTML = `
      <oas-descriptions-item label="${t('orders.th.customer')}"><span id="odb-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.amount')}"><span id="odb-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.phone')}"><span id="odb-phone" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.urgent')}"><span id="odb-urgent"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.created')}"><span id="odb-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.items')}"><span id="odb-items"></span></oas-descriptions-item>`
    el.querySelector<HTMLElement>('#odb-customer')!.textContent = order.customer
    el.querySelector<HTMLElement>('#odb-amount')!.textContent = formatMoney(order.amount)
    el.querySelector<HTMLElement>('#odb-phone')!.textContent = order.phone ?? '-'
    el.querySelector<HTMLElement>('#odb-urgent')!.textContent = order.urgent
      ? t('form.label.urgent')
      : t('form.summary.normalDelivery')
    el.querySelector<HTMLElement>('#odb-created')!.textContent = order.created
    el.querySelector<HTMLElement>('#odb-items')!.innerHTML = order.items
      .map((it) => `<oas-tag>${it}</oas-tag>`)
      .join(' ')
  }

  function renderTimeline(): void {
    if (!order) return
    timelineWrap.innerHTML = `<oas-timeline data-testid="order-detail-timeline">${buildTimeline(
      order,
    )
      .map(
        (n) =>
          `<oas-timeline-item time="${n.time}"${n.color ? ` color="${n.color}"` : ''}>${n.title}</oas-timeline-item>`,
      )
      .join('')}</oas-timeline>`
  }

  function renderAction(): void {
    if (!order) return
    const act = flowFor(order.status)
    if (act) {
      action.style.display = ''
      note.hidden = true
      action.textContent = act.label
      action.dataset.target = act.to
    } else {
      action.style.display = 'none'
      note.hidden = false
      note.textContent = order.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')
    }
  }

  function renderAll(): void {
    if (!order) return
    ph.setAttribute('title', order.id)
    tag.textContent = statusLabel(order.status)
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
      missing.innerHTML = `<oas-empty description="${t('orderDetail.missing')}"></oas-empty>`
      ph.setAttribute('title', t('nav.orderDetail'))
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
      message.error(t('orders.notFound'))
      return
    }
    message.success(t('orders.flowApplied', { action: button.textContent }))
    order = updated
    renderAll()
  })

  void load()
  return () => {}
}
