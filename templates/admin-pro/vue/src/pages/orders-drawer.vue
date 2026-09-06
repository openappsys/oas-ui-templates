<script setup lang="ts">
// src/pages/orders-drawer.vue —— 订单详情抽屉（状态标签 + 描述列表 + 流程操作 + 完整详情链接）
// order-detail-action click）
//    order-detail-no/order-detail-tag/order-detail-desc/order-detail-action/order-detail-note）
//    oas-* 按钮在 drawer panel 内，Vue @click 直绑元素本身不受 stopPropagation 影响
//    点击仅上抛 flow(to)，持久化/提示/刷新在父组件（user-detail.vue 先例）
// 3. visible 受控：oas-close 上抛 close 回写父组件 state（user-form.vue 同款）
//    本模版改用 RouterLink 携带 query（/order-detail?id=…），order-detail 页从 route.query.id
//    取值——可观察行为一致（目标页拿到同一订单号），且刷新后可恢复
import { computed } from 'vue'
import type { OrderRow, OrderStatus } from '../data/orders'
import { useT } from '../composables/use-t'

const props = defineProps<{
  open: boolean
  /** 当前抽屉行（父组件从列表数据派生，流程操作成功后随刷新自动更新） */
  row: OrderRow | null
  /** 流转目标（null = 无可用操作，显示提示语） */
  flowTo: OrderStatus | null
  /** 父组件执行流转期间置真：按钮 loading 态（vanilla setAttribute('loading') 同款） */
  flowing: boolean
}>()
const emit = defineEmits<{
  close: []
  flow: [to: OrderStatus]
}>()

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const STATUS_TAG: Record<OrderRow['status'], string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

const statusLabel = computed(() => (props.row ? t(`orders.status.${props.row.status}`) : ''))
const tagType = computed(() => (props.row ? STATUS_TAG[props.row.status] : 'default'))
const amountText = computed(() =>
  props.row ? `¥ ${props.row.amount.toLocaleString('en-US')}` : '',
)
const items = computed(() => props.row?.items ?? [])
const flowLabel = computed(() => (props.row ? t(`orders.flow.${props.row.status}`) : ''))
const note = computed(() => {
  if (!props.row || props.flowTo) return ''
  return props.row.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')
})
const detailTo = computed(() => ({
  path: '/order-detail',
  query: props.row?.id ? { id: props.row.id } : {},
}))
</script>

<template>
  <oas-drawer
    data-testid="order-drawer"
    :title="t('orders.detailTitle')"
    placement="right"
    size="medium"
    no-footer
    :visible="open ? '' : null"
    @oas-close="emit('close')"
  >
    <div class="order-detail">
      <div class="order-detail-head">
        <div>
          <div class="order-detail-no mono">{{ row?.id ?? '' }}</div>
          <div class="order-detail-sub">{{ t('orders.detailTitle') }}</div>
        </div>
        <oas-tag
          data-testid="order-detail-tag"
          :type="tagType === 'purple' ? null : tagType"
          :color="tagType === 'purple' ? 'purple' : null"
        >
          {{ statusLabel }}
        </oas-tag>
      </div>
      <oas-descriptions id="order-detail-desc" column="1">
        <oas-descriptions-item :label="t('orders.th.customer')">
          <span>{{ row?.customer ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('orders.dl.creator')">
          <span>{{ row?.creator ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('orders.th.amount')">
          <span class="mono">{{ amountText }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('orders.th.created')">
          <span class="mono">{{ row?.created ?? '' }}</span>
        </oas-descriptions-item>
        <oas-descriptions-item :label="t('orders.dl.items')">
          <span>
            <oas-tag v-for="it in items" :key="it">{{ it }}</oas-tag>
          </span>
        </oas-descriptions-item>
      </oas-descriptions>
      <div class="order-detail-foot">
        <div class="order-detail-foot-row">
          <oas-button
            v-if="flowTo"
            data-testid="order-detail-action"
            type="primary"
            :loading="flowing ? '' : null"
            @click="emit('flow', flowTo)"
          >
            {{ flowLabel }}
          </oas-button>
          <RouterLink class="link-btn" data-testid="order-detail-link" :to="detailTo">
            {{ t('orders.fullDetail') }}
          </RouterLink>
        </div>
        <div v-if="!flowTo" class="order-detail-note" data-testid="order-detail-note">
          {{ note }}
        </div>
      </div>
    </div>
  </oas-drawer>
</template>

<style scoped>
/* 订单抽屉样式（自 app.css 迁入）；.order-detail-foot/.order-detail-note 与订单详情页共用留全局 */
.order-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--oas-space-3);
  margin-bottom: var(--oas-space-4);
}
.order-detail-no {
  font-size: 20px;
  font-weight: 700;
  color: var(--oas-color-text-primary);
  line-height: 1.3;
}
.order-detail-sub {
  font-size: var(--oas-font-size-xs);
  color: var(--oas-color-text-secondary);
  margin-top: 2px;
}

.order-detail-foot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oas-space-3);
}
</style>
