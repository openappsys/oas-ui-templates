<script setup lang="ts">
// src/pages/form.vue —— 创建订单向导：三步表单（客户信息 → 商品明细 → 确认提交）
//    step/表单字段/商品勾选全部 ref，面板显隐/汇总/合计由 state 派生
// 2. 步骤条 current：正常流转由 :current="step" 声明式同步；点击跨越且校验失败时组件
//    e.target === 容器 守卫
//    reactive 派生 :hidden（纯 HTML 元素，属性/property 语义一致），aria-invalid 保留
//    对齐为本模版 router.push（vue-router 通道，result.vue 已就位消费 form-result）
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrder } from '../data/orders'
import { listProducts } from '../data/products'
import type { ProductRow } from '../data/products'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const router = useRouter()

const PHONE_RE = /^1\d{10}$/

function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const step = ref(0)
const customer = ref('')
const phone = ref('')
const note = ref('')
const products = ref<string[]>([])
const quantity = ref(1)
const urgent = ref(false)
const expectDate = ref('')
const confirmed = ref(false)
const productsData = ref<ProductRow[]>([])
const submitting = ref(false)

// 校验错误文案（空串=隐藏）
const errors = reactive({ customer: '', phone: '', products: '', confirm: '' })

const stepsRef = ref<HTMLElement | null>(null)
const customerRef = ref<HTMLElement | null>(null)
const phoneRef = ref<HTMLElement | null>(null)
const productsRef = ref<HTMLElement | null>(null)

const minDate = today()

const stepsJson = computed(() =>
  JSON.stringify([
    { title: t('form.step.basic') },
    { title: t('form.step.products') },
    { title: t('form.step.confirm') },
  ]),
)

async function loadProducts(): Promise<void> {
  const rows = await listProducts()
  productsData.value = rows.sort((a, b) => a.price - b.price)
}
onMounted(() => void loadProducts())

const productsJson = computed(() => JSON.stringify(products.value))

function productById(id: string): ProductRow | undefined {
  return productsData.value.find((p) => p.id === Number(id))
}

// 勾选商品（汇总/合计数据源）
const selectedProducts = computed(() =>
  products.value.map((id) => productById(id)).filter((p): p is ProductRow => !!p),
)
// 合计 = 单价和 × 数量
const total = computed(() => selectedProducts.value.reduce((sum, p) => sum + p.price, 0) * quantity.value)

function clearErrors(): void {
  errors.customer = ''
  errors.phone = ''
  errors.products = ''
  errors.confirm = ''
  customerRef.value?.removeAttribute('aria-invalid')
  phoneRef.value?.removeAttribute('aria-invalid')
  productsRef.value?.removeAttribute('aria-invalid')
}

function validateStep(n: number): boolean {
  clearErrors()
  let ok = true
  if (n === 0) {
    if (!customer.value.trim()) {
      errors.customer = t('form.rule.customer')
      customerRef.value?.setAttribute('aria-invalid', 'true')
      ok = false
    }
    if (!phone.value.trim()) {
      errors.phone = t('form.rule.phone')
      phoneRef.value?.setAttribute('aria-invalid', 'true')
      ok = false
    } else if (!PHONE_RE.test(phone.value.trim())) {
      errors.phone = t('form.rule.phoneInvalid')
      phoneRef.value?.setAttribute('aria-invalid', 'true')
      ok = false
    }
  } else if (n === 1) {
    if (products.value.length === 0) {
      errors.products = t('form.rule.productsRequired')
      productsRef.value?.setAttribute('aria-invalid', 'true')
      ok = false
    }
    if (!(quantity.value >= 1)) {
      errors.products = t('form.rule.qty')
      ok = false
    }
  }
  return ok
}

function goNext(): void {
  if (!validateStep(step.value)) return
  step.value += 1
  clearErrors()
}
function goPrev(): void {
  step.value -= 1
  clearErrors()
}

function onStepChange(e: Event): void {
  const target = (e as CustomEvent<{ index: number }>).detail.index
  if (target === step.value) return
  if (target > step.value && !validateStep(step.value)) {
    stepsRef.value?.setAttribute('current', String(step.value))
    return
  }
  step.value = target
  clearErrors()
}

