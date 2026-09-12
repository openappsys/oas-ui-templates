<script lang="ts">
  // src/pages/products/product-form.svelte —— 商品表单（dialog/drawer 双形态，page 形态见 product-edit）
  // 1. visible 受控：由父组件 state 单一持有；组件侧关闭（遮罩/Esc/✕）不回写 attribute，
  //    监听 onoas-close 回写父级 state（visible 单一事实来源）
  // 2. 取消/保存按钮位于 oas-modal/oas-drawer 的 panel 内，panel 对原生 click stopPropagation；
  //    但 Svelte 的 onclick 直绑元素本身（不走根委托），不受该陷阱影响，直接模板直绑
  // 3. 字段非受控：打开/编辑行变化时 $effect 命令式回填 value attribute（对齐 vanilla fillForm）；
  //    rules/options 声明式 JSON attribute 随 categories/locale 重算
  // 4. dialog/drawer 共用同一表单体（snippet 复用，容器分支只包一层）
  import type { ProductRow } from '../../data/products'
  import { createProduct, updateProduct } from '../../data/products'
  import { appMessage } from '../../lib/app-message'
  import { useT } from '../../lib/use-t.svelte'

  export type ProductFormMode = 'dialog' | 'drawer'

  export interface Option {
    label: string
    value: string
  }

  interface Props {
    mode: ProductFormMode
    open: boolean
    /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义（行被删仍可按 id 提交） */
    editingId: number | null
    editing: ProductRow | null
    categories: Option[]
    onClose: () => void
    onSaved: () => void
  }

  let { mode, open, editingId, editing, categories, onClose, onSaved }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  function today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  let formEl = $state<HTMLElement | null>(null)
  let nameEl = $state<HTMLElement | null>(null)
  let catEl = $state<HTMLElement | null>(null)
  let priceEl = $state<HTMLElement | null>(null)
  let stockEl = $state<HTMLElement | null>(null)
  let dateEl = $state<HTMLElement | null>(null)
  let uploadEl = $state<HTMLElement | null>(null)
  let saving = $state(false)

  function resolveCategory(value?: string): string {
    if (value && categories.some((c) => c.value === value)) return value
    return categories[0]?.value ?? ''
  }

  // 打开/编辑行/分类变化时回填（字段非受控，与 vanilla fillForm 同时机）；依赖 categories
  // 变化后再填分类，保证 options 与 value 同步
  $effect(() => {
    if (!open) return
    void categories
    nameEl?.setAttribute('value', editing?.name ?? '')
    catEl?.setAttribute('value', resolveCategory(editing?.category))
    priceEl?.setAttribute('value', editing ? String(editing.price) : '')
    stockEl?.setAttribute('value', editing ? String(editing.stock) : '')
    dateEl?.setAttribute('value', editing?.created ?? today())
    if (uploadEl) (uploadEl as unknown as { files: unknown[] }).files = []
  })

  function onCancel(): void {
    onClose()
  }

  // 保存：触发 oas-form 内部原生 form 提交（组件转抛 oas-submit）
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
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
        category: values.category || resolveCategory(),
        price,
        stock: Number(values.stock) || 0,
        status: editing?.status ?? ('on' as const),
        created: dateEl?.getAttribute('value') || today(),
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
      saving = false
    }
  }

  const title = $derived.by(() => {
    void $locale
    return editingId == null
      ? t('products.newProduct')
      : t('products.editItem').replace('#{id}', String(editingId))
  })
  const rules = $derived.by(() => {
    void $locale
    return JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] })
  })
  const catOptions = $derived(JSON.stringify(categories))
</script>

{#snippet formBody()}
  <oas-form bind:this={formEl} id="product-form" rules={rules} onoas-submit={(e) => void onSubmit(e)}>
    <div class="product-form">
      <div class="form-field">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="form-label">{tt('products.form.name')}</label>
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
          options={catOptions}
        ></oas-select>
      </div>
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
        <oas-upload
          bind:this={uploadEl}
          data-testid="pf-cover"
          accept="image/*"
          list-type="picture"
        ></oas-upload>
      </div>
      <div class="form-actions">
        <oas-space justify="end">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <oas-button data-testid="pf-cancel" onclick={onCancel}>{tt('common.cancel')}</oas-button>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <oas-button data-testid="pf-save" type="primary" onclick={onSave}>
            {tt('common.save')}
          </oas-button>
        </oas-space>
      </div>
    </div>
  </oas-form>
{/snippet}

{#if mode === 'dialog'}
  <oas-modal
    data-testid="product-dialog"
    id="product-surface"
    no-footer
    visible={open ? '' : null}
    onoas-close={() => onClose()}
  >
    <div class="modal-body">
      <h2 id="form-title">{title}</h2>
      {@render formBody()}
    </div>
  </oas-modal>
{:else}
  <oas-drawer
    data-testid="product-drawer"
    id="product-surface"
    title={title}
    placement="right"
    size="medium"
    no-footer
    visible={open ? '' : null}
    onoas-close={() => onClose()}
  >
    {@render formBody()}
  </oas-drawer>
{/if}
