<script lang="ts">
  // src/pages/form.svelte —— 创建订单向导（三步 steps + 逐步校验 + 摘要确认 + 提交跳结果页）
  // 1. 渲染：声明式模板，useT() 订阅 locale 后整页重渲（steps/标题/label 随 locale 重算）；
  //    三个步骤面板为纯展示子组件（./form-steps.svelte），事件接线留在本页
  // 2. 状态：customer/phone/note/products/quantity/urgent/expectDate/confirmed 全部 $state；
  //    校验错误不入控件（原版 setError），由 errors state 派生 aria-invalid 与 form-error 文案
  // 3. steps 越级点击：oas-change handler 里目标步大于当前步时先校验，失败则命令式把
  //    current 复位（组件 goto 已自写 current，本页 state 值未变不会自动回写）
  // 4. 提交：createOrder → sessionStorage 'form-result' → navigate('/result')
  import './form.css'
  import { onMount } from 'svelte'
  import type { ProductRow } from '../data/products'
  import { listProducts } from '../data/products'
  import { createOrder } from '../data/orders'
  import { navigate } from '../router'
  import { useT } from '../lib/use-t.svelte'
  import { appMessage } from '../lib/app-message'
  import FormSteps, { formatMoney } from './form-steps.svelte'

  const PHONE_RE = /^1\d{10}$/

  /** vanilla STEPS */
  function buildSteps(t: (key: string) => string): Array<{ title: string }> {
    return [
      { title: t('form.step.basic') },
      { title: t('form.step.products') },
      { title: t('form.step.confirm') },
    ]
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时整页重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let step = $state(0)
  let customer = $state('')
  let phone = $state('')
  let note = $state('')
  let products = $state<string[]>([])
  let quantity = $state(1)
  let urgent = $state(false)
  let expectDate = $state('')
  let confirmed = $state(false)
  let errors = $state<Record<string, string>>({})

  let productsData = $state<ProductRow[]>([])

  let stepsEl: HTMLElement | null = $state(null)
  let submitEl: HTMLElement | null = $state(null)

  // 商品清单（与商品页同一份），按价格升序派生
  onMount(() => {
    void listProducts().then((rows) => {
      productsData = [...rows].sort((a, b) => a.price - b.price)
    })
  })

  // 已选商品行（按选择顺序）与合计金额
  const items = $derived(
    products
      .map((id) => productsData.find((p) => p.id === Number(id)))
      .filter((p): p is ProductRow => !!p),
  )
  const total = $derived(items.reduce((sum, p) => sum + p.price, 0) * quantity)

  const stepsAttrs = $derived.by(() => ({
    steps: JSON.stringify(buildSteps(tt)),
    current: step,
    clickable: '',
    'onoas-change': onStepsChange,
  }))

  function clearErrors(): void {
    errors = {}
  }

  /** 分步校验：失败收集 errors（不入控件，原版 setError 同语义），返回是否可放行 */
  function validateStep(n: number): boolean {
    const next: Record<string, string> = {}
    let ok = true
    if (n === 0) {
      if (!customer.trim()) {
        next['form-error-customer'] = t('form.rule.customer')
        ok = false
      }
      if (!phone.trim()) {
        next['form-error-phone'] = t('form.rule.phone')
        ok = false
      } else if (!PHONE_RE.test(phone.trim())) {
        next['form-error-phone'] = t('form.rule.phoneInvalid')
        ok = false
      }
    } else if (n === 1) {
      if (products.length === 0) {
        next['form-error-products'] = t('form.rule.productsRequired')
        ok = false
      }
      if (!(quantity >= 1)) {
        next['form-error-products'] = t('form.rule.qty')
        ok = false
      }
    }
    errors = next
    return ok
  }

  function goNext(): void {
    if (!validateStep(step)) return
    step += 1
    clearErrors()
  }
  function goPrev(): void {
    step -= 1
    clearErrors()
  }

  // steps 越级：目标步大于当前步先校验，失败则命令式复位 current（state 未变不触发回写）
  function onStepsChange(e: Event): void {
    const target = (e as CustomEvent<{ index: number }>).detail.index
    if (target === step) return
    if (target > step && !validateStep(step)) {
      stepsEl?.setAttribute('current', String(step))
      return
    }
    step = target
    clearErrors()
  }

  async function submitOrder(): Promise<void> {
    clearErrors()
    if (!confirmed) {
      errors = { 'form-error-confirm': t('form.rule.confirm') }
      return
    }
    if (items.length === 0) {
      appMessage.error(t('form.rule.productsRequired'))
      return
    }
    const amount = items.reduce((sum, p) => sum + p.price, 0) * quantity
    submitEl?.setAttribute('loading', '')
    try {
      const order = await createOrder({
        customer: customer.trim(),
        amount,
        status: 'pending',
        items: items.map((p) => p.name),
        urgent,
        phone: phone.trim(),
        note: note.trim() || undefined,
      })
      sessionStorage.setItem(
        'form-result',
        JSON.stringify({ status: 'success', orderId: order.id }),
      )
      appMessage.success(t('form.created'))
      navigate('/result')
    } finally {
      submitEl?.removeAttribute('loading')
    }
  }

  // 确认勾选（oas-checkbox 的 oas-change 走展开通道直绑）
  const confirmAttrs = $derived({
    'onoas-change': (e: Event) => {
      confirmed = (e as CustomEvent<{ checked: boolean }>).detail.checked
    },
  })
</script>

<div class="page form-wizard">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.createOrder')}</h1>
      <p class="page-subtitle">{tt('form.subtitle')}</p>
    </div>
  </div>
  <oas-card>
    <oas-steps bind:this={stepsEl} data-testid="form-steps" {...stepsAttrs}></oas-steps>
    <FormSteps
      {step}
      {errors}
      {productsData}
      {products}
      {customer}
      {phone}
      {note}
      {quantity}
      {urgent}
      {expectDate}
      onCustomerInput={(v) => (customer = v)}
      onCustomerClear={() => (customer = '')}
      onPhoneInput={(v) => (phone = v)}
      onPhoneClear={() => (phone = '')}
      onNoteInput={(v) => (note = v)}
      onProductsChange={(v) => (products = v)}
      onQtyChange={(v) => (quantity = v)}
      onUrgentChange={(checked) => (urgent = checked)}
      onDateChange={(v) => (expectDate = v)}
    />
    <div class="form-foot">
      <div class="form-foot-summary" data-testid="form-foot-summary" hidden={step !== 2}>
        <div class="form-total">
          {tt('form.total')}
          <span class="num mono" data-testid="form-total">{formatMoney(total)}</span>
        </div>
        <div class="form-confirm">
          <oas-checkbox data-testid="form-confirm" {...confirmAttrs}>
            {tt('form.confirm')}
          </oas-checkbox>
          <div
            class="form-error"
            data-testid="form-error-confirm"
            hidden={!errors['form-error-confirm']}
          >
            {errors['form-error-confirm'] ?? ''}
          </div>
        </div>
      </div>
      <div class="form-actions">
        <oas-space justify="end">
          <oas-button data-testid="form-prev" hidden={step === 0} onclick={goPrev}>
            {tt('form.prev')}
          </oas-button>
          <oas-button data-testid="form-next" type="primary" hidden={step === 2} onclick={goNext}>
            {tt('form.next')}
          </oas-button>
          <oas-button
            bind:this={submitEl}
            data-testid="form-submit"
            type="primary"
            hidden={step !== 2}
            onclick={() => void submitOrder()}
          >
            {tt('form.submit')}
          </oas-button>
        </oas-space>
      </div>
    </div>
  </oas-card>
</div>
