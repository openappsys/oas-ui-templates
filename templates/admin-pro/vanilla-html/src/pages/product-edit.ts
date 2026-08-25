import { message } from '@oas-ui/ui/feedback/message'
import { createProduct, getProduct, updateProduct } from '../data/products'
import type { ProductCategory, ProductRow } from '../data/products'
import '../styles/pages/products.css'

const CATEGORY_OPTIONS = [
  { label: '数码', value: '数码' },
  { label: '服饰', value: '服饰' },
  { label: '家居', value: '家居' },
  { label: '食品', value: '食品' },
]

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
      <oas-page-header data-testid="pe-page-header" title="${id ? '编辑商品' : '新建商品'}">
        <div slot="extra" class="ph-extra">
          <a class="link-btn" href="#/products" data-testid="pe-back">返回列表</a>
        </div>
      </oas-page-header>
      <oas-card>
        <oas-form id="product-form" rules='{"name":[{"required":true,"message":"请输入商品名称"}]}'>
          <div class="product-form">
            <div class="form-field">
              <label class="form-label">商品名称<span class="req">*</span></label>
              <oas-input data-testid="pf-name" name="name" placeholder="请输入名称"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">分类</label>
              <oas-select data-testid="pf-category" name="category" options='${JSON.stringify(CATEGORY_OPTIONS)}' value="数码"></oas-select>
            </div>
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">价格</label>
                <oas-input-number data-testid="pf-price" name="price" min="0.01" precision="2" placeholder="0.00"></oas-input-number>
              </div>
              <div class="form-field">
                <label class="form-label">库存</label>
                <oas-input-number data-testid="pf-stock" name="stock" min="0" placeholder="0"></oas-input-number>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">上架日期</label>
              <oas-date-picker data-testid="pf-date" placeholder="选择日期"></oas-date-picker>
            </div>
            <div class="form-field">
              <label class="form-label">封面</label>
              <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture"></oas-upload>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="pe-cancel">取消</oas-button>
                <oas-button data-testid="pe-save" type="primary">保存</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-card>
    </div>`

  const form = el.querySelector<HTMLElement>('#product-form')!
  const datePicker = el.querySelector<HTMLElement>('[data-testid="pf-date"]')!
  const upload = el.querySelector<HTMLElement>('[data-testid="pf-cover"]')!

  function fillForm(row: ProductRow): void {
    el.querySelector<HTMLElement>('[data-testid="pf-name"]')!.setAttribute('value', row.name)
    el.querySelector<HTMLElement>('[data-testid="pf-category"]')!.setAttribute(
      'value',
      row.category,
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
    if (id && Number.isFinite(id)) {
      editing = await getProduct(id)
      if (editing) fillForm(editing)
      else message.error('该商品不存在')
    } else {
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
        values: { name: string; category: ProductCategory; price: string; stock: string }
      }>
    ).detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      message.error('价格需大于 0')
      return
    }
    saving = true
    try {
      const payload = {
        name: values.name,
        category: values.category || '数码',
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? 'on',
        created: datePicker.getAttribute('value') || today(),
      }
      if (editing) {
        const updated = await updateProduct(editing.id, payload)
        if (!updated) message.error('该商品已不存在')
        else message.success('已保存')
      } else {
        await createProduct(payload)
        message.success('已创建')
      }
      location.hash = '/products'
    } finally {
      saving = false
    }
  })

  void init()
  return () => {}
}
