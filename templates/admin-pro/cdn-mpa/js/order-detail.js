import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { getOrder, updateOrderStatus } from './data/orders.js'

const STATUS_TAG = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}
const FLOW_STEPS = ['pending', 'paid', 'shipping', 'done']
const FLOW_TO = { pending: 'paid', paid: 'shipping', shipping: 'done' }

function statusLabel(status) {
  return t(`orders.status.${status}`)
}

function flowFor(status) {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

function formatMoney(n) {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

function setTagType(tag, status) {
  const type = STATUS_TAG[status]
  if (type === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', type)
    tag.removeAttribute('color')
  }
}

function buildTimeline(order) {
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

if (guard()) {
  document.title = `${t('nav.orderDetail')} · ${t('app.title')}`
  applyStaticTexts()
  // 隐藏路由：侧栏高亮父级「订单管理」
  initShell({ active: './orders.html' })
  // 面包屑：订单管理 → 订单详情
  window.OASShell.setBreadcrumb([
    { label: 'nav.orders', href: './orders.html' },
    { label: 'nav.orderDetail' },
  ])
  renderOrderDetail()
}

function renderOrderDetail() {
  // 读 sessionStorage（orders 列表抽屉「查看完整详情」写入）
  const id = sessionStorage.getItem('order-detail-id') ?? ''
  let order = null

  const ph = document.querySelector('[data-testid="order-page-header"]')
  const tag = document.querySelector('[data-testid="order-status-tag"]')
  const stepsWrap = document.querySelector('#order-detail-steps')
  const basic = document.querySelector('[data-testid="order-detail-basic"]')
  const timelineWrap = document.querySelector('#order-detail-timeline-wrap')
  const action = document.querySelector('[data-testid="order-detail-action"]')
  const note = document.querySelector('#order-detail-note')
  const card = document.querySelector('#order-detail-card')
  const missing = document.querySelector('#order-detail-missing')

  function renderSteps() {
    if (!order || order.status === 'cancelled') {
      stepsWrap.hidden = true
      return
    }
    const steps = FLOW_STEPS.map((s) => ({ title: statusLabel(s) }))
    const current = FLOW_STEPS.indexOf(order.status)
    stepsWrap.hidden = false
    const el = document.createElement('oas-steps')
    el.className = 'order-steps'
    el.setAttribute('steps', JSON.stringify(steps))
    el.setAttribute('current', String(current))
    stepsWrap.replaceChildren(el)
  }

  function renderBasic() {
    if (!order) return
    basic.innerHTML = `
      <oas-descriptions-item label="${t('orders.th.customer')}"><span id="odb-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.amount')}"><span id="odb-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.phone')}"><span id="odb-phone" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.urgent')}"><span id="odb-urgent"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.created')}"><span id="odb-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.items')}"><span id="odb-items"></span></oas-descriptions-item>`
    basic.querySelector('#odb-customer').textContent = order.customer
    basic.querySelector('#odb-amount').textContent = formatMoney(order.amount)
    basic.querySelector('#odb-phone').textContent = order.phone ?? '-'
    basic.querySelector('#odb-urgent').textContent = order.urgent
      ? t('form.label.urgent')
      : t('form.summary.normalDelivery')
    basic.querySelector('#odb-created').textContent = order.created
    basic.querySelector('#odb-items').innerHTML = order.items
      .map((it) => `<oas-tag>${it}</oas-tag>`)
      .join(' ')
  }

  function renderTimeline() {
    if (!order) return
    const tl = document.createElement('oas-timeline')
    tl.setAttribute('data-testid', 'order-detail-timeline')
    for (const n of buildTimeline(order)) {
      const item = document.createElement('oas-timeline-item')
      item.setAttribute('time', n.time)
      if (n.color) item.setAttribute('color', n.color)
      item.textContent = n.title
      tl.appendChild(item)
    }
    timelineWrap.replaceChildren(tl)
  }

  function renderAction() {
    if (!order) return
    const act = flowFor(order.status)
    if (act) {
      action.hidden = false
      note.hidden = true
      action.textContent = act.label
      action.dataset.target = act.to
    } else {
      action.hidden = true
      note.hidden = false
      note.textContent = order.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')
    }
  }

  function renderAll() {
    if (!order) return
    // 页头标题保持订单号（mono 字体）
    ph.setAttribute('title', order.id)
    tag.textContent = statusLabel(order.status)
    setTagType(tag, order.status)
    renderSteps()
    renderBasic()
    renderTimeline()
    renderAction()
  }

  async function load() {
    order = await getOrder(id)
    if (!order) {
      card.hidden = true
      missing.hidden = false
      const empty = document.createElement('oas-empty')
      empty.setAttribute('description', t('orderDetail.missing'))
      missing.replaceChildren(empty)
      ph.setAttribute('title', t('nav.orderDetail'))
      return
    }
    renderAll()
  }

  action.addEventListener('click', async (e) => {
    if (!order) return
    const button = e.currentTarget
    const target = button.dataset.target
    if (!target) return
    button.setAttribute('loading', '')
    const updated = await updateOrderStatus(order.id, target)
    button.removeAttribute('loading')
    if (!updated) {
      OASUI.message.error(t('orders.notFound'))
      return
    }
    OASUI.message.success(tf('orders.flowApplied', { action: button.textContent }))
    order = updated
    renderAll()
  })

  void load()
}