async function submitOrder(): Promise<void> {
  clearErrors()
  if (!confirmed.value) {
    errors.confirm = t('form.rule.confirm')
    return
  }
  const items = selectedProducts.value
  if (items.length === 0) {
    appMessage.error(t('form.rule.productsRequired'))
    return
  }
  const amount = items.reduce((sum, p) => sum + p.price, 0) * quantity.value
  submitting.value = true
  try {
    const order = await createOrder({
      customer: customer.value.trim(),
      amount,
      status: 'pending',
      items: items.map((p) => p.name),
      urgent: urgent.value,
      phone: phone.value.trim(),
      note: note.value.trim() || undefined,
    })
    sessionStorage.setItem('form-result', JSON.stringify({ status: 'success', orderId: order.id }))
    appMessage.success(t('form.created'))
    void router.push('/result')
  } finally {
    submitting.value = false
  }
}

function onCustomerInput(e: Event): void {
  customer.value = (e as CustomEvent<{ value: string }>).detail.value
}
function onPhoneInput(e: Event): void {
  phone.value = (e as CustomEvent<{ value: string }>).detail.value
}
function onNoteInput(e: Event): void {
  note.value = (e as CustomEvent<{ value: string }>).detail.value
}
function onCustomerClear(): void {
  customer.value = ''
}
function onPhoneClear(): void {
  phone.value = ''
}
function onQtyChange(e: Event): void {
  quantity.value = (e as CustomEvent<{ value: number }>).detail.value
}
function onUrgentChange(e: Event): void {
  urgent.value = (e as CustomEvent<{ checked: boolean }>).detail.checked
}
function onDateChange(e: Event): void {
  expectDate.value = (e as CustomEvent<{ value: string }>).detail.value
}
function onConfirmChange(e: Event): void {
  confirmed.value = (e as CustomEvent<{ checked: boolean }>).detail.checked
}
function onProductsChange(e: Event): void {
  if (e.target !== productsRef.value) return
  products.value = (e as CustomEvent<{ value: string[] }>).detail.value
}
</script>

