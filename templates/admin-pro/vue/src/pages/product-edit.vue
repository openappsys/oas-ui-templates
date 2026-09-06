<script setup lang="ts">
// src/pages/product-edit.vue —— 商品编辑页（page 表单模式：oas-page-header + 表单）
// 行为事实来源：vanilla-html/src/pages/product-edit.ts（186 行，逐块对齐），
// react/src/pages/product-edit.tsx 为已验收参照。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla innerHTML + init() 异步回填（setAttribute 逐字段）；本模版声明式
//    结构 + onMounted 数据就绪后做同款 setAttribute 回填（表单字段非受控，value 全走
//    attribute，与 vanilla 同一通道）
// 2. 事件绑定：pe-save/pe-cancel 按钮在 light DOM（非 drawer/modal panel），原生 click
//    模板直绑 @click；oas-submit 自定义事件同样模板直绑（Vue 原生支持 kebab 事件，
//    AGENTS.md 第 1 条，无需 react 版 useOasEvent 桥接）
// 3. 返回链接：vanilla 写死 href="#/products"；本模版改用 vue-router 的 RouterLink
//    （to="/products"），hash/history 双模式均正确（react 版 Link 同款）
// 4. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换；本模版 useT() 订阅后
//    整页重渲染，title/rules/placeholder/标签随 locale 自动重算（products 同款模式）
// 5. 取消按钮：vanilla location.hash='/products'；本模版 router.push('/products')
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import '../styles/pages/products.css'
import { listCategories } from '../data/categories'
import { createProduct, getProduct, updateProduct } from '../data/products'
import type { ProductRow } from '../data/products'
import { useT } from '../composables/use-t'
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

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const router = useRouter()

// vanilla：rawId 取自 sessionStorage（products 页 openForm page 模式写入，键名逐字一致）
const id: number | null = (() => {
  const rawId = sessionStorage.getItem('product-edit-id')
  return rawId ? Number(rawId) : null
})()

const editing = ref<ProductRow | null>(null)
const catOptions = ref<Option[]>([])

const formRef = ref<HTMLElement | null>(null)
const nameRef = ref<HTMLElement | null>(null)
const catRef = ref<HTMLElement | null>(null)
const priceRef = ref<HTMLElement | null>(null)
const stockRef = ref<HTMLElement | null>(null)
const dateRef = ref<HTMLElement | null>(null)
const saving = ref(false)

// 异步拉取存活标记：卸载后丢弃迟到的 Promise 结果（dashboard.vue 同款语义）
let alive = true
onUnmounted(() => {
  alive = false
})

// vanilla init()：并发拉分类（applyOptions）+ 编辑态取行；数据就绪后边沿回填
onMounted(async () => {
  const cats = await listCategories()
  if (!alive) return
  const opts = cats.map((c) => ({ label: c.name, value: c.name }))
  catOptions.value = opts
  let row: ProductRow | null = null
  if (id && Number.isFinite(id)) {
    row = await getProduct(id)
    if (!alive) return
    if (!row) appMessage.error(tt('products.notFound'))
  }
  editing.value = row
  // vanilla fillForm / 新建默认分支（setAttribute 回填，通道一致）
  const fallbackCat =
    row && opts.some((c) => c.value === row.category) ? row.category : (opts[0]?.value ?? '')
  nameRef.value?.setAttribute('value', row?.name ?? '')
  catRef.value?.setAttribute('value', fallbackCat)
  priceRef.value?.setAttribute('value', row ? String(row.price) : '')
  stockRef.value?.setAttribute('value', row ? String(row.stock) : '')
  dateRef.value?.setAttribute('value', row?.created ?? today())
})

// vanilla pe-save click 段：触发 oas-form 内部原生 form 提交
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla oas-submit 段：价格校验 → 组装 payload → create/update → 返回列表
async function onSubmit(e: Event): Promise<void> {
  if (saving.value) return
  const values = (e as CustomEvent<{ values: FormValues }>).detail.values
  const price = Number(values.price)
  if (!(price > 0)) {
    appMessage.error(tt('products.priceError'))
    return
  }
  saving.value = true
  try {
    const payload = {
      name: values.name,
      category: values.category || catOptions.value[0]?.value || '',
      price,
      stock: Number(values.stock) || 0,
      status: editing.value?.status ?? ('on' as const),
      created: dateRef.value?.getAttribute('value') || today(),
    }
    if (editing.value) {
      const updated = await updateProduct(editing.value.id, payload)
      if (!updated) appMessage.error(tt('products.notFound'))
      else appMessage.success(tt('common.saved'))
    } else {
      await createProduct(payload)
      appMessage.success(tt('common.created'))
    }
    void router.push('/products')
  } finally {
    saving.value = false
  }
}

const title = computed(() =>
  id ? t('products.editItem').replace('#{id}', String(id)) : t('products.newProduct'),
)
const rules = computed(() =>
  JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] }),
)
const catOptionsJson = computed(() => JSON.stringify(catOptions.value))
</script>

<template>
  <div class="page product-edit-page">
    <oas-page-header data-testid="pe-page-header" :title="title">
      <div slot="extra" class="ph-extra">
        <RouterLink class="link-btn" data-testid="pe-back" to="/products">
          {{ t('orderDetail.backList') }}
        </RouterLink>
      </div>
    </oas-page-header>
    <oas-card>
      <oas-form ref="formRef" id="product-form" :rules="rules" @oas-submit="onSubmit">
        <div class="product-form">
          <div class="form-field">
            <label class="form-label">
              {{ t('products.form.name') }}
              <span class="req">*</span>
            </label>
            <oas-input
              ref="nameRef"
              data-testid="pf-name"
              name="name"
              :placeholder="t('products.form.namePlaceholder')"
            />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('products.category') }}</label>
            <oas-select
              ref="catRef"
              data-testid="pf-category"
              name="category"
              :options="catOptionsJson"
            />
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">{{ t('products.th.price') }}</label>
              <oas-input-number
                ref="priceRef"
                data-testid="pf-price"
                name="price"
                min="0.01"
                precision="2"
                placeholder="0.00"
              />
            </div>
            <div class="form-field">
              <label class="form-label">{{ t('products.th.stock') }}</label>
              <oas-input-number
                ref="stockRef"
                data-testid="pf-stock"
                name="stock"
                min="0"
                placeholder="0"
              />
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('products.form.listedDate') }}</label>
            <oas-date-picker
              ref="dateRef"
              data-testid="pf-date"
              :placeholder="t('products.form.datePlaceholder')"
            />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('products.form.cover') }}</label>
            <oas-upload data-testid="pf-cover" accept="image/*" list-type="picture" />
          </div>
          <div class="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="pe-cancel" @click="void router.push('/products')">
                {{ t('common.cancel') }}
              </oas-button>
              <oas-button data-testid="pe-save" type="primary" @click="onSave">
                {{ t('common.save') }}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-form>
    </oas-card>
  </div>
</template>
