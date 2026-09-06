// src/pages/form.tsx —— 创建订单向导（三步 steps + 逐步校验 + 摘要确认 + 提交跳结果页）
// 行为事实来源：vanilla-html/src/pages/form.ts（402 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 用 innerHTML 拼装 + onLocaleChange(refreshText) 逐节点刷文案；本模版
//    声明式 JSX，useT() 订阅 locale 后整页重渲染（steps/steps 标题/label 随 locale 重算）
// 2. 状态：customer/phone/note/products/quantity/urgent/expectDate/confirmed 全部 useState；
//    vanilla 手写 state 对象 + 逐事件同步，本模版等价拆分为受控 state
// 3. 校验错误：vanilla setError/clearErrors 命令式切 .form-error 的 hidden/textContent 与
//    aria-invalid；本模版由 errors state 派生（data-testid 保留，可观察结果一致）
// 4. 面板/按钮显隐：vanilla 命令式 hidden 与 style.display 切换；本模版由 step 派生
//    （oas-button 基类 :host([hidden]) 生效，orders-drawer 同款）
// 5. steps 越级点击：oas-change handler 里目标步大于当前步时先校验，失败则命令式把 current
//    拨回当前步（vanilla setAttribute('current', state.step) 同款——组件 goto 已自写 current，
//    React vdom 值未变不会自动回写，必须命令式复位）
// 6. checkbox-group 的 oas-change 会收到内部 checkbox 冒泡的同名事件，必须过滤
//    ev.target === 宿主（vanilla if (e.target !== productsGroup) return 同款守卫）
// 7. 提交：createOrder → sessionStorage 'form-result'（键名与时机逐字一致）→ navigate('/result')
//    （react-router 等价 vanilla hash navigate）
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { listProducts } from '../data/products'
import type { ProductRow } from '../data/products'
import { createOrder } from '../data/orders'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

const PHONE_RE = /^1\d{10}$/

/** vanilla STEPS */
function buildSteps(t: (key: string) => string): Array<{ title: string }> {
  return [
    { title: t('form.step.basic') },
    { title: t('form.step.products') },
    { title: t('form.step.confirm') },
  ]
}

