// src/pages/form-steps.tsx —— 创建订单向导的三个步骤面板（纯展示）
// 1. 输入类控件的值经 oas-input/oas-change 等自定义事件上行（接线在 form.tsx），面板
//    只负责按 props/errors 渲染；errors 由父组件 validateStep 派生
// 2. aria-invalid 与 form-error 文案块成对出现（data-testid 逐字保留）
import type { RefObject } from 'react'
import type { ProductRow } from '../data/products'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla formatMoney */
export function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** vanilla today */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type FieldRef = RefObject<HTMLElement | null>

/** 步骤 1：基本信息（客户/电话/备注） */
export function FormStepBasic({
  t,
  visible,
  errors,
  customerRef,
  phoneRef,
  noteRef,
}: {
  t: TFunc
  visible: boolean
  errors: Record<string, string>
  customerRef: FieldRef
  phoneRef: FieldRef
  noteRef: FieldRef
}) {
  return (
    <div
      className="form-step"
      data-testid="form-step1"
      data-index="0"
      hidden={!visible || undefined}
    >
      <div className="form-field">
        <label className="form-label">
          {t('form.label.customer')}
          <span className="req">*</span>
        </label>
        <oas-input
          ref={customerRef}
          data-testid="form-customer"
          placeholder={t('form.rule.customer')}
          clearable
          aria-invalid={errors['form-error-customer'] ? 'true' : undefined}
        />
        <div
          className="form-error"
          data-testid="form-error-customer"
          hidden={!errors['form-error-customer'] || undefined}
        >
          {errors['form-error-customer'] ?? ''}
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">
          {t('form.label.phone')}
          <span className="req">*</span>
        </label>
        <oas-input
          ref={phoneRef}
          data-testid="form-phone"
          placeholder={t('form.rule.phone')}
          clearable
          aria-invalid={errors['form-error-phone'] ? 'true' : undefined}
        />
        <div
          className="form-error"
          data-testid="form-error-phone"
          hidden={!errors['form-error-phone'] || undefined}
        >
          {errors['form-error-phone'] ?? ''}
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">{t('form.label.note')}</label>
        <oas-textarea
          ref={noteRef}
          data-testid="form-note"
          rows="3"
          placeholder={t('form.placeholder.note')}
        />
      </div>
    </div>
  )
}

/** 步骤 2：商品与配送（多选商品/数量/加急/期望日期） */
export function FormStepProducts({
  t,
  visible,
  errors,
  productsData,
  products,
  productsGroupRef,
  qtyRef,
  urgentRef,
  dateRef,
}: {
  t: TFunc
  visible: boolean
  errors: Record<string, string>
  productsData: ProductRow[]
  products: string[]
  productsGroupRef: FieldRef
  qtyRef: FieldRef
  urgentRef: FieldRef
  dateRef: FieldRef
}) {
  return (
    <div
      className="form-step"
      data-testid="form-step2"
      data-index="1"
      hidden={!visible || undefined}
    >
      <div className="form-field">
        <label className="form-label">
          {t('form.label.products')}
          <span className="req">*</span>
        </label>
        <oas-checkbox-group
          ref={productsGroupRef}
          id="form-products"
          data-testid="form-products"
          value={JSON.stringify(products)}
          aria-invalid={errors['form-error-products'] ? 'true' : undefined}
        >
          <span slot="label">{t('form.placeholder.products')}</span>
          {productsData.map((p) => (
            <oas-checkbox key={p.id} value={String(p.id)}>
              {p.name} · <span className="mono">{formatMoney(p.price)}</span>
            </oas-checkbox>
          ))}
        </oas-checkbox-group>
        <div
          className="form-error"
          data-testid="form-error-products"
          hidden={!errors['form-error-products'] || undefined}
        >
          {errors['form-error-products'] ?? ''}
        </div>
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label className="form-label">{t('form.label.qty')}</label>
          <oas-input-number ref={qtyRef} data-testid="form-qty" min="1" precision="0" value="1" />
        </div>
        <div className="form-field">
          <label className="form-label">{t('form.label.urgent')}</label>
          <div className="switch-line">
            <oas-switch ref={urgentRef} data-testid="form-urgent" />
          </div>
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">{t('form.label.expectDate')}</label>
        <oas-date-picker ref={dateRef} data-testid="form-date" min={today()} />
      </div>
    </div>
  )
}

/** 步骤 3：摘要确认（订单快照 + 明细行；确认勾选框在页脚区，见 form.tsx） */
export function FormStepConfirm({
  t,
  visible,
  customer,
  phone,
  note,
  quantity,
  urgent,
  expectDate,
  items,
}: {
  t: TFunc
  visible: boolean
  customer: string
  phone: string
  note: string
  quantity: number
  urgent: boolean
  expectDate: string
  items: ProductRow[]
}) {
  return (
    <div
      className="form-step"
      data-testid="form-step3"
      data-index="2"
      hidden={!visible || undefined}
    >
      <oas-descriptions data-testid="form-summary" column="1">
        <oas-descriptions-item label={t('form.summary.customer')}>
          {customer.trim() || '-'}
        </oas-descriptions-item>
        <oas-descriptions-item label={t('form.summary.phone')}>
          <span className="mono">{phone.trim() || '-'}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('form.label.note')}>
          {note.trim() || '-'}
        </oas-descriptions-item>
        <oas-descriptions-item label={t('form.label.qty')}>
          <span className="mono">{quantity}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('form.summary.urgent')}>
          {urgent ? t('form.label.urgent') : t('form.summary.normalDelivery')}
        </oas-descriptions-item>
        <oas-descriptions-item label={t('form.label.expectDate')}>
          <span className="mono">{expectDate || '-'}</span>
        </oas-descriptions-item>
      </oas-descriptions>
      <div className="form-items" data-testid="form-items">
        {items.map((p) => (
          <div key={p.id} className="form-item-row">
            <span className="form-item-name">{p.name}</span>
            <span className="form-item-calc mono">
              {formatMoney(p.price)} × {quantity} = {formatMoney(p.price * quantity)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
