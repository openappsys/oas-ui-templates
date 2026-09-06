// src/pages/product-edit.tsx —— 商品编辑页（page 表单模式：oas-page-header + 表单）
//    结构 + 数据就绪边沿的 useEffect 做同款 setAttribute 回填（表单字段非受控，
// 2. 事件绑定：pe-save/pe-cancel 按钮在 light DOM（非 drawer/modal panel），原生 click
//    用 React onClick；oas-submit 自定义事件走 useOasEvent//    改用 react-router 的 Link（to="/products"），两模式均正确
//    整页重渲染，title/rules/placeholder/标签随 locale 自动重算（products 同款模式）
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './products.css'
import type { ProductRow } from '../data/products'
import { useOasEvent } from '../hooks/use-oas-event'
import { useCategories, useProduct, useProductMutations } from '../hooks/use-products'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

interface FormValues {
  name: string
  category: string
  price: string
  stock: string
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ProductEditPage() {
  const { t } = useT()
  const navigate = useNavigate()

  const [id] = useState<number | null>(() => {
    const rawId = sessionStorage.getItem('product-edit-id')
    return rawId ? Number(rawId) : null
  })

  // 分类/商品详情/保存全部走 query/mutation 缓存层
  const { data: cats } = useCategories()
  const catOptions = useMemo(
    () => (cats ?? []).map((c) => ({ label: c.name, value: c.name })),
    [cats],
  )
  const productQuery = useProduct(id)
  const editing: ProductRow | null = productQuery.data ?? null
  const { create, update } = useProductMutations()

  const formRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const catRef = useRef<HTMLElement | null>(null)
  const priceRef = useRef<HTMLElement | null>(null)
  const stockRef = useRef<HTMLElement | null>(null)
  const dateRef = useRef<HTMLElement | null>(null)
  const savingRef = useRef(false)

  // 数据就绪边沿回填（字段非受控，与原异步加载完成后的 setAttribute 同时机）：
  // 新建=分类就绪即填；编辑=分类与商品详情都就绪再填
  useEffect(() => {
    if (!catOptions.length) return
    if (id != null && productQuery.isPending) return
    const row = editing
    if (id != null && productQuery.isSuccess && !row) appMessage.error(t('products.notFound'))
    const fallbackCat =
      row && catOptions.some((c) => c.value === row.category)
        ? row.category
        : (catOptions[0]?.value ?? '')
    nameRef.current?.setAttribute('value', row?.name ?? '')
    catRef.current?.setAttribute('value', fallbackCat)
    priceRef.current?.setAttribute('value', row ? String(row.price) : '')
    stockRef.current?.setAttribute('value', row ? String(row.stock) : '')
    dateRef.current?.setAttribute('value', row?.created ?? today())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catOptions, productQuery.status])

  const onSave = () => {
    ;(formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

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
        category: values.category || catOptions[0]?.value || '',
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? ('on' as const),
        created: dateRef.current?.getAttribute('value') || today(),
      }
      if (editing) {
        const updated = await update.mutateAsync({ id: editing.id, payload })
        if (!updated) appMessage.error(t('products.notFound'))
        else appMessage.success(t('common.saved'))
      } else {
        await create.mutateAsync(payload)
        appMessage.success(t('common.created'))
      }
      navigate('/products')
    } finally {
      savingRef.current = false
    }
  })

  const title = id ? t('products.editItem').replace('#{id}', String(id)) : t('products.newProduct')
  const rules = JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })

  return (
    <div className="page product-edit-page">
      <oas-page-header data-testid="pe-page-header" title={title}>
        <div slot="extra" className="ph-extra">
          <Link className="link-btn" data-testid="pe-back" to="/products">
            {t('orderDetail.backList')}
          </Link>
        </div>
      </oas-page-header>
      <oas-card>
        <oas-form ref={formRef} id="product-form" rules={rules}>
          <div className="product-form">
            <div className="form-field">
              <label className="form-label">
                {t('products.form.name')}
                <span className="req">*</span>
              </label>
              <oas-input
                ref={nameRef}
                data-testid="pf-name"
                name="name"
                placeholder={t('products.form.namePlaceholder')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t('products.category')}</label>
              <oas-select
                ref={catRef}
                data-testid="pf-category"
                name="category"
                options={JSON.stringify(catOptions)}
              />
            </div>
            <div className="form-grid">
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
              <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture" />
            </div>
            <div className="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="pe-cancel" onClick={() => navigate('/products')}>
                  {t('common.cancel')}
                </oas-button>
                <oas-button data-testid="pe-save" type="primary" onClick={onSave}>
                  {t('common.save')}
                </oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-card>
    </div>
  )
}
