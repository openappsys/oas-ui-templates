import { message } from '@oas-ui/ui/feedback/message'
import { onLocaleChange, t } from '../i18n'
import { navigate } from '../router/mode'
import { listCategories } from '../data/categories'
import { createProduct, getProduct, updateProduct } from '../data/products'
import type { ProductRow } from '../data/products'
import '../styles/pages/products.css'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function render(el: HTMLElement): () => void {
  const rawId = sessionStorage.getItem('product-edit-id')
  const id = rawId ? Number(rawId) : null
  let editing: ProductRow | null = null
  let saving = false

  el.innerHTML = `
    <div class="page product-edit-page">
      <oas-page-header data-testid="pe-page-header" title="${id ? t('products.editItem').replace('#{id}', String(id)) : t('products.newProduct')}">
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

  const form = el.querySelector<HTMLElement>('#product-form')!
  const datePicker = el.querySelector<HTMLElement>('[data-testid="pf-date"]')!
  const upload = el.querySelector<HTMLElement>('[data-testid="pf-cover"]')!
  const catSel = el.querySelector<HTMLElement>('[data-testid="pf-category"]')!
  let categoryOptions: Array<{ label: string; value: string }> = []

  function fillForm(row: ProductRow): void {
    el.querySelector<HTMLElement>('[data-testid="pf-name"]')!.setAttribute('value', row.name)
    catSel.setAttribute(
      'value',
      categoryOptions.some((c) => c.value === row.category)
        ? row.category
        : (categoryOptions[0]?.value ?? ''),
    )
    el.querySelector<HTMLElement>('[data-testid="pf-price"]')!.setAttribute(
      'value',
      String(row.price),
    )
    el.querySelector<HTMLElement>('[data-testid="pf-stock"]')!.setAttribute(
      'value',
      String(row.stock),
    )
    datePicker.setAttribute('value', row.created)
  }

  async function init(): Promise<void> {
    const cats = await listCategories()
    categoryOptions = cats.map((c) => ({ label: c.name, value: c.name }))
    catSel.setAttribute('options', JSON.stringify(categoryOptions))
    if (id && Number.isFinite(id)) {
      editing = await getProduct(id)
      if (editing) fillForm(editing)
      else message.error(t('products.notFound'))
    } else {
      catSel.setAttribute('value', categoryOptions[0]?.value ?? '')
      datePicker.setAttribute('value', today())
    }
  }

  el.querySelector<HTMLElement>('[data-testid="pe-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  el.querySelector<HTMLElement>('[data-testid="pe-cancel"]')!.addEventListener('click', () => {
    location.hash = '/products'
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    const values = (
      e as CustomEvent<{
        values: { name: string; category: string; price: string; stock: string }
      }>
    ).detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      message.error(t('products.priceError'))
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
        created: datePicker.getAttribute('value') || today(),
      }
      if (editing) {
        const updated = await updateProduct(editing.id, payload)
        if (!updated) message.error(t('products.notFound'))
        else message.success(t('common.saved'))
      } else {
        await createProduct(payload)
        message.success(t('common.created'))
      }
      navigate('/products')
    } finally {
      saving = false
    }
  })

  function refreshText(): void {
    el.querySelector<HTMLElement>('[data-testid="pe-page-header"]')!.setAttribute(
      'title',
      id ? t('products.editItem').replace('#{id}', String(id)) : t('products.newProduct'),
    )
    el.querySelector<HTMLElement>('[data-testid="pe-back"]')!.textContent =
      t('orderDetail.backList')
    const LABEL_KEYS = [
      'products.form.name',
      'products.category',
      'products.th.price',
      'products.th.stock',
      'products.form.listedDate',
      'products.form.cover',
    ]
    el.querySelectorAll<HTMLElement>('#product-form .form-field .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (!k) return
      const req = n.querySelector('.req')
      n.textContent = t(k)
      if (req) n.appendChild(req)
    })
    el.querySelector<HTMLElement>('[data-testid="pf-name"]')!.setAttribute(
      'placeholder',
      t('products.form.namePlaceholder'),
    )
    datePicker.setAttribute('placeholder', t('products.form.datePlaceholder'))
    form.setAttribute(
      'rules',
      JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] }),
    )
    el.querySelector<HTMLElement>('[data-testid="pe-cancel"]')!.textContent = t('common.cancel')
    el.querySelector<HTMLElement>('[data-testid="pe-save"]')!.textContent = t('common.save')
  }

  void init()
  return onLocaleChange(refreshText)
}
