// src/pages/product-edit.tsx —— 商品编辑页（page 表单模式：oas-page-header + 表单）
// 行为事实来源：vanilla-html/src/pages/product-edit.ts（186 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla innerHTML + init() 异步回填（setAttribute 逐字段）；本模版声明式
//    结构 + 数据就绪边沿的 useEffect 做同款 setAttribute 回填（表单字段非受控，
//    value 全走 attribute，与 vanilla 同一通道）
// 2. 事件绑定：pe-save/pe-cancel 按钮在 light DOM（非 drawer/modal panel），原生 click
//    用 React onClick；oas-submit 自定义事件走 useOasEvent（AGENTS.md 第 1 条）
// 3. 返回链接：vanilla 写死 href="#/products"；本模版路由支持 hash/history 双模式，
//    改用 react-router 的 Link（to="/products"），两模式均正确
// 4. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换；本模版 useT() 订阅后
//    整页重渲染，title/rules/placeholder/标签随 locale 自动重算（products 同款模式）
// 5. 取消按钮：vanilla location.hash='/products'；本模版 navigate('/products')
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import '../styles/pages/products.css'
import { listCategories } from '../data/categories'
import { createProduct, getProduct, updateProduct } from '../data/products'
import type { ProductRow } from '../data/products'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

interface Option {
  label: string
  value: string
}

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

  // vanilla：rawId 取自 sessionStorage（products 页 openForm page 模式写入，键名逐字一致）
  const [id] = useState<number | null>(() => {
    const rawId = sessionStorage.getItem('product-edit-id')
    return rawId ? Number(rawId) : null
  })
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [catOptions, setCatOptions] = useState<Option[]>([])

  const formRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const catRef = useRef<HTMLElement | null>(null)
  const priceRef = useRef<HTMLElement | null>(null)
  const stockRef = useRef<HTMLElement | null>(null)
  const dateRef = useRef<HTMLElement | null>(null)
  const savingRef = useRef(false)

  // vanilla init()：并发拉分类（applyOptions）+ 编辑态取行；数据就绪边沿回填
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cats = await listCategories()
      if (cancelled) return
      const opts = cats.map((c) => ({ label: c.name, value: c.name }))
      setCatOptions(opts)
      let row: ProductRow | null = null
      if (id && Number.isFinite(id)) {
        row = await getProduct(id)
        if (cancelled) return
        if (!row) appMessage.error(t('products.notFound'))
      }
      setEditing(row)
      // vanilla fillForm / 新建默认分支（setAttribute 回填，通道一致）
      const fallbackCat = row && opts.some((c) => c.value === row.category)
        ? row.category
        : (opts[0]?.value ?? '')
      nameRef.current?.setAttribute('value', row?.name ?? '')
      catRef.current?.setAttribute('value', fallbackCat)
      priceRef.current?.setAttribute('value', row ? String(row.price) : '')
      stockRef.current?.setAttribute('value', row ? String(row.stock) : '')
      dateRef.current?.setAttribute('value', row?.created ?? today())
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // vanilla pe-save click 段：触发 oas-form 内部原生 form 提交
  const onSave = () => {
    ;(
      formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null
    )?.requestSubmit()
  }

  // vanilla oas-submit 段：价格校验 → 组装 payload → create/update → 返回列表
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
        const updated = await updateProduct(editing.id, payload)
        if (!updated) appMessage.error(t('products.notFound'))
        else appMessage.success(t('common.saved'))
      } else {
        await createProduct(payload)
        appMessage.success(t('common.created'))
      }
      navigate('/products')
    } finally {
      savingRef.current = false
    }
  })

  const title = id
    ? t('products.editItem').replace('#{id}', String(id))
    : t('products.newProduct')
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
