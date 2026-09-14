/**
 * 商品新建/编辑页（自 vanilla src/pages/product-edit.ts 去 TS 移植）
 * 编辑目标经 sessionStorage 键 product-edit-id 传递（vanilla 同款）
 */
import { onLocaleChange, t } from './i18n.js'
import { listCategories } from './data/categories.js'
import { createProduct, getProduct, updateProduct } from './data/products.js'
import { fillProductForm, today } from './product-form.js'

export function renderProductEdit(el) {
  const rawId = sessionStorage.getItem('product-edit-id')
  const id = rawId ? Number(rawId) : null
  let editing = null
  let saving = false
  let categoryOptions = []

  function draw() {
    document.title = `${t('nav.products')} · ${t('app.title')}`
    el.innerHTML = `
    <div class="page product-edit-page">
      <oas-page-header data-testid="pe-page-header" title="${id ? t('products.editItem', { id }) : t('products.newProduct')}">
        <div slot="extra" class="ph-extra">
          <a class="link-btn" href="#/products" data-testid="pe-back">${t('orderDetail.backList')}</a>
        </div>
      </oas-page-header>
      <oas-card>
        <oas-form id="product-form" rules='${JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })}'>
          <div class="product-form">
            <div class="form-field">
              <label class="form-label">${t('products.form.name')}<span class="req">*</span></label>
              <oas-input data-testid="pf-name" name="name" placeholder="${t('products.form.namePlaceholder')}"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">${t('products.category')}</label>
              <oas-select data-testid="pf-category" name="category"></oas-select>
            </div>
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">${t('products.th.price')}</label>
                <oas-input-number data-testid="pf-price" name="price" min="0.01" precision="2" placeholder="0.00"></oas-input-number>
              </div>
              <div class="form-field">
                <label class="form-label">${t('products.th.stock')}</label>
                <oas-input-number data-testid="pf-stock" name="stock" min="0" placeholder="0"></oas-input-number>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">${t('products.form.listedDate')}</label>
              <oas-date-picker data-testid="pf-date" placeholder="${t('products.form.datePlaceholder')}"></oas-date-picker>
            </div>
            <div class="form-field">
              <label class="form-label">${t('products.form.cover')}</label>
              <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture"></oas-upload>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="pe-cancel">${t('common.cancel')}</oas-button>
                <oas-button data-testid="pe-save" type="primary">${t('common.save')}</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-card>
    </div>`
    bind()
    void init()
  }

  const q = (sel) => el.querySelector(sel)

  async function init() {
    const cats = await listCategories()
    categoryOptions = cats.map((c) => ({ label: c.name, value: c.name }))
    q('[data-testid="pf-category"]').setAttribute('options', JSON.stringify(categoryOptions))
    if (id && Number.isFinite(id)) {
      editing = await getProduct(id)
      if (editing) fillProductForm(el, editing, categoryOptions)
      else OASUI.message.error(t('products.notFound'))
    } else {
      q('[data-testid="pf-category"]').setAttribute('value', categoryOptions[0]?.value ?? '')
      q('[data-testid="pf-date"]').setAttribute('value', today())
    }
  }

  function bind() {
    q('[data-testid="pe-save"]').addEventListener('click', () => {
      q('#product-form').shadowRoot?.querySelector('form')?.requestSubmit()
    })

    q('[data-testid="pe-cancel"]').addEventListener('click', () => {
      location.hash = '#/products'
    })

    q('#product-form').addEventListener('oas-submit', async (e) => {
      if (saving) return
      const values = e.detail.values
      const price = Number(values.price)
      if (!(price > 0)) {
        OASUI.message.error(t('products.priceError'))
        return
      }
      saving = true
      try {
        const payload = {
          name: values.name,
          category: values.category || categoryOptions[0]?.value || '',
          price,
          stock: Number(values.stock) || 0,
          status: editing?.status ?? 'on',
          created: q('[data-testid="pf-date"]').getAttribute('value') || today(),
        }
        if (editing) {
          const updated = await updateProduct(editing.id, payload)
          if (!updated) OASUI.message.error(t('products.notFound'))
          else OASUI.message.success(t('common.saved'))
        } else {
          await createProduct(payload)
          OASUI.message.success(t('common.created'))
        }
        location.hash = '#/products'
      } finally {
        saving = false
      }
    })
  }

  draw()
  return onLocaleChange(draw)
}
