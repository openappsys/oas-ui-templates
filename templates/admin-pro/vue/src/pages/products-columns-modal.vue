<script setup lang="ts">
// src/pages/products-columns-modal.vue —— 商品列设置弹窗（显隐列 + 偏好持久化）
// 重置按钮 / 完成按钮 / writeProductColumns 持久化），react/src/pages/products-columns-modal.tsx
//    父组件 state 单一持有，必须监听 oas-close 回写，否则组件自闭后与 state 失同步
//    stopPropagation 需直绑 addEventListener；Vue 的 @click 直绑元素本身不走根委托，
//    不受影响checkbox 的 oas-change / 弹窗的 oas-close 自定义事件
//    同样模板直绑（第 1 条）
//    change 事件回写父组件 state 驱动表格 column-keys 重算
// 4. checked/disabled 布尔存在性语义
import { useT } from '../composables/use-t'
import {
  PRODUCT_COLUMN_KEYS,
  PRODUCT_COLUMN_MANDATORY,
  writeProductColumns,
} from './product-columns'
import type { ProductColumnKey } from './product-columns'

const props = defineProps<{
  open: boolean
  columnKeys: ProductColumnKey[]
}>()
const emit = defineEmits<{
  /** 勾选/重置后的新列集合（本组件已先行持久化，父组件只负责更新 state） */
  change: [keys: ProductColumnKey[]]
  close: []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

function columnTitle(key: ProductColumnKey): string {
  return key === 'category' ? t('products.category') : t(`products.th.${key}`)
}

function isMandatory(key: ProductColumnKey): boolean {
  return PRODUCT_COLUMN_MANDATORY.includes(key)
}

function onCheckChange(e: Event): void {
  const detail = (e as CustomEvent<{ checked: boolean; value: string }>).detail
  if (!detail) return
  const key = detail.value as ProductColumnKey
  if (!PRODUCT_COLUMN_KEYS.includes(key) || PRODUCT_COLUMN_MANDATORY.includes(key)) return
  const next = detail.checked
    ? props.columnKeys.includes(key)
      ? props.columnKeys
      : [...props.columnKeys, key]
    : props.columnKeys.filter((k) => k !== key)
  writeProductColumns(next)
  emit('change', next)
}

function onReset(): void {
  const next = [...PRODUCT_COLUMN_KEYS]
  writeProductColumns(next)
  emit('change', next)
}
</script>

<template>
  <oas-modal
    data-testid="product-columns-modal"
    id="product-columns-modal"
    :title="t('products.columns.title')"
    no-footer
    :visible="open ? '' : null"
    @oas-change="onCheckChange"
    @oas-close="emit('close')"
  >
    <div class="product-columns-list" data-testid="product-columns-list">
      <label v-for="key in PRODUCT_COLUMN_KEYS" :key="key" class="product-column-check">
        <oas-checkbox
          :data-testid="`product-columns-${key}`"
          :value="key"
          :checked="isMandatory(key) || columnKeys.includes(key) ? '' : null"
          :disabled="isMandatory(key) ? '' : null"
        >
          {{ columnTitle(key) }}
        </oas-checkbox>
      </label>
    </div>
    <div class="form-actions">
      <oas-space justify="end">
        <oas-button data-testid="product-columns-reset" @click="onReset">
          {{ t('products.columns.reset') }}
        </oas-button>
        <oas-button data-testid="product-columns-close" type="primary" @click="emit('close')">
          {{ t('common.save') }}
        </oas-button>
      </oas-space>
    </div>
  </oas-modal>
</template>
