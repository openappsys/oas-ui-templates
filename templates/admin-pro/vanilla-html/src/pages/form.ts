import { message } from '@oas-ui/ui/feedback/message'
import { onLocaleChange, t } from '../i18n'
import { createOrder } from '../data/orders'
import { navigate } from '../router/mode'
import { listProducts } from '../data/products'
import type { ProductRow } from '../data/products'

const STEPS = (): Array<{ title: string }> => [
  { title: t('form.step.basic') },
  { title: t('form.step.products') },
  { title: t('form.step.confirm') },
]

const PHONE_RE = /^1\d{10}$/

function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface FormState {
  step: number
  customer: string
  phone: string
  note: string
  products: string[]
  quantity: number
  urgent: boolean
  expectDate: string
  confirmed: boolean
  productsData: ProductRow[]
}

export function render(el: HTMLElement): () => void {
  const state: FormState = {
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
            <label class="form-label">${t('form.label.customer')}<span class="req">*</span></label>
            <oas-input data-testid="form-customer" placeholder="${t('form.rule.customer')}" clearable></oas-input>
            <div class="form-error" data-testid="form-error-customer" hidden></div>
          </div>
          <div class="form-field">
            <label class="form-label">${t('form.label.phone')}<span class="req">*</span></label>
            <oas-input data-testid="form-phone" placeholder="${t('form.rule.phone')}" clearable></oas-input>
            <div class="form-error" data-testid="form-error-phone" hidden></div>
          </div>
          <div class="form-field">
            <label class="form-label">${t('form.label.note')}</label>
            <oas-textarea data-testid="form-note" rows="3" placeholder="${t('form.placeholder.note')}"></oas-textarea>
          </div>
        </div>
        <div class="form-step" data-testid="form-step2" data-index="1" hidden>
          <div class="form-field">
            <label class="form-label">${t('form.label.products')}<span class="req">*</span></label>
            <oas-checkbox-group data-testid="form-products" id="form-products" value="[]">
              <span slot="label">${t('form.placeholder.products')}</span>
            </oas-checkbox-group>
            <div class="form-error" data-testid="form-error-products" hidden></div>
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">${t('form.label.qty')}</label>
              <oas-input-number data-testid="form-qty" min="1" precision="0" value="1"></oas-input-number>
            </div>
            <div class="form-field">
              <label class="form-label">${t('form.label.urgent')}</label>
              <div class="switch-line">
                <oas-switch data-testid="form-urgent"></oas-switch>
              </div>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">${t('form.label.expectDate')}</label>
            <oas-date-picker data-testid="form-date"></oas-date-picker>
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
              <oas-button data-testid="form-submit" type="primary" hidden>${t('form.submit')}</oas-button>
            </oas-space>
          </div>
        </div>
      </oas-card>
    </div>`

  const stepsEl = el.querySelector<HTMLElement>('[data-testid="form-steps"]')!
  const panels = Array.from(el.querySelectorAll<HTMLElement>('.form-step'))
  const prev = el.querySelector<HTMLElement>('[data-testid="form-prev"]')!
  const next = el.querySelector<HTMLElement>('[data-testid="form-next"]')!
  const submit = el.querySelector<HTMLElement>('[data-testid="form-submit"]')!
  submit.style.display = 'none'
  const customer = el.querySelector<HTMLElement>('[data-testid="form-customer"]')!
  const phone = el.querySelector<HTMLElement>('[data-testid="form-phone"]')!
  const note = el.querySelector<HTMLElement>('[data-testid="form-note"]')!
  const productsGroup = el.querySelector<HTMLElement>('[data-testid="form-products"]')!
  const qty = el.querySelector<HTMLElement>('[data-testid="form-qty"]')!
  const urgent = el.querySelector<HTMLElement>('[data-testid="form-urgent"]')!
  const datePicker = el.querySelector<HTMLElement>('[data-testid="form-date"]')!
  const confirmCb = el.querySelector<HTMLElement>('[data-testid="form-confirm"]')!
  const totalEl = el.querySelector<HTMLElement>('[data-testid="form-total"]')!
  const footSummary = el.querySelector<HTMLElement>('[data-testid="form-foot-summary"]')!
  const summary = el.querySelector<HTMLElement>('[data-testid="form-summary"]')!
  const itemsWrap = el.querySelector<HTMLElement>('[data-testid="form-items"]')!

  datePicker.setAttribute('min', today())

  function productById(id: string): ProductRow | undefined {
    return state.productsData.find((p) => p.id === Number(id))
  }

  function setError(testid: string, msg: string): void {
    const e = el.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
    e.textContent = msg
    e.hidden = false
  }

  function clearErrors(): void {
    el.querySelectorAll<HTMLElement>('.form-error').forEach((e) => {
      e.hidden = true
    })
    ;[customer, phone, productsGroup].forEach((c) => c.removeAttribute('aria-invalid'))
  }

  function validateStep(n: number): boolean {
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

  function renderSummary(): void {
    const items = state.products.map((id) => productById(id)).filter((p): p is ProductRow => !!p)
    summary.innerHTML = `
      <oas-descriptions-item label="${t('form.summary.customer')}"><span id="sum-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.phone')}"><span id="sum-phone" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.note')}"><span id="sum-note"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.qty')}"><span id="sum-qty" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.summary.urgent')}"><span id="sum-urgent"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('form.label.expectDate')}"><span id="sum-date" class="mono"></span></oas-descriptions-item>`
    el.querySelector<HTMLElement>('#sum-customer')!.textContent = state.customer.trim() || '-'
    el.querySelector<HTMLElement>('#sum-phone')!.textContent = state.phone.trim() || '-'
    el.querySelector<HTMLElement>('#sum-note')!.textContent = state.note.trim() || '-'
    el.querySelector<HTMLElement>('#sum-qty')!.textContent = String(state.quantity)
    el.querySelector<HTMLElement>('#sum-urgent')!.textContent = state.urgent
      ? t('form.label.urgent')
      : t('form.summary.normalDelivery')
    el.querySelector<HTMLElement>('#sum-date')!.textContent = state.expectDate || '-'

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

  function renderProductGroup(): void {
    productsGroup.setAttribute('value', JSON.stringify(state.products))
    productsGroup.innerHTML = state.productsData
      .map(
        (p) => `
        <oas-checkbox value="${p.id}">${p.name} · <span class="mono">${formatMoney(p.price)}</span></oas-checkbox>`,
      )
      .join('')
  }

  function renderProductsOptions(rows: ProductRow[]): void {
    state.productsData = rows.sort((a, b) => a.price - b.price)
    renderProductGroup()
  }

  function syncStepVis(): void {
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

  async function loadProducts(): Promise<void> {
    const rows = await listProducts()
    renderProductsOptions(rows)
  }

  function goNext(): void {
    if (!validateStep(state.step)) return
    state.step += 1
    clearErrors()
    syncStepVis()
  }

  function goPrev(): void {
    state.step -= 1
    clearErrors()
    syncStepVis()
  }

  async function submitOrder(): Promise<void> {
    clearErrors()
    if (!state.confirmed) {
      setError('form-error-confirm', t('form.rule.confirm'))
      return
    }
    const items = state.products.map((id) => productById(id)).filter((p): p is ProductRow => !!p)
    if (items.length === 0) {
      message.error(t('form.rule.productsRequired'))
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
      message.success(t('form.created'))
      navigate('/result')
    } finally {
      submit.removeAttribute('loading')
    }
  }

  next.addEventListener('click', goNext)
  prev.addEventListener('click', goPrev)
  submit.addEventListener('click', () => void submitOrder())

  stepsEl.addEventListener('oas-change', (e) => {
    const target = (e as CustomEvent<{ index: number }>).detail.index
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
    state.customer = (e as CustomEvent<{ value: string }>).detail.value
  })
  customer.addEventListener('oas-clear', () => {
    state.customer = ''
  })
  phone.addEventListener('oas-input', (e) => {
    state.phone = (e as CustomEvent<{ value: string }>).detail.value
  })
  phone.addEventListener('oas-clear', () => {
    state.phone = ''
  })
  note.addEventListener('oas-input', (e) => {
    state.note = (e as CustomEvent<{ value: string }>).detail.value
  })
  qty.addEventListener('oas-change', (e) => {
    state.quantity = (e as CustomEvent<{ value: number }>).detail.value
  })
  urgent.addEventListener('oas-change', (e) => {
    state.urgent = (e as CustomEvent<{ checked: boolean }>).detail.checked
  })
  datePicker.addEventListener('oas-change', (e) => {
    state.expectDate = (e as CustomEvent<{ value: string }>).detail.value
  })
  confirmCb.addEventListener('oas-change', (e) => {
    state.confirmed = (e as CustomEvent<{ checked: boolean }>).detail.checked
  })
  productsGroup.addEventListener('oas-change', (e) => {
    if (e.target !== productsGroup) return
    state.products = (e as CustomEvent<{ value: string[] }>).detail.value
  })

  function refreshText(): void {
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('nav.createOrder')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('form.subtitle')
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
    el.querySelectorAll<HTMLElement>('.form-step .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (!k) return
      const req = n.querySelector('.req')
      n.textContent = t(k)
      if (req) n.appendChild(req)
    })
    el.querySelector<HTMLElement>('[data-testid="form-customer"]')!.setAttribute(
      'placeholder',
      t('form.rule.customer'),
    )
    el.querySelector<HTMLElement>('[data-testid="form-phone"]')!.setAttribute(
      'placeholder',
      t('form.rule.phone'),
    )
    el.querySelector<HTMLElement>('[data-testid="form-note"]')!.setAttribute(
      'placeholder',
      t('form.placeholder.note'),
    )
    el.querySelector<HTMLElement>('#form-products span[slot="label"]')!.textContent = t(
      'form.placeholder.products',
    )
    el.querySelector<HTMLElement>('.form-total')!.childNodes[0]!.textContent = t('form.total')
    el.querySelector<HTMLElement>('[data-testid="form-confirm"]')!.textContent = t('form.confirm')
    prev.textContent = t('form.prev')
    next.textContent = t('form.next')
    submit.textContent = t('form.submit')
    if (state.step === 2) renderSummary()
  }

  void loadProducts()
  syncStepVis()
  return onLocaleChange(refreshText)
}