/** vanilla formatMoney */
function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** vanilla today */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function FormPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [products, setProducts] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [urgent, setUrgent] = useState(false)
  const [expectDate, setExpectDate] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [productsData, setProductsData] = useState<ProductRow[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const stepsRef = useRef<HTMLElement | null>(null)
  const customerRef = useRef<HTMLElement | null>(null)
  const phoneRef = useRef<HTMLElement | null>(null)
  const noteRef = useRef<HTMLElement | null>(null)
  const productsGroupRef = useRef<HTMLElement | null>(null)
  const qtyRef = useRef<HTMLElement | null>(null)
  const urgentRef = useRef<HTMLElement | null>(null)
  const dateRef = useRef<HTMLElement | null>(null)
  const confirmRef = useRef<HTMLElement | null>(null)
  const submitRef = useRef<HTMLElement | null>(null)

  // vanilla loadProducts：价格升序（renderProductsOptions 的 sort 同款）
  useEffect(() => {
    void listProducts().then((rows) => {
      setProductsData([...rows].sort((a, b) => a.price - b.price))
    })
  }, [])

  const productById = (id: string): ProductRow | undefined =>
    productsData.find((p) => p.id === Number(id))
  const items = useMemo(
    () => products.map((id) => productById(id)).filter((p): p is ProductRow => !!p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, productsData],
  )
  const total = items.reduce((sum, p) => sum + p.price, 0) * quantity

  // vanilla clearErrors
  const clearErrors = () => setErrors({})

  // vanilla validateStep：错误写入 errors state（ setError 等价），返回是否通过
  const validateStep = (n: number): boolean => {
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
    setErrors(next)
    return ok
  }

  // vanilla goNext/goPrev
  const goNext = () => {
    if (!validateStep(step)) return
    setStep(step + 1)
    clearErrors()
  }
  const goPrev = () => {
    setStep(step - 1)
    clearErrors()
  }

  // vanilla stepsEl oas-change 段（偏差记录 5）
  useOasEvent<{ index: number }>(stepsRef, 'oas-change', (d) => {
    const target = d.index
    if (target === step) return
    if (target > step && !validateStep(step)) {
      stepsRef.current?.setAttribute('current', String(step))
      return
    }
    setStep(target)
    clearErrors()
  })

  // vanilla submitOrder 段：确认勾选 → 组装 → loading → createOrder → 快照 → 跳结果页
  const submitOrder = async () => {
    clearErrors()
    if (!confirmed) {
      setErrors({ 'form-error-confirm': t('form.rule.confirm') })
      return
    }
    if (items.length === 0) {
      appMessage.error(t('form.rule.productsRequired'))
      return
    }
    const amount = items.reduce((sum, p) => sum + p.price, 0) * quantity
    submitRef.current?.setAttribute('loading', '')
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
      submitRef.current?.removeAttribute('loading')
    }
  }

  // 步骤 1 输入项（oas-input/oas-clear/oas-change 自定义事件 → useOasEvent）
  useOasEvent<{ value: string }>(customerRef, 'oas-input', (d) => setCustomer(d.value))
  useOasEvent(customerRef, 'oas-clear', () => setCustomer(''))
  useOasEvent<{ value: string }>(phoneRef, 'oas-input', (d) => setPhone(d.value))
  useOasEvent(phoneRef, 'oas-clear', () => setPhone(''))
  useOasEvent<{ value: string }>(noteRef, 'oas-input', (d) => setNote(d.value))
  useOasEvent<{ value: number }>(qtyRef, 'oas-change', (d) => setQuantity(d.value))
  useOasEvent<{ checked: boolean }>(urgentRef, 'oas-change', (d) => setUrgent(d.checked))
  useOasEvent<{ value: string }>(dateRef, 'oas-change', (d) => setExpectDate(d.value))
  useOasEvent<{ checked: boolean }>(confirmRef, 'oas-change', (d) => setConfirmed(d.checked))
  // checkbox-group：内部 checkbox 的 oas-change 会冒泡，过滤只留宿主事件（偏差记录 6）
  useOasEvent<{ value: string[] }>(productsGroupRef, 'oas-change', (d, ev) => {
    if (ev.target !== productsGroupRef.current) return
    setProducts(d.value)
  })

  return (
    <div className="page form-wizard">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.createOrder')}</h1>
          <p className="page-subtitle">{t('form.subtitle')}</p>
        </div>
      </div>
      <oas-card>
        <oas-steps
          ref={stepsRef}
          data-testid="form-steps"
          steps={JSON.stringify(buildSteps(t))}
          current={step}
          clickable
        />
        <div className="form-step" data-testid="form-step1" data-index="0" hidden={step !== 0 || undefined}>
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
            <div className="form-error" data-testid="form-error-customer" hidden={!errors['form-error-customer'] || undefined}>
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
            <div className="form-error" data-testid="form-error-phone" hidden={!errors['form-error-phone'] || undefined}>
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
        <div className="form-step" data-testid="form-step2" data-index="1" hidden={step !== 1 || undefined}>
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
            <div className="form-error" data-testid="form-error-products" hidden={!errors['form-error-products'] || undefined}>
              {errors['form-error-products'] ?? ''}
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">{t('form.label.qty')}</label>
              <oas-input-number
                ref={qtyRef}
                data-testid="form-qty"
                min="1"
                precision="0"
                value="1"
              />
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
        <div className="form-step" data-testid="form-step3" data-index="2" hidden={step !== 2 || undefined}>
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
        <div className="form-foot">
          <div
            className="form-foot-summary"
            data-testid="form-foot-summary"
            hidden={step !== 2 || undefined}
          >
            <div className="form-total">
              {t('form.total')}
              <span className="num mono" data-testid="form-total">
                {formatMoney(total)}
              </span>
            </div>
            <div className="form-confirm">
              <oas-checkbox ref={confirmRef} data-testid="form-confirm">
                {t('form.confirm')}
              </oas-checkbox>
              <div className="form-error" data-testid="form-error-confirm" hidden={!errors['form-error-confirm'] || undefined}>
                {errors['form-error-confirm'] ?? ''}
              </div>
            </div>
          </div>
          <div className="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="form-prev" hidden={step === 0 || undefined} onClick={goPrev}>
                {t('form.prev')}
              </oas-button>
              <oas-button
                data-testid="form-next"
                type="primary"
                hidden={step === 2 || undefined}
                onClick={goNext}
              >
                {t('form.next')}
              </oas-button>
              <oas-button
                ref={submitRef}
                data-testid="form-submit"
                type="primary"
                hidden={step !== 2 || undefined}
                onClick={() => void submitOrder()}
              >
                {t('form.submit')}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-card>
    </div>
  )
}
