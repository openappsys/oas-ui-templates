// src/pages/product-form.tsx —— 商品表单（dialog/drawer 双形态，page 形态见 product-edit.tsx）
// 2. 取消/保存按钮：位于 oas-modal/oas-drawer 的 panel 内，panel 对原生 click stopPropagation
//    oas-submit/oas-close 自定义事件仍走 useOasEvent
//    React state 单一持有，必须监听 oas-close 回写 state，否则组件自闭后与 state 失同步
//    声明式 JSON attribute 随 categories state 重算，回填仅写 value attribute
import { useEffect, useRef } from 'react'
import type { ProductRow } from '../data/products'
import { createProduct, updateProduct } from '../data/products'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

export type ProductFormMode = 'dialog' | 'drawer'

export interface Option {
  label: string
  value: string
}

export interface ProductFormProps {
  mode: ProductFormMode
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义（行被删仍可按 id 提交） */
  editingId: number | null
  editing: ProductRow | null
  categories: Option[]
  onClose: () => void
  onSaved: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface FormValues {
  name: string
  category: string
  price: string
  stock: string
}

export function ProductForm({
  mode,
  open,
  editingId,
  editing,
  categories,
  onClose,
  onSaved,
}: ProductFormProps) {
  const { t } = useT()
  const surfaceRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const catRef = useRef<HTMLElement | null>(null)
  const priceRef = useRef<HTMLElement | null>(null)
  const stockRef = useRef<HTMLElement | null>(null)
  const dateRef = useRef<HTMLElement | null>(null)
  const uploadRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)
  const savingRef = useRef(false)

  // 回调最新化：面板内原生监听只在挂载时绑一次（notifications-drawer 同款）
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // vanilla resolveCategory：非法/空值回落第一个分类
  const resolveCategory = (value?: string): string => {
    if (value && categories.some((c) => c.value === value)) return value
    return categories[0]?.value ?? ''
  }

  // vanilla fillForm：open 边沿回填（编辑值/新建默认），upload 清空
  useEffect(() => {
    if (!open) return
    nameRef.current?.setAttribute('value', editing?.name ?? '')
    catRef.current?.setAttribute('value', resolveCategory(editing?.category))
    priceRef.current?.setAttribute('value', editing ? String(editing.price) : '')
    stockRef.current?.setAttribute('value', editing ? String(editing.stock) : '')
    dateRef.current?.setAttribute('value', editing?.created ?? today())
    if (uploadRef.current) (uploadRef.current as unknown as { files: unknown[] }).files = []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, categories])

  // panel 内原生 click 例外直绑（AGENTS.md 第 2 条）：取消=关闭；保存=触发内部原生 form 提交
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => onCloseRef.current()
    const onSave = () => {
      ;(
        formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null
      )?.requestSubmit()
    }
    cancel?.addEventListener('click', onCancel)
    save?.addEventListener('click', onSave)
    return () => {
      cancel?.removeEventListener('click', onCancel)
      save?.removeEventListener('click', onSave)
    }
  }, [])

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(surfaceRef, 'oas-close', () => onCloseRef.current())

  // vanilla oas-submit 段：价格校验 → 组装 payload → create/update → 关闭 + 刷新
  useOasEvent<{ values: FormValues }>(formRef, 'oas-submit', async (detail) => {
    if (savingRef.current) return
    const values = detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      appMessage.error(t('products.priceError'))
      return
    }
    savingRef.current = true
    try {
      const payload = {
        name: values.name,
        category: values.category || resolveCategory(),
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? ('on' as const),
        created: dateRef.current?.getAttribute('value') || today(),
      }
      if (editingId == null) {
        await createProduct(payload)
        appMessage.success(t('common.created'))
      } else {
        await updateProduct(editingId, payload)
        appMessage.success(t('common.saved'))
      }
      onSaved()
    } finally {
      savingRef.current = false
    }
  })

  const title =
    editingId == null
      ? t('products.newProduct')
      : t('products.editItem').replace('#{id}', String(editingId))
  const rules = JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })
  const catOptions = JSON.stringify(categories)

  const body = (
    <oas-form ref={formRef} id="product-form" rules={rules}>
      <div className="product-form">
        <div className="form-field">
          <label className="form-label">{t('products.form.name')}</label>
          <oas-input
            ref={nameRef}
            data-testid="pf-name"
            name="name"
            placeholder={t('products.form.namePlaceholder')}
          />
        </div>
        <div className="form-field">
          <label className="form-label">{t('products.category')}</label>
          <oas-select ref={catRef} data-testid="pf-category" name="category" options={catOptions} />
        </div>
        <div className="form-field">
          <label className="form-label">{t('products.th.price')}</label>
          <oas-input-number
            ref={priceRef}
            data-testid="pf-price"
            name="price"
            min="0.01"
            precision="2"
            placeholder="0.00"
          />
        </div>
        <div className="form-field">
          <label className="form-label">{t('products.th.stock')}</label>
          <oas-input-number
            ref={stockRef}
            data-testid="pf-stock"
            name="stock"
            min="0"
            placeholder="0"
          />
        </div>
        <div className="form-field">
          <label className="form-label">{t('products.form.listedDate')}</label>
          <oas-date-picker
            ref={dateRef}
            data-testid="pf-date"
            placeholder={t('products.form.datePlaceholder')}
          />
        </div>
        <div className="form-field">
          <label className="form-label">{t('products.form.cover')}</label>
          <oas-upload ref={uploadRef} data-testid="pf-cover" accept="image/*" list-type="picture" />
        </div>
        <div className="form-actions">
          <oas-space justify="end">
            <oas-button ref={cancelRef} data-testid="pf-cancel">
              {t('common.cancel')}
            </oas-button>
            <oas-button ref={saveRef} data-testid="pf-save" type="primary">
              {t('common.save')}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  )

  // vanilla surfaceMarkup：dialog=oas-modal 内嵌 h2#form-title；drawer=oas-drawer title 属性
  return mode === 'dialog' ? (
    <oas-modal
      ref={surfaceRef}
      data-testid="product-dialog"
      id="product-surface"
      no-footer
      visible={open}
    >
      <div className="modal-body">
        <h2 id="form-title">{title}</h2>
        {body}
      </div>
    </oas-modal>
  ) : (
    <oas-drawer
      ref={surfaceRef}
      data-testid="product-drawer"
      id="product-surface"
      title={title}
      placement="right"
      size="medium"
      no-footer
      visible={open}
    >
      {body}
    </oas-drawer>
  )
}
