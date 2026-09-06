// src/pages/form.tsx —— 创建订单向导（三步 steps + 逐步校验 + 摘要确认 + 提交跳结果页）
// 1. 渲染：声明式 JSX，useT() 订阅 locale 后整页重渲染（steps/标题/label 随 locale 重算）；
//    三个步骤面板为纯展示子组件（./form-steps.tsx），事件接线留在本页
// 2. 状态：customer/phone/note/products/quantity/urgent/expectDate/confirmed 全部 useState；
//    校验错误不入组件（原版 setError），由 errors state 派生 aria-invalid 与 form-error 文案
// 3. steps 越级点击：oas-change handler 里目标步大于当前步时先校验，失败则命令式把
//    current 复位（组件 goto 已自写 current，React vdom 值未变不会自动回写）
// 4. checkbox-group 的 oas-change 会收到内部 checkbox 冒泡的同名事件，须按 ev.target 过滤
// 5. 提交：createOrder → sessionStorage 'form-result' → navigate('/result')
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { listProducts } from '../data/products'
import type { ProductRow } from '../data/products'
import { createOrder } from '../data/orders'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import {
  FormStepBasic,
  FormStepConfirm,
  FormStepProducts,
  formatMoney,
} from './form-steps'

const PHONE_RE = /^1\d{10}$/

/** vanilla STEPS */
function buildSteps(t: (key: string) => string): Array<{ title: string }> {
  return [
    { title: t('form.step.basic') },
    { title: t('form.step.products') },
    { title: t('form.step.confirm') },
  ]
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

  const clearErrors = () => setErrors({})

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

  const goNext = () => {
    if (!validateStep(step)) return
    setStep(step + 1)
    clearErrors()
  }
  const goPrev = () => {
    setStep(step - 1)
    clearErrors()
  }

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
  // checkbox-group：内部 checkbox 的 oas-change 会冒泡，过滤只留宿主事件
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
        <FormStepBasic
          t={t}
          visible={step === 0}
          errors={errors}
          customerRef={customerRef}
          phoneRef={phoneRef}
          noteRef={noteRef}
        />
        <FormStepProducts
          t={t}
          visible={step === 1}
          errors={errors}
          productsData={productsData}
          products={products}
          productsGroupRef={productsGroupRef}
          qtyRef={qtyRef}
          urgentRef={urgentRef}
          dateRef={dateRef}
        />
        <FormStepConfirm
          t={t}
          visible={step === 2}
          customer={customer}
          phone={phone}
          note={note}
          quantity={quantity}
          urgent={urgent}
          expectDate={expectDate}
          items={items}
        />
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
              <div
                className="form-error"
                data-testid="form-error-confirm"
                hidden={!errors['form-error-confirm'] || undefined}
              >
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
