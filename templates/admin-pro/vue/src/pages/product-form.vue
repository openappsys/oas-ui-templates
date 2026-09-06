<script setup lang="ts">
// src/pages/product-form.vue —— 商品表单（dialog/drawer 双形态，page 形态见 product-edit.vue）
// 行为事实来源：vanilla-html/src/pages/products.ts 的 FORM_BODY/fillForm/openForm/oas-submit 段，
// react/src/pages/product-form.tsx 为已验收参照。
// 偏差记录（因果链）：
// 1. 回填：vanilla openForm 时 fillForm 逐字段 setAttribute；本模版在 open 边沿的 watch
//    （flush: 'post'，等 DOM 就位）里做同样的事（表单字段非受控，value 全走 attribute，
//    与 vanilla 同一通道）
// 2. 取消/保存按钮：位于 oas-modal/oas-drawer 的 panel 内，vanilla/react 因 panel 对原生
//    click stopPropagation 需直绑 addEventListener；Vue 的 @click 直绑元素本身不走根委托，
//    不受 panel 拦截影响（AGENTS.md 第 5 条），故与 light DOM 按钮一样模板直绑
// 3. visible 受控：vanilla 靠组件自闭（遮罩/Esc 时组件自摘 visible 属性）；本模版 visible 由
//    父组件 state 单一持有，必须监听 oas-close 回写，否则组件自闭后与 state 失同步
// 4. 分类选项：vanilla applyCategoryOptions 里 setAttribute('options')；本模版 options 走
//    声明式 JSON attribute 随 categories prop 重算，回填仅写 value attribute
// 5. 表单体复用：react 版共享 body JSX；Vue SFC 模板无法跨分支共享片段，dialog/drawer
//    两分支各写一份（login.vue 同款先例，结构/类名逐行一致，改动需两处同步）
import { computed, ref, watch } from 'vue'
import type { ProductRow } from '../data/products'
import { createProduct, updateProduct } from '../data/products'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

export type ProductFormMode = 'dialog' | 'drawer'

export interface Option {
  label: string
  value: string
}

interface FormValues {
  name: string
  category: string
  price: string
  stock: string
}

const props = defineProps<{
  mode: ProductFormMode
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义（行被删仍可按 id 提交） */
  editingId: number | null
  editing: ProductRow | null
  categories: Option[]
}>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const formRef = ref<HTMLElement | null>(null)
const nameRef = ref<HTMLElement | null>(null)
const catRef = ref<HTMLElement | null>(null)
const priceRef = ref<HTMLElement | null>(null)
const stockRef = ref<HTMLElement | null>(null)
const dateRef = ref<HTMLElement | null>(null)
const uploadRef = ref<HTMLElement | null>(null)
const saving = ref(false)

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// vanilla resolveCategory：非法/空值回落第一个分类
function resolveCategory(value?: string): string {
  if (value && props.categories.some((c) => c.value === value)) return value
  return props.categories[0]?.value ?? ''
}

// vanilla fillForm：open 边沿回填（编辑值/新建默认），upload 清空
watch(
  () => [props.open, props.editing, props.categories],
  () => {
    if (!props.open) return
    nameRef.value?.setAttribute('value', props.editing?.name ?? '')
    catRef.value?.setAttribute('value', resolveCategory(props.editing?.category))
    priceRef.value?.setAttribute('value', props.editing ? String(props.editing.price) : '')
    stockRef.value?.setAttribute('value', props.editing ? String(props.editing.stock) : '')
    dateRef.value?.setAttribute('value', props.editing?.created ?? today())
    if (uploadRef.value) (uploadRef.value as unknown as { files: unknown[] }).files = []
  },
  { flush: 'post' },
)

// 保存=触发 oas-form 内部原生 form 提交（跨 shadow，playground 实测模式）
function onSave(): void {
  const form = formRef.value?.shadowRoot?.querySelector('form') as HTMLFormElement | null
  form?.requestSubmit()
}

// vanilla oas-submit 段：价格校验 → 组装 payload → create/update → 关闭 + 刷新
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
      category: values.category || resolveCategory(),
      price,
      stock: Number(values.stock) || 0,
      status: props.editing?.status ?? ('on' as const),
      created: dateRef.value?.getAttribute('value') || today(),
    }
    if (props.editingId == null) {
      await createProduct(payload)
      appMessage.success(tt('common.created'))
    } else {
      await updateProduct(props.editingId, payload)
      appMessage.success(tt('common.saved'))
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}

const title = computed(() =>
  props.editingId == null
    ? t('products.newProduct')
    : t('products.editItem').replace('#{id}', String(props.editingId)),
)
const rules = computed(() =>
  JSON.stringify({ name: [{ required: true, message: t('products.rule.name') }] }),
)
const catOptions = computed(() => JSON.stringify(props.categories))
</script>

<template>
  <!-- vanilla surfaceMarkup：dialog=oas-modal 内嵌 h2#form-title；drawer=oas-drawer title 属性；
       visible 布尔存在性语义（AGENTS.md 第 2 条） -->
  <oas-modal
    v-if="mode === 'dialog'"
    data-testid="product-dialog"
    id="product-surface"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="modal-body">
      <h2 id="form-title">{{ title }}</h2>
      <oas-form ref="formRef" id="product-form" :rules="rules" @oas-submit="onSubmit">
        <div class="product-form">
          <div class="form-field">
            <label class="form-label">{{ t('products.form.name') }}</label>
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
              :options="catOptions"
            />
          </div>
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
            <oas-upload ref="uploadRef" data-testid="pf-cover" accept="image/*" list-type="picture" />
          </div>
          <div class="form-actions">
            <oas-space justify="end">
              <oas-button data-testid="pf-cancel" @click="emit('close')">
                {{ t('common.cancel') }}
              </oas-button>
              <oas-button data-testid="pf-save" type="primary" @click="onSave">
                {{ t('common.save') }}
              </oas-button>
            </oas-space>
          </div>
        </div>
      </oas-form>
    </div>
  </oas-modal>
  <!-- drawer 分支：表单体与 dialog 分支逐行一致（见头注释第 5 条） -->
  <oas-drawer
    v-else
    data-testid="product-drawer"
    id="product-surface"
    :title="title"
    placement="right"
    size="medium"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <oas-form ref="formRef" id="product-form" :rules="rules" @oas-submit="onSubmit">
      <div class="product-form">
        <div class="form-field">
          <label class="form-label">{{ t('products.form.name') }}</label>
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
            :options="catOptions"
          />
        </div>
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
          <oas-upload ref="uploadRef" data-testid="pf-cover" accept="image/*" list-type="picture" />
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="pf-cancel" @click="emit('close')">
              {{ t('common.cancel') }}
            </oas-button>
            <oas-button data-testid="pf-save" type="primary" @click="onSave">
              {{ t('common.save') }}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-drawer>
</template>
