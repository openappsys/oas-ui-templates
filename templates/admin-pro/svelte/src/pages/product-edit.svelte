<script lang="ts">
  // src/pages/product-edit.svelte —— 商品编辑页（page 表单模式：oas-page-header + 表单）
  // 1. 编辑 id 从 sessionStorage 键 product-edit-id 读取（openForm page 分支写入，逐字一致）；
  //    分类/商品详情挂载后异步拉取，数据就绪边沿 $effect 命令式回填（字段非受控，
  //    与 vanilla 异步加载完成后的 setAttribute 同时机）：新建=分类就绪即填；
  //    编辑=分类与商品详情都就绪再填；编辑 id 查无商品时提示一次
  // 2. 事件绑定：pe-save/pe-cancel 按钮在 light DOM（非 drawer/modal panel），原生 click
  //    模板直绑 onclick；oas-submit 自定义事件 onoas-submit 直绑
  // 3. 返回列表：<a class="link-btn"> + onclick preventDefault 后走编程式导航（hash/history
  //    两模式均正确；href 保留可右键新开）
  import '../styles/pages/products.css'
  import { navigate } from '../router'
  import { listCategories } from '../data/categories'
  import type { CategoryRow } from '../data/categories'
  import { createProduct, getProduct, updateProduct } from '../data/products'
  import type { ProductRow } from '../data/products'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'

  function today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const rawId = sessionStorage.getItem('product-edit-id')
  const id: number | null = rawId ? Number(rawId) : null

  let catOptions = $state<Array<{ label: string; value: string }>>([])
  let editing = $state<ProductRow | null>(null)
  let saving = $state(false)
  /** 商品详情是否已返回（新建模式立即就绪）；未返回前不回填、不误报 notFound */
  let productLoaded = $state(false)
  /** 编辑态查无商品的提示只发一次 */
  let notFoundNotified = false

  let formEl = $state<HTMLElement | null>(null)
  let nameEl = $state<HTMLElement | null>(null)
  let catEl = $state<HTMLElement | null>(null)
  let priceEl = $state<HTMLElement | null>(null)
  let stockEl = $state<HTMLElement | null>(null)
  let dateEl = $state<HTMLElement | null>(null)

  // 挂载拉取：分类必取；编辑态再取商品详情（vanilla init 同款两段）
  $effect(() => {
    void (async () => {
      const cats: CategoryRow[] = await listCategories()
      catOptions = cats.map((c) => ({ label: c.name, value: c.name }))
      if (id != null && Number.isFinite(id)) {
        editing = await getProduct(id)
      }
      productLoaded = true
    })()
  })

  // 数据就绪边沿回填：新建=分类就绪即填；编辑=分类与商品详情都就绪再填
  $effect(() => {
    if (!productLoaded || catOptions.length === 0) return
    if (id != null && editing === null && !notFoundNotified) {
      notFoundNotified = true
      appMessage.error(t('products.notFound'))
    }
    const row = editing
    const fallbackCat =
      row && catOptions.some((c) => c.value === row.category)
        ? row.category
        : (catOptions[0]?.value ?? '')
    nameEl?.setAttribute('value', row?.name ?? '')
    catEl?.setAttribute('value', fallbackCat)
    priceEl?.setAttribute('value', row ? String(row.price) : '')
    stockEl?.setAttribute('value', row ? String(row.stock) : '')
    dateEl?.setAttribute('value', row?.created ?? today())
  })

  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  function onBack(): void {
    navigate('/products')
  }

  interface FormValues {
    name: string
    category: string
    price: string
    stock: string
  }

  async function onSubmit(e: Event): Promise<void> {
    if (saving) return
    const values = (e as CustomEvent<{ values: FormValues }>).detail.values
    const price = Number(values.price)
    if (!(price > 0)) {
      appMessage.error(t('products.priceError'))
      return
    }
    saving = true
    try {
      const payload = {
        name: values.name,
        category: values.category || catOptions[0]?.value || '',
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? ('on' as const),
        created: dateEl?.getAttribute('value') || today(),
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
      saving = false
    }
  }

  const title = $derived.by(() => {
    void $locale
    return id
      ? t('products.editItem').replace('#{id}', String(id))
      : t('products.newProduct')
  })
  const rules = $derived.by(() => {
    void $locale
    return JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })
  })
  const catOptionsJson = $derived(JSON.stringify(catOptions))
</script>

<div class="page product-edit-page">
  <oas-page-header data-testid="pe-page-header" title={title}>
    <div slot="extra" class="ph-extra">
      <a
        class="link-btn"
        data-testid="pe-back"
        href="#/products"
        onclick={(e) => {
          e.preventDefault()
          onBack()
        }}
      >
        {tt('orderDetail.backList')}
      </a>
    </div>
  </oas-page-header>
  <oas-card>
    <oas-form bind:this={formEl} id="product-form" rules={rules} onoas-submit={(e) => void onSubmit(e)}>
      <div class="product-form">
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">
            {tt('products.form.name')}
            <span class="req">*</span>
          </label>
          <oas-input
            bind:this={nameEl}
            data-testid="pf-name"
            name="name"
            placeholder={tt('products.form.namePlaceholder')}
          ></oas-input>
        </div>
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">{tt('products.category')}</label>
          <oas-select
            bind:this={catEl}
            data-testid="pf-category"
            name="category"
            options={catOptionsJson}
          ></oas-select>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-label">{tt('products.th.price')}</label>
            <oas-input-number
              bind:this={priceEl}
              data-testid="pf-price"
              name="price"
              min="0.01"
              precision="2"
              placeholder="0.00"
            ></oas-input-number>
          </div>
          <div class="form-field">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-label">{tt('products.th.stock')}</label>
            <oas-input-number
              bind:this={stockEl}
              data-testid="pf-stock"
              name="stock"
              min="0"
              placeholder="0"
            ></oas-input-number>
          </div>
        </div>
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">{tt('products.form.listedDate')}</label>
          <oas-date-picker
            bind:this={dateEl}
            data-testid="pf-date"
            placeholder={tt('products.form.datePlaceholder')}
          ></oas-date-picker>
        </div>
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">{tt('products.form.cover')}</label>
          <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture"></oas-upload>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <oas-button data-testid="pe-cancel" onclick={onBack}>{tt('common.cancel')}</oas-button>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <oas-button data-testid="pe-save" type="primary" onclick={onSave}>
              {tt('common.save')}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-card>
</div>
