import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { listCategories } from './data/categories.js'
import { createProduct, getProduct, updateProduct } from './data/products.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}

if (guard()) {
  document.title = `${t('nav.products')} · ${t('app.title')}`
  applyStaticTexts()
  // 隐藏路由：侧栏高亮父级「商品管理」；面包屑 商品管理 → 编辑商品/新建商品
  initShell({ active: './products.html' })
  renderProductEdit()
}

function renderProductEdit() {
  // sessionStorage 传参：products 页「新建」不写入 / 「编辑」写入商品 id
  const rawId = sessionStorage.getItem('product-edit-id')
  const id = rawId ? Number(rawId) : null
  let editing = null
  let saving = false

  const header = document.querySelector('[data-testid="pe-page-header"]')
  const form = document.querySelector('#product-form')
  const datePicker = document.querySelector('[data-testid="pf-date"]')
  const catSel = document.querySelector('[data-testid="pf-category"]')

  // rules 是配置（且校验文案随 locale），由 JS 灌
  form.setAttribute(
    'rules',
    JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] }),
  )
  // 面包屑末项带商品 id（label 已是成文，t() 对非 key 原样返回）
  window.OASShell.setBreadcrumb([
    { label: 'nav.products', href: './products.html' },
    { label: id ? tf('products.editItem', { id }) : t('products.newProduct') },
  ])
  header.setAttribute('title', id ? tf('products.editItem', { id }) : t('products.newProduct'))

  function fillForm(row) {
    document.querySelector('[data-testid="pf-name"]').setAttribute('value', row.name)
    catSel.setAttribute(
      'value',
      categoryOptions.some((c) => c.value === row.category)
        ? row.category
        : (categoryOptions[0]?.value ?? ''),
    )
    document.querySelector('[data-testid="pf-price"]').setAttribute('value', String(row.price))
    document.querySelector('[data-testid="pf-stock"]').setAttribute('value', String(row.stock))
    datePicker.setAttribute('value', row.created)
  }

  let categoryOptions = []
  async function init() {
    const cats = await listCategories()
    categoryOptions = cats.map((c) => ({ label: c.name, value: c.name }))
    catSel.setAttribute('options', JSON.stringify(categoryOptions))
    if (id && Number.isFinite(id)) {
      editing = await getProduct(id)
      if (editing) fillForm(editing)
      else OASUI.message.error(t('products.notFound'))
    } else {
      catSel.setAttribute('value', categoryOptions[0]?.value ?? '')
      datePicker.setAttribute('value', today())
    }
  }

  document.querySelector('[data-testid="pe-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  document.querySelector('[data-testid="pe-cancel"]').addEventListener('click', () => {
    location.href = './products.html'
  })

  form.addEventListener('oas-submit', async (e) => {
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
        created: datePicker.getAttribute('value') || today(),
      }
      if (editing) {
        const updated = await updateProduct(editing.id, payload)
        if (!updated) OASUI.message.error(t('products.notFound'))
        else OASUI.message.success(t('common.saved'))
      } else {
        await createProduct(payload)
        OASUI.message.success(t('common.created'))
      }
      location.href = './products.html'
    } finally {
      saving = false
    }
  })

  void init()
}
