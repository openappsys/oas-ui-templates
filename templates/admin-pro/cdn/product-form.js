/**
 * 商品表单共享件（新建/编辑共用的表单模板与填充逻辑）
 * 自 vanilla products.ts FORM_BODY / product-edit.ts fillForm 去 TS 移植
 */
import { t } from './i18n.js'

const FORM_MODE_KEY = 'oas-admin-cdn.form-mode'
export const PRODUCT_LABEL_KEYS = [
  'products.form.name',
  'products.category',
  'products.th.price',
  'products.th.stock',
  'products.form.listedDate',
  'products.form.cover',
]

/** 表单呈现方式：跟随设置中心（Task 5 落地）；未设置时默认对话框 */
export function readFormMode() {
  const v = localStorage.getItem(FORM_MODE_KEY)
  return v === 'drawer' || v === 'page' ? v : 'dialog'
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 商品列表表单体（dialog/drawer 容器内共用；操作按钮 testid 与 vanilla pf-* 对齐）
 * @param {string} formId oas-form 的 id（requestSubmit 定位用）
 */
export function productFormBody(formId) {
  return `
    <oas-form id="${formId}" rules='${JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })}'>
      <div class="product-form">
        <div class="form-field">
          <label class="form-label" for="pf-name">${t('products.form.name')}</label>
          <oas-input id="pf-name" data-testid="pf-name" name="name" placeholder="${t('products.form.namePlaceholder')}"></oas-input>
        </div>
        <div class="form-field">
          <label class="form-label" for="pf-category">${t('products.category')}</label>
          <oas-select id="pf-category" data-testid="pf-category" name="category"></oas-select>
        </div>
        <div class="form-field">
          <label class="form-label" for="pf-price">${t('products.th.price')}</label>
          <oas-input-number id="pf-price" data-testid="pf-price" name="price" min="0.01" precision="2" placeholder="0.00"></oas-input-number>
        </div>
        <div class="form-field">
          <label class="form-label" for="pf-stock">${t('products.th.stock')}</label>
          <oas-input-number id="pf-stock" data-testid="pf-stock" name="stock" min="0" placeholder="0"></oas-input-number>
        </div>
        <div class="form-field">
          <label class="form-label" for="pf-date">${t('products.form.listedDate')}</label>
          <oas-date-picker id="pf-date" data-testid="pf-date" placeholder="${t('products.form.datePlaceholder')}"></oas-date-picker>
        </div>
        <div class="form-field">
          <label class="form-label" for="pf-cover">${t('products.form.cover')}</label>
          <oas-upload id="pf-cover" data-testid="pf-cover" accept="image/*" list-type="picture"></oas-upload>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="pf-cancel">${t('common.cancel')}</oas-button>
            <oas-button data-testid="pf-save" type="primary">${t('common.save')}</oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>`
}

/**
 * 回填表单（value 走 setAttribute 通道，与 vanilla 同步）
 * @param {HTMLElement} scope 表单容器（页面根或弹窗/抽屉）
 * @param {import('./data/products.js').ProductRow | null} row
 * @param {Array<{ label: string, value: string }>} categoryOptions
 */
export function fillProductForm(scope, row, categoryOptions) {
  const resolveCategory = () =>
    row && categoryOptions.some((c) => c.value === row.category)
      ? row.category
      : (categoryOptions[0]?.value ?? '')
  scope.querySelector('[data-testid="pf-name"]').setAttribute('value', row?.name ?? '')
  scope.querySelector('[data-testid="pf-category"]').setAttribute('value', resolveCategory())
  scope
    .querySelector('[data-testid="pf-price"]')
    .setAttribute('value', row ? String(row.price) : '')
  scope
    .querySelector('[data-testid="pf-stock"]')
    .setAttribute('value', row ? String(row.stock) : '')
  scope.querySelector('[data-testid="pf-date"]')?.setAttribute('value', row?.created ?? today())
  const upload = scope.querySelector('[data-testid="pf-cover"]')
  if (upload) upload.files = []
}