<template>
  <div class="page form-wizard">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.createOrder') }}</h1>
        <p class="page-subtitle">{{ t('form.subtitle') }}</p>
      </div>
    </div>
    <oas-card>
      <oas-steps
        ref="stepsRef"
        data-testid="form-steps"
        :steps="stepsJson"
        :current="step"
        clickable
        @oas-change="onStepChange"
      />
      <div class="form-step" data-testid="form-step1" :hidden="step !== 0">
        <div class="form-field">
          <label class="form-label">
            {{ t('form.label.customer') }}<span class="req">*</span>
          </label>
          <oas-input
            ref="customerRef"
            data-testid="form-customer"
            :placeholder="t('form.rule.customer')"
            clearable
            @oas-input="onCustomerInput"
            @oas-clear="onCustomerClear"
          />
          <div class="form-error" data-testid="form-error-customer" :hidden="!errors.customer">
            {{ errors.customer }}
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('form.label.phone') }}<span class="req">*</span></label>
          <oas-input
            ref="phoneRef"
            data-testid="form-phone"
            :placeholder="t('form.rule.phone')"
            clearable
            @oas-input="onPhoneInput"
            @oas-clear="onPhoneClear"
          />
          <div class="form-error" data-testid="form-error-phone" :hidden="!errors.phone">
            {{ errors.phone }}
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('form.label.note') }}</label>
          <oas-textarea
            data-testid="form-note"
            rows="3"
            :placeholder="t('form.placeholder.note')"
            @oas-input="onNoteInput"
          />
        </div>
      </div>
      <div class="form-step" data-testid="form-step2" :hidden="step !== 1">
        <div class="form-field">
          <label class="form-label">{{ t('form.label.products') }}<span class="req">*</span></label>
          <oas-checkbox-group
            ref="productsRef"
            data-testid="form-products"
            :value="productsJson"
            @oas-change="onProductsChange"
          >
            <span slot="label">{{ t('form.placeholder.products') }}</span>
            <oas-checkbox v-for="p in productsData" :key="p.id" :value="String(p.id)">
              {{ p.name }} · <span class="mono">{{ formatMoney(p.price) }}</span>
            </oas-checkbox>
          </oas-checkbox-group>
          <div class="form-error" data-testid="form-error-products" :hidden="!errors.products">
            {{ errors.products }}
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">{{ t('form.label.qty') }}</label>
            <oas-input-number
              data-testid="form-qty"
              min="1"
              precision="0"
              value="1"
              @oas-change="onQtyChange"
            />
          </div>
          <div class="form-field">
            <label class="form-label">{{ t('form.label.urgent') }}</label>
            <div class="switch-line">
              <oas-switch data-testid="form-urgent" @oas-change="onUrgentChange" />
            </div>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">{{ t('form.label.expectDate') }}</label>
          <oas-date-picker data-testid="form-date" :min="minDate" @oas-change="onDateChange" />
        </div>
      </div>
      <div class="form-step" data-testid="form-step3" :hidden="step !== 2">
        <oas-descriptions data-testid="form-summary" column="1">
          <oas-descriptions-item :label="t('form.summary.customer')">
            <span>{{ customer.trim() || '-' }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.summary.phone')">
            <span class="mono">{{ phone.trim() || '-' }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.label.note')">
            <span>{{ note.trim() || '-' }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.label.qty')">
            <span class="mono">{{ quantity }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.summary.urgent')">
            <span>{{ urgent ? t('form.label.urgent') : t('form.summary.normalDelivery') }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.label.expectDate')">
            <span class="mono">{{ expectDate || '-' }}</span>
          </oas-descriptions-item>
        </oas-descriptions>
        <div class="form-items" data-testid="form-items">
          <div v-for="p in selectedProducts" :key="p.id" class="form-item-row">
            <span class="form-item-name">{{ p.name }}</span>
            <span class="form-item-calc mono">
              {{ formatMoney(p.price) }} × {{ quantity }} = {{ formatMoney(p.price * quantity) }}
            </span>
          </div>
        </div>
      </div>
      <div class="form-foot">
        <div class="form-foot-summary" data-testid="form-foot-summary" :hidden="step !== 2">
          <div class="form-total">
            {{ t('form.total') }}<span class="num mono" data-testid="form-total">{{ formatMoney(total) }}</span>
          </div>
          <div class="form-confirm">
            <oas-checkbox data-testid="form-confirm" @oas-change="onConfirmChange">
              {{ t('form.confirm') }}
            </oas-checkbox>
            <div class="form-error" data-testid="form-error-confirm" :hidden="!errors.confirm">
              {{ errors.confirm }}
            </div>
          </div>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button v-show="step > 0" data-testid="form-prev" @click="goPrev">
              {{ t('form.prev') }}
            </oas-button>
            <oas-button v-show="step < 2" data-testid="form-next" type="primary" @click="goNext">
              {{ t('form.next') }}
            </oas-button>
            <oas-button
              v-show="step === 2"
              data-testid="form-submit"
              type="primary"
              :loading="submitting ? '' : null"
              @click="void submitOrder()"
            >
              {{ t('form.submit') }}
            </oas-button>
          </oas-space>
        </div>
      </div>
    </oas-card>
  </div>
</template>

<style scoped>
/* 分步向导样式（自 app.css 迁入）：仅本页使用；#view:has(.form-wizard) 的溢出放行在 app-shell scoped 块 */
.form-wizard oas-steps {
  margin-bottom: var(--oas-space-4);
}

.form-step {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-4);
}
.form-step[hidden],
.form-confirm[hidden] {
  display: none;
}

.form-error {
  color: var(--oas-color-danger);
  font-size: var(--oas-font-size-xs);
  margin-top: var(--oas-space-1);
}
.form-error[hidden] {
  display: none;
}

.switch-line {
  display: inline-flex;
  align-items: center;
  gap: var(--oas-space-2);
  min-height: var(--oas-control-height-md);
}

.form-total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--oas-space-3);
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-secondary);
}
.form-total .num {
  font-family: var(--app-mono);
  font-size: 28px;
  font-weight: 700;
  color: var(--oas-color-text-primary);
}

.form-items {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-2);
  margin-top: var(--oas-space-4);
}
.form-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oas-space-3);
  padding: var(--oas-space-2) var(--oas-space-3);
  background: var(--oas-color-bg-hover);
  border-radius: var(--oas-radius-md);
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
}
.form-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.form-item-calc {
  text-align: right;
  white-space: nowrap;
}

.form-confirm {
  margin-top: var(--oas-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-1);
}

.form-foot {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-3);
  margin: var(--oas-space-4) calc(-1 * var(--oas-space-4)) calc(-1 * var(--oas-space-4));
  padding: var(--oas-space-4);
  border-top: 1px solid var(--oas-color-border);
  background: var(--oas-color-bg);
}
.form-foot-summary[hidden] {
  display: none;
}
/* 覆盖全局 .form-actions（app.css）的留白与分隔线：带 data-v 的复合选择器特异性更高，行为同迁移前 */
.form-foot .form-actions {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}
</style>
