/**
 * 创建订单页——三步向导（自 vanilla src/pages/form.ts 去 TS 移植，DOM/类名/testid 逐字对齐）
 * 步骤条可点击（越级前进需先通过当前步校验）；step3 汇总 + 总价 + 确认勾选；
 * 提交 createOrder → sessionStorage form-result → 跳 /result
 */
import { onLocaleChange, t } from './i18n.js'
import { createOrder } from './data/orders.js'
import { listProducts } from './data/products.js'

const STEPS = () => [
  { title: t('form.step.basic') },
  { title: t('form.step.products') },
  { title: t('form.step.confirm') },
]

const PHONE_RE = /^1\d{10}$/

function formatMoney(n) {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function renderForm(el) {
  const state = {
    step: 0,
    customer: '',
    phone: '',
    note: '',
    products: [],
    quantity: 1,
    urgent: false,
    expectDate: '',
    confirmed: false,
    productsData: [],
  }

  document.title = `${t('nav.createOrder')} · ${t('app.title')}`
  el.innerHTML = `
    <div class="page form-wizard">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.createOrder')}</h1>
          <p class="page-subtitle">${t('form.subtitle')}</p>
        </div>
      </div>
      <oas-card>
        <oas-steps data-testid="form-steps" id="form-steps" steps='${JSON.stringify(STEPS())}' current="0" clickable></oas-steps>
        <div class="form-step" data-testid="form-step1" data-index="0">
          <div class="form-field">
            <label class="form-label" for="form-customer">${t('form.label.customer')}<span class="req">*</span></label>
            <oas-input id="form-customer" data-testid="form-customer" placeholder="${t('form.rule.customer')}" clearable></oas-input>
            <div class="form-error" data-testid="form-error-customer" hidden></div>
          </div>
          <div class="form-field">
            <label class="form-label" for="form-phone">${t('form.label.phone')}<span class="req">*</span></label>
            <oas-input id="form-phone" data-testid="form-phone" placeholder="${t('form.rule.phone')}" clearable></oas-input>
            <div class="form-error" data-testid="form-error-phone" hidden></div>
          </div>
          <div class="form-field">
            <label class="form-label" for="form-note">${t('form.label.note')}</label>
            <oas-textarea id="form-note" data-testid="form-note" rows="3" placeholder="${t('form.placeholder.note')}"></oas-textarea>
          </div>
        </div>
        <div class="form-step" data-testid="form-step2" data-index="1" hidden>
          <div class="form-field">
            <div class="form-label">${t('form.label.products')}<span class="req">*</span></div>
            <oas-checkbox-group data-testid="form-products" id="form-products" value="[]">
              <span slot="label">${t('form.placeholder.products')}</span>
            </oas-checkbox-group>
            <div class="form-error" data-testid="form-error-products" hidden></div>
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label" for="form-qty">${t('form.label.qty')}</label>
              <oas-input-number id="form-qty" data-testid="form-qty" min="1" precision="0" value="1"></oas-input-number>
            </div>
            <div class="form-field">
              <label class="form-label" for="form-urgent">${t('form.label.urgent')}</label>
              <div class="switch-line">
                <oas-switch id="form-urgent" data-testid="form-urgent"></oas-switch>
              </div>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label" for="form-date">${t('form.label.expectDate')}</label>
            <oas-date-picker id="form-date" data-testid="form-date"></oas-date-picker>
          </div>
        </div>
        <div class="form-step" data-testid="form-step3" data-index="2" hidden>
          <oas-descriptions data-testid="form-summary" column="1"></oas-descriptions>
          <div class="form-items" data-testid="form-items" id="form-items"></div>
        </div>
        <div class="form-foot">
          <div class="form-foot-summary" data-testid="form-foot-summary" id="form-foot-summary" hidden>
            <div class="form-total">${t('form.total')}<span class="num mono" data-testid="form-total" id="form-total"></span></div>
            <div class="form-confirm">
              <oas-checkbox data-testid="form-confirm">${t('form.confirm')}</oas-checkbox>
              <div class="form-error" data-testid="form-error-confirm" hidden></div>
            </div>
          </div>
          <div class="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="form-prev">${t('form.prev')}</oas-button>
              <oas-button data-testid="form-next" type="primary">${t('form.next')}</oas-button>
              <!-- 显隐由 syncStepVis 以 style.display 切换（vanilla 同款）；不放 hidden 属性，
                   否则被 cdn 的 oas-button[hidden]{display:none!important} 怪癖修复规则永久隐藏 -->
              <oas-button data-testid="form-submit" type="primary">${t('form.submit')}</oas-button>
            </oas-space>
          </div>
        </div>
      </oas-card>
    </div>`

  const stepsEl = el.querySelector('[data-testid="form-steps"]')
  const panels = Array.from(el.querySelectorAll('.form-step'))
  const prev = el.querySelector('[data-testid="form-prev"]')
  const next = el.querySelector('[data-testid="form-next"]')
  const submit = el.querySelector('[data-testid="form-submit"]')
  submit.style.display = 'none'
  const customer = el.querySelector('[data-testid="form-customer"]')
  const phone = el.querySelector('[data-testid="form-phone"]')
  const note = el.querySelector('[data-testid="form-note"]')
  const productsGroup = el.querySelector('[data-testid="form-products"]')
  const qty = el.querySelector('[data-testid="form-qty"]')
  const urgent = el.querySelector('[data-testid="form-urgent"]')
  const datePicker = el.querySelector('[data-testid="form-date"]')
  const confirmCb = el.querySelector('[data-testid="form-confirm"]')
  const totalEl = el.querySelector('[data-testid="form-total"]')
  const footSummary = el.querySelector('[data-testid="form-foot-summary"]')
  const summary = el.querySelector('[data-testid="form-summary"]')
  const itemsWrap = el.querySelector('[data-testid="form-items"]')

  datePicker.setAttribute('min', today())

  function productById(id) {
    return state.productsData.find((p) => p.id === Number(id))
  }

  function setError(testid, msg) {
    const e = el.querySelector(`[data-testid="${testid}"]`)
    e.textContent = msg
    e.hidden = false
  }

  function clearErrors() {
    el.querySelectorAll('.form-error').forEach((e) => {
      e.hidden = true
    })
    ;[customer, phone, productsGroup].forEach((c) => {
      c.removeAttribute('aria-invalid')
    })
  }

  function validateStep(n) {
    clearErrors()
    let ok = true
    if (n === 0) {
      if (!state.customer.trim()) {
        setError('form-error-customer', t('form.rule.customer'))
        customer.setAttribute('aria-invalid', 'true')
        ok = false
      }
      if (!state.phone.trim()) {
        setError('form-error-phone', t('form.rule.phone'))
        phone.setAttribute('aria-invalid', 'true')
        ok = false
      } else if (!PHONE_RE.test(state.phone.trim())) {
        setError('form-error-phone', t('form.rule.phoneInvalid'))
        phone.setAttribute('aria-invalid', 'true')
        ok = false
      }
    } else if (n === 1) {
      if (state.products.length === 0) {
        setError('form-error-products', t('form.rule.productsRequired'))
        productsGroup.setAttribute('aria-invalid', 'true')
        ok = false
      }
      if (!(state.quantity >= 1)) {
        setError('form-error-products', t('form.rule.qty'))
        ok = false
      }
    }
    return ok
  }

  function renderSummary() {
    const items = state.products.map((id) => productById(id)).filter((p) => !!p)
    summary.innerHTML = `
      <oas-descriptions-item label="${t('form.summary.customer')}"><span id="sum-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.phone')}"><span id="sum-phone" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.note')}"><span id="sum-note"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.qty')}"><span id="sum-qty" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.urgent')}"><span id="sum-urgent"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.expectDate')}"><span id="sum-date" class="mono"></span></oas-descriptions-item>`
    el.querySelector('#sum-customer').textContent = state.customer.trim() || '-'
    el.querySelector('#sum-phone').textContent = state.phone.trim() || '-'
    el.querySelector('#sum-note').textContent = state.note.trim() || '-'
    el.querySelector('#sum-qty').textContent = String(state.quantity)
    el.querySelector('#sum-urgent').textContent = state.urgent
      ? t('form.label.urgent')
      : t('form.summary.normalDelivery')
    el.querySelector('#sum-date').textContent = state.expectDate || '-'

    itemsWrap.innerHTML = items
      .map(
        (p) => `
        <div class="form-item-row">
          <span class="form-item-name">${p.name}</span>
          <span class="form-item-calc mono">${formatMoney(p.price)} × ${state.quantity} = ${formatMoney(p.price * state.quantity)}</span>
        </div>`,
      )
      .join('')
    const total = items.reduce((sum, p) => sum + p.price, 0) * state.quantity
    totalEl.textContent = formatMoney(total)
  }

  function renderProductGroup() {
    productsGroup.setAttribute('value', JSON.stringify(state.products))
    productsGroup.innerHTML = state.productsData
      .map(
        (p) => `
        <oas-checkbox value="${p.id}">${p.name} · <span class="mono">${formatMoney(p.price)}</span></oas-checkbox>`,
      )
      .join('')
  }

  function renderProductsOptions(rows) {
    state.productsData = rows.sort((a, b) => a.price - b.price)
    renderProductGroup()
  }

  function syncStepVis() {
    panels.forEach((p, i) => {
      p.hidden = i !== state.step
    })
    prev.style.display = state.step === 0 ? 'none' : ''
    next.style.display = state.step === 2 ? 'none' : ''
    submit.style.display = state.step === 2 ? '' : 'none'
    footSummary.hidden = state.step !== 2
    stepsEl.setAttribute('current', String(state.step))
    if (state.step === 2) renderSummary()
  }

  async function loadProducts() {
    const rows = await listProducts()
    if (!el.isConnected) return
    renderProductsOptions(rows)
  }

  function goNext() {
    if (!validateStep(state.step)) return
    state.step += 1
    clearErrors()
    syncStepVis()
  }

  function goPrev() {
    state.step -= 1
    clearErrors()
    syncStepVis()
  }

  async function submitOrder() {
    clearErrors()
    if (!state.confirmed) {
      setError('form-error-confirm', t('form.rule.confirm'))
      return
    }
    const items = state.products.map((id) => productById(id)).filter((p) => !!p)
    if (items.length === 0) {
      OASUI.message.error(t('form.rule.productsRequired'))
      return
    }
    const amount = items.reduce((sum, p) => sum + p.price, 0) * state.quantity
    submit.setAttribute('loading', '')
    try {
      const order = await createOrder({
        customer: state.customer.trim(),
        amount,
        status: 'pending',
        items: items.map((p) => p.name),
        urgent: state.urgent,
        phone: state.phone.trim(),
        note: state.note.trim() || undefined,
      })
      sessionStorage.setItem(
        'form-result',
        JSON.stringify({ status: 'success', orderId: order.id }),
      )
      OASUI.message.success(t('form.created'))
      location.hash = '#/result'
    } finally {
      submit.removeAttribute('loading')
    }
  }

  next.addEventListener('click', goNext)
  prev.addEventListener('click', goPrev)
  submit.addEventListener('click', () => void submitOrder())

  // 步骤条可点击：越级前进需先通过当前步校验，回退放行（vanilla 同款）
  stepsEl.addEventListener('oas-change', (e) => {
    const target = e.detail.index
    if (target === state.step) return
    if (target > state.step) {
      if (!validateStep(state.step)) {
        stepsEl.setAttribute('current', String(state.step))
        return
      }
    }
    state.step = target
    clearErrors()
    syncStepVis()
  })

  customer.addEventListener('oas-input', (e) => {
    state.customer = e.detail.value
  })
  customer.addEventListener('oas-clear', () => {
    state.customer = ''
  })
  phone.addEventListener('oas-input', (e) => {
    state.phone = e.detail.value
  })
  phone.addEventListener('oas-clear', () => {
    state.phone = ''
  })
  note.addEventListener('oas-input', (e) => {
    state.note = e.detail.value
  })
  qty.addEventListener('oas-change', (e) => {
    state.quantity = e.detail.value
  })
  urgent.addEventListener('oas-change', (e) => {
    state.urgent = e.detail.checked
  })
  datePicker.addEventListener('oas-change', (e) => {
    state.expectDate = e.detail.value
  })
  confirmCb.addEventListener('oas-change', (e) => {
    state.confirmed = e.detail.checked
  })
  productsGroup.addEventListener('oas-change', (e) => {
    if (e.target !== productsGroup) return
    state.products = e.detail.value
  })

  function refreshText() {
    el.querySelector('h1.page-title').textContent = t('nav.createOrder')
    el.querySelector('p.page-subtitle').textContent = t('form.subtitle')
    stepsEl.setAttribute('steps', JSON.stringify(STEPS()))
    stepsEl.setAttribute('current', String(state.step))
    const LABEL_KEYS = [
      'form.label.customer',
      'form.label.phone',
      'form.label.note',
      'form.label.products',
      'form.label.qty',
      'form.label.urgent',
      'form.label.expectDate',
    ]
    el.querySelectorAll('.form-step .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (!k) return
      const req = n.querySelector('.req')
      n.textContent = t(k)
      if (req) n.appendChild(req)
    })
    el.querySelector('[data-testid="form-customer"]').setAttribute(
      'placeholder',
      t('form.rule.customer'),
    )
    el.querySelector('[data-testid="form-phone"]').setAttribute('placeholder', t('form.rule.phone'))
    el.querySelector('[data-testid="form-note"]').setAttribute(
      'placeholder',
      t('form.placeholder.note'),
    )
    el.querySelector('#form-products span[slot="label"]').textContent = t(
      'form.placeholder.products',
    )
    el.querySelector('.form-total').childNodes[0].textContent = t('form.total')
    el.querySelector('[data-testid="form-confirm"]').textContent = t('form.confirm')
    prev.textContent = t('form.prev')
    next.textContent = t('form.next')
    submit.textContent = t('form.submit')
    if (state.step === 2) renderSummary()
  }

  void loadProducts()
  syncStepVis()
  return onLocaleChange(refreshText)
}
