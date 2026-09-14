// 创建订单向导页脚本（自 vanilla src/pages/form.ts 去 TS 移植，MPA 适配版）
// 差异：无 onLocaleChange 订阅（MPA 切语言 = reload）；提交成功写 sessionStorage
// `form-result` 后 location.href 跳 result.html（MPA 真实导航，无 SPA 路由）
import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'
import { createOrder } from './data/orders.js'
import { listProducts } from './data/products.js'

const STEPS = () => [
  { title: t('form.step.basic') },
  { title: t('form.step.products') },
  { title: t('form.step.confirm') },
]

const PHONE_RE = /^1\d{10}$/

// 表单标签 key（按 .form-label 在 DOM 中的出现顺序逐字对齐 vanilla LABEL_KEYS 段）
const LABEL_KEYS = [
  'form.label.customer',
  'form.label.phone',
  'form.label.note',
  'form.label.products',
  'form.label.qty',
  'form.label.urgent',
  'form.label.expectDate',
]

function formatMoney(n) {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

if (guard()) boot()

function boot() {
  document.title = `${t('nav.createOrder')} · ${t('app.title')}`
  applyStaticTexts()
  // 隐藏路由：不进侧栏，无高亮项（vanilla /form 有菜单项但 mpa 侧栏暂不收录）
  initShell({ active: '' })
  window.OASShell.setBreadcrumb([{ label: 'nav.createOrder' }])
  renderWizard()
}

function renderWizard() {
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

  const stepsEl = document.querySelector('[data-testid="form-steps"]')
  const panels = Array.from(document.querySelectorAll('.form-step'))
  const prev = document.querySelector('[data-testid="form-prev"]')
  const next = document.querySelector('[data-testid="form-next"]')
  const submit = document.querySelector('[data-testid="form-submit"]')
  submit.style.display = 'none'
  const customer = document.querySelector('[data-testid="form-customer"]')
  const phone = document.querySelector('[data-testid="form-phone"]')
  const note = document.querySelector('[data-testid="form-note"]')
  const productsGroup = document.querySelector('[data-testid="form-products"]')
  const qty = document.querySelector('[data-testid="form-qty"]')
  const urgent = document.querySelector('[data-testid="form-urgent"]')
  const datePicker = document.querySelector('[data-testid="form-date"]')
  const confirmCb = document.querySelector('[data-testid="form-confirm"]')
  const totalEl = document.querySelector('[data-testid="form-total"]')
  const footSummary = document.querySelector('[data-testid="form-foot-summary"]')
  const summary = document.querySelector('[data-testid="form-summary"]')
  const itemsWrap = document.querySelector('[data-testid="form-items"]')

  // 步骤条/标签/占位文案随 locale（HTML 静态无法表达 t()）；.label-text 单独换文以保留 * 号
  stepsEl.setAttribute('steps', JSON.stringify(STEPS()))
  document.querySelectorAll('.form-step .form-field > .form-label .label-text').forEach((n, i) => {
    const k = LABEL_KEYS[i]
    if (k) n.textContent = t(k)
  })
  document.querySelector('#form-subtitle').textContent = t('form.subtitle')
  document.querySelector('.form-total .total-text').textContent = t('form.total')
  document.querySelector('#form-products span[slot="label"]').textContent =
    t('form.placeholder.products')
  customer.setAttribute('placeholder', t('form.rule.customer'))
  phone.setAttribute('placeholder', t('form.rule.phone'))
  note.setAttribute('placeholder', t('form.placeholder.note'))

  datePicker.setAttribute('min', today())

  function productById(id) {
    return state.productsData.find((p) => p.id === Number(id))
  }

  function setError(testid, msg) {
    const e = document.querySelector(`[data-testid="${testid}"]`)
    e.textContent = msg
    e.hidden = false
  }

  function clearErrors() {
    document.querySelectorAll('.form-error').forEach((e) => {
      e.hidden = true
    })
    ;[customer, phone, productsGroup].forEach((c) => c.removeAttribute('aria-invalid'))
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
    summary.querySelector('#sum-customer').textContent = state.customer.trim() || '-'
    summary.querySelector('#sum-phone').textContent = state.phone.trim() || '-'
    summary.querySelector('#sum-note').textContent = state.note.trim() || '-'
    summary.querySelector('#sum-qty').textContent = String(state.quantity)
    summary.querySelector('#sum-urgent').textContent = state.urgent
      ? t('form.label.urgent')
      : t('form.summary.normalDelivery')
    summary.querySelector('#sum-date').textContent = state.expectDate || '-'

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

  async function loadProducts() {
    const rows = await listProducts()
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
      // MPA 页间传参：结果标记写入 sessionStorage，result.html 读后即焚（vanilla/react 同键名）
      sessionStorage.setItem(
        'form-result',
        JSON.stringify({ status: 'success', orderId: order.id }),
      )
      location.href = './result.html'
    } finally {
      submit.removeAttribute('loading')
    }
  }

  next.addEventListener('click', goNext)
  prev.addEventListener('click', goPrev)
  submit.addEventListener('click', () => void submitOrder())

  // 步骤条越级点击：向前跳需先通过当前步校验，失败回弹 current（vanilla 同款）
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

  void loadProducts()
  syncStepVis()
}
