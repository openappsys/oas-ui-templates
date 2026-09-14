/**
 * 订单详情页（自 vanilla src/pages/order-detail.ts 去 TS 移植）
 * 订单号经 sessionStorage 键 order-detail-id 传递（vanilla 同款）
 */
import { onLocaleChange, t } from './i18n.js'
import { getOrder, updateOrderStatus } from './data/orders.js'
import { buildTimeline, flowFor, formatMoneyPrecise, FLOW_STEPS, setTagType, statusLabel } from './order-shared.js'

export function renderOrderDetail(el) {
  const id = sessionStorage.getItem('order-detail-id') ?? ''
  let order = null

  function draw() {
    document.title = `${t('nav.orderDetail')} · ${t('app.title')}`
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
    bind()
    void load()
  }

  const q = (sel) => el.querySelector(sel)

  function renderSteps() {
    const stepsWrap = q('#order-detail-steps')
    if (!order || order.status === 'cancelled') {
      stepsWrap.hidden = true
      return
    }
    const steps = FLOW_STEPS.map((s) => ({ title: statusLabel(s) }))
    const current = FLOW_STEPS.indexOf(order.status)
    stepsWrap.hidden = false
    stepsWrap.innerHTML = `<oas-steps class="order-steps" steps='${JSON.stringify(steps)}' current="${current}"></oas-steps>`
  }

  function renderBasic() {
    if (!order) return
    const basic = q('[data-testid="order-detail-basic"]')
    basic.innerHTML = `
      <oas-descriptions-item label="${t('orders.th.customer')}"><span id="odb-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.amount')}"><span id="odb-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.phone')}"><span id="odb-phone" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.urgent')}"><span id="odb-urgent"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.created')}"><span id="odb-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.items')}"><span id="odb-items"></span></oas-descriptions-item>`
    q('#odb-customer').textContent = order.customer
    q('#odb-amount').textContent = formatMoneyPrecise(order.amount)
    q('#odb-phone').textContent = order.phone ?? '-'
    q('#odb-urgent').textContent = order.urgent
      ? t('form.label.urgent')
      : t('form.summary.normalDelivery')
    q('#odb-created').textContent = order.created
    q('#odb-items').innerHTML = order.items.map((it) => `<oas-tag>${it}</oas-tag>`).join(' ')
  }

  function renderTimeline() {
    if (!order) return
    q('#order-detail-timeline-wrap').innerHTML = `<oas-timeline data-testid="order-detail-timeline">${buildTimeline(order)
      .map(
        (n) =>
          `<oas-timeline-item time="${n.time}"${n.color ? ` color="${n.color}"` : ''}>${n.title}</oas-timeline-item>`,
      )
      .join('')}</oas-timeline>`
  }

  function renderAction() {
    if (!order) return
    const act = flowFor(order.status)
    const action = q('[data-testid="order-detail-action"]')
    const note = q('#order-detail-note')
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
    const tag = q('[data-testid="order-status-tag"]')
    q('[data-testid="order-page-header"]').setAttribute('title', order.id)
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
      q('#order-detail-card').hidden = true
      const missing = q('#order-detail-missing')
      missing.hidden = false
      missing.innerHTML = `<oas-empty description="${t('orderDetail.missing')}"></oas-empty>`
      q('[data-testid="order-page-header"]').setAttribute('title', t('nav.orderDetail'))
      q('[data-testid="order-status-tag"]').textContent = t('orderDetail.loading')
      return
    }
    renderAll()
  }

  function bind() {
    q('[data-testid="order-detail-action"]').addEventListener('click', async (e) => {
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
      OASUI.message.success(t('orders.flowApplied', { action: button.textContent }))
      order = updated
      renderAll()
    })
  }

  draw()
  return onLocaleChange(draw)
}
