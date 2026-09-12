<script module lang="ts">
  // src/pages/form-steps.svelte —— 创建订单向导的三个步骤面板（纯展示）
  // 1. 输入类控件的值经 oas-input/oas-change 等自定义事件上行（接线回调由 form.svelte 传入），
  //    面板只负责按 props/errors 渲染；errors 由父组件 validateStep 派生
  // 2. aria-invalid 与 form-error 文案块成对出现（data-testid 逐字保留）
  // 3. oas-input/onoas-* 等 kebab 事件与未声明属性走 {...{}} 展开通道（app.d.ts 宽松基座）
  import type { ProductRow } from '../data/products'

  /** vanilla formatMoney */
  export function formatMoney(n: number): string {
    return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  /** vanilla today */
  export function today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  export interface FormStepsProps {
    /** 当前步（控制三面板显隐） */
    step: number
    errors: Record<string, string>
    productsData: ProductRow[]
    products: string[]
    customer: string
    phone: string
    note: string
    quantity: number
    urgent: boolean
    expectDate: string
    onCustomerInput: (v: string) => void
    onCustomerClear: () => void
    onPhoneInput: (v: string) => void
    onPhoneClear: () => void
    onNoteInput: (v: string) => void
    onProductsChange: (v: string[]) => void
    onQtyChange: (v: number) => void
    onUrgentChange: (checked: boolean) => void
    onDateChange: (v: string) => void
  }
</script>

<script lang="ts">
  import { useT } from '../lib/use-t.svelte'

  let {
    step,
    errors,
    productsData,
    products,
    customer,
    phone,
    note,
    quantity,
    urgent,
    expectDate,
    onCustomerInput,
    onCustomerClear,
    onPhoneInput,
    onPhoneClear,
    onNoteInput,
    onProductsChange,
    onQtyChange,
    onUrgentChange,
    onDateChange,
  }: FormStepsProps = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let productsGroupEl: HTMLElement | null = $state(null)

  // 事件处理：值上行经回调转发给父组件编排（Svelte 状态读取为响应式访问器，闭包值常新）
  function onCustomerInputEvt(e: Event): void {
    onCustomerInput((e as CustomEvent<{ value: string }>).detail.value)
  }
  function onPhoneInputEvt(e: Event): void {
    onPhoneInput((e as CustomEvent<{ value: string }>).detail.value)
  }
  function onNoteInputEvt(e: Event): void {
    onNoteInput((e as CustomEvent<{ value: string }>).detail.value)
  }
  // checkbox-group：内部 checkbox 的 oas-change 会冒泡，过滤只留宿主事件
  function onProductsChangeEvt(e: Event): void {
    if (e.target !== productsGroupEl) return
    onProductsChange((e as CustomEvent<{ value: string[] }>).detail.value)
  }
  function onQtyChangeEvt(e: Event): void {
    onQtyChange((e as CustomEvent<{ value: number }>).detail.value)
  }
  function onUrgentChangeEvt(e: Event): void {
    onUrgentChange((e as CustomEvent<{ checked: boolean }>).detail.checked)
  }
  function onDateChangeEvt(e: Event): void {
    onDateChange((e as CustomEvent<{ value: string }>).detail.value)
  }

  const customerAttrs = $derived({
    'onoas-input': onCustomerInputEvt,
    'onoas-clear': onCustomerClear,
  })
  const phoneAttrs = $derived({
    'onoas-input': onPhoneInputEvt,
    'onoas-clear': onPhoneClear,
  })
  const noteAttrs = $derived({ 'onoas-input': onNoteInputEvt })
  const productsGroupAttrs = $derived.by(() => ({
    value: JSON.stringify(products),
    'onoas-change': onProductsChangeEvt,
  }))
  const qtyAttrs = $derived({ min: '1', precision: '0', value: '1', 'onoas-change': onQtyChangeEvt })
  const urgentAttrs = $derived({ 'onoas-change': onUrgentChangeEvt })
  const dateAttrs = $derived({ min: today(), 'onoas-change': onDateChangeEvt })

  /** 已选商品行（按选择顺序，与 react 版 items 派生一致） */
  const items = $derived(
    products
      .map((id) => productsData.find((p) => p.id === Number(id)))
      .filter((p): p is ProductRow => !!p),
  )
</script>

<!-- 步骤 1：基本信息（客户/电话/备注） -->
<div class="form-step" data-testid="form-step1" data-index="0" hidden={step !== 0}>
  <div class="form-field">
    <label class="form-label">
      {tt('form.label.customer')}
      <span class="req">*</span>
    </label>
    <oas-input
      data-testid="form-customer"
      placeholder={tt('form.rule.customer')}
      clearable
      aria-invalid={errors['form-error-customer'] ? 'true' : null}
      {...customerAttrs}
    ></oas-input>
    <div class="form-error" data-testid="form-error-customer" hidden={!errors['form-error-customer']}>
      {errors['form-error-customer'] ?? ''}
    </div>
  </div>
  <div class="form-field">
    <label class="form-label">
      {tt('form.label.phone')}
      <span class="req">*</span>
    </label>
    <oas-input
      data-testid="form-phone"
      placeholder={tt('form.rule.phone')}
      clearable
      aria-invalid={errors['form-error-phone'] ? 'true' : null}
      {...phoneAttrs}
    ></oas-input>
    <div class="form-error" data-testid="form-error-phone" hidden={!errors['form-error-phone']}>
      {errors['form-error-phone'] ?? ''}
    </div>
  </div>
  <div class="form-field">
    <label class="form-label">{tt('form.label.note')}</label>
    <oas-textarea
      data-testid="form-note"
      {...{ rows: '3' }}
      placeholder={tt('form.placeholder.note')}
      {...noteAttrs}
    ></oas-textarea>
  </div>
</div>

<!-- 步骤 2：商品与配送（多选商品/数量/加急/期望日期） -->
<div class="form-step" data-testid="form-step2" data-index="1" hidden={step !== 1}>
  <div class="form-field">
    <label class="form-label">
      {tt('form.label.products')}
      <span class="req">*</span>
    </label>
    <oas-checkbox-group
      bind:this={productsGroupEl}
      id="form-products"
      data-testid="form-products"
      aria-invalid={errors['form-error-products'] ? 'true' : null}
      {...productsGroupAttrs}
    >
      <span slot="label">{tt('form.placeholder.products')}</span>
      {#each productsData as p (p.id)}
        <oas-checkbox {...{ value: String(p.id) }}>{p.name} · <span class="mono">{formatMoney(p.price)}</span></oas-checkbox>
      {/each}
    </oas-checkbox-group>
    <div class="form-error" data-testid="form-error-products" hidden={!errors['form-error-products']}>
      {errors['form-error-products'] ?? ''}
    </div>
  </div>
  <div class="form-grid">
    <div class="form-field">
      <label class="form-label">{tt('form.label.qty')}</label>
      <oas-input-number data-testid="form-qty" {...qtyAttrs}></oas-input-number>
    </div>
    <div class="form-field">
      <label class="form-label">{tt('form.label.urgent')}</label>
      <div class="switch-line">
        <oas-switch data-testid="form-urgent" {...urgentAttrs}></oas-switch>
      </div>
    </div>
  </div>
  <div class="form-field">
    <label class="form-label">{tt('form.label.expectDate')}</label>
    <oas-date-picker data-testid="form-date" {...dateAttrs}></oas-date-picker>
  </div>
</div>

<!-- 步骤 3：摘要确认（订单快照 + 明细行；确认勾选框在页脚区，见 form.svelte） -->
<div class="form-step" data-testid="form-step3" data-index="2" hidden={step !== 2}>
  <oas-descriptions data-testid="form-summary" {...{ column: '1' }}>
    <oas-descriptions-item {...{ label: tt('form.summary.customer') }}>
      {customer.trim() || '-'}
    </oas-descriptions-item>
    <oas-descriptions-item {...{ label: tt('form.summary.phone') }}>
      <span class="mono">{phone.trim() || '-'}</span>
    </oas-descriptions-item>
    <oas-descriptions-item {...{ label: tt('form.label.note') }}>
      {note.trim() || '-'}
    </oas-descriptions-item>
    <oas-descriptions-item {...{ label: tt('form.label.qty') }}>
      <span class="mono">{quantity}</span>
    </oas-descriptions-item>
    <oas-descriptions-item {...{ label: tt('form.summary.urgent') }}>
      {urgent ? tt('form.label.urgent') : tt('form.summary.normalDelivery')}
    </oas-descriptions-item>
    <oas-descriptions-item {...{ label: tt('form.label.expectDate') }}>
      <span class="mono">{expectDate || '-'}</span>
    </oas-descriptions-item>
  </oas-descriptions>
  <div class="form-items" data-testid="form-items">
    {#each items as p (p.id)}
      <div class="form-item-row">
        <span class="form-item-name">{p.name}</span>
        <span class="form-item-calc mono">
          {formatMoney(p.price)} × {quantity} = {formatMoney(p.price * quantity)}
        </span>
      </div>
    {/each}
  </div>
</div>
