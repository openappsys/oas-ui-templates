<script setup lang="ts">
// src/pages/products-batch-bar.vue —— 商品批量操作栏（表格多选后出现：批量上下架 + 批量删除）
// 1. 执行逻辑（toggleProductStatus/removeProduct 循环、clearSelection、appMessage、refresh）
//    留在父组件——它们依赖 rows/selected/refresh；本组件只负责呈现与事件上抛
// 2. 事件绑定：上下架按钮原生 click 模板直绑 @click；oas-popconfirm 的 oas-ok 自定义事件
//    同样模板直绑（Vue 原生支持 kebab 事件，无需 react 版 useOasEvent）
// 4. disabled 布尔存在性语义：:disabled="enabled ? null : ''"
import { computed } from 'vue'
import { useT } from '../composables/use-t'

const props = defineProps<{
  /** 卡片视图或无选中项时隐藏 */
  hidden: boolean
  selectedCount: number
  canMutate: boolean
}>()
const emit = defineEmits<{
  'batch-status': [target: 'on' | 'off']
  /** popconfirm 确认删除后上抛（父组件执行删除循环 + 提示 + 刷新） */
  'batch-delete': []
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const enabled = computed(() => props.canMutate && props.selectedCount > 0)
const delTitle = computed(() => t('products.batch.confirmDelete', { count: props.selectedCount }))
</script>

<template>
  <div class="product-batch-bar" data-testid="product-batch-bar" :hidden="hidden">
    <span class="product-batch-count" data-testid="product-batch-count">
      {{ selectedCount > 0 ? t('products.batch.selected', { count: selectedCount }) : '' }}
    </span>
    <oas-space class="product-batch-actions" justify="end">
      <oas-button
        data-testid="product-batch-unlist"
        size="small"
        :disabled="enabled ? null : ''"
        @click="emit('batch-status', 'off')"
      >
        {{ t('products.batch.unlist') }}
      </oas-button>
      <oas-button
        data-testid="product-batch-list"
        size="small"
        :disabled="enabled ? null : ''"
        @click="emit('batch-status', 'on')"
      >
        {{ t('products.batch.list') }}
      </oas-button>
      <oas-popconfirm
        data-testid="product-batch-del-pop"
        id="product-batch-del-pop"
        :title="delTitle"
        @oas-ok="emit('batch-delete')"
      >
        <oas-button
          data-testid="product-batch-delete"
          size="small"
          type="danger"
          :disabled="enabled ? null : ''"
        >
          {{ t('products.batch.delete') }}
        </oas-button>
      </oas-popconfirm>
    </oas-space>
  </div>
</template>
