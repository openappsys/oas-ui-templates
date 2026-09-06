<script setup lang="ts">
// src/pages/order-detail.vue —— 订单详情页（步骤条 + 描述列表 + 时间线 + 流程操作）
//    本模版改读 route.query.id（orders-drawer.vue 的 RouterLink 携带）——可观察行为一致
//    （目标页拿到同一订单号），且 URL 可收藏/刷新后恢复，sessionStorage 通道不再使用
//    renderAction 逐节点写）；本模版声明式——order ref 就绪后各区块由 computed 派生，
//    addEventListener 同款）；按钮 loading 态用 :loading 存在性语义对齐 setAttribute('loading')
//    product-edit.vue 先例）
//    步骤/描述/时间线/操作随 locale 自动重算（加载中/缺失态同样响应式）
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getOrder, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'

const FLOW_STEPS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done']
const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}
const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

function statusLabel(status: OrderStatus): string {
  return t(`orders.status.${status}`)
}

const route = useRoute()

const id = typeof route.query.id === 'string' ? route.query.id : ''

const order = ref<OrderRow | null>(null)
const missing = ref(false)
const flowing = ref(false)

// 异步拉取存活标记：卸载后丢弃迟到的 Promise 结果（product-edit.vue 同款语义）
let alive = true
onUnmounted(() => {
  alive = false
})

onMounted(async () => {
  const row = await getOrder(id)
  if (!alive) return
  if (!row) {
    missing.value = true
    return
  }
  order.value = row
})

function formatMoney(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

const title = computed(() => (order.value ? order.value.id : t('nav.orderDetail')))
const statusTag = computed(() => {
  if (!order.value) return { label: t('orderDetail.loading'), type: 'default' as const }
  return { label: statusLabel(order.value.status), type: STATUS_TAG[order.value.status] }
})

const steps = computed(() => FLOW_STEPS.map((s) => ({ title: statusLabel(s) })))
const stepsCurrent = computed(() => (order.value ? FLOW_STEPS.indexOf(order.value.status) : -1))
const stepsVisible = computed(
  () => !!order.value && order.value.status !== 'cancelled' && stepsCurrent.value >= 0,
)

const timeline = computed(() => {
  const o = order.value
  if (!o) return []
  const nodes: Array<{ time: string; title: string; color?: string }> = [
    { time: o.created, title: t('orderDetail.timeline.created') },
  ]
  if (o.status === 'cancelled') {
    nodes.push({ time: addDays(o.created, 1), title: statusLabel('cancelled'), color: 'red' })
    return nodes
  }
  const idx = FLOW_STEPS.indexOf(o.status)
  if (idx >= 1) nodes.push({ time: addDays(o.created, 1), title: statusLabel('paid') })
  if (idx >= 2) nodes.push({ time: addDays(o.created, 2), title: statusLabel('shipping') })
  if (idx >= 3)
    nodes.push({ time: addDays(o.created, 3), title: statusLabel('done'), color: 'green' })
  return nodes
})

const flowTo = computed(() => (order.value ? FLOW_TO[order.value.status] ?? null : null))
const note = computed(() => {
  if (!order.value || flowTo.value) return ''
  return order.value.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')
})

async function onAction(): Promise<void> {
  if (!order.value || !flowTo.value) return
  const actionLabel = t(`orders.flow.${order.value.status}`)
  flowing.value = true
  const updated = await updateOrderStatus(order.value.id, flowTo.value)
  flowing.value = false
  if (!updated) {
    appMessage.error(tt('orders.notFound'))
    return
  }
  appMessage.success(tt('orders.flowApplied', { action: actionLabel }))
  order.value = updated
}
</script>

<template>
  <div class="page order-detail-page">
    <oas-page-header data-testid="order-page-header" class="order-detail-ph" :title="title">
      <div slot="extra" class="ph-extra">
        <RouterLink class="link-btn" to="/orders" data-testid="order-back">
          {{ t('orderDetail.backList') }}
        </RouterLink>
        <oas-tag
          data-testid="order-status-tag"
          :type="statusTag.type === 'purple' ? null : statusTag.type"
          :color="statusTag.type === 'purple' ? 'purple' : null"
        >
          {{ statusTag.label }}
        </oas-tag>
      </div>
    </oas-page-header>
    <div v-if="order" id="order-detail-card">
      <oas-card>
        <oas-steps
          v-if="stepsVisible"
          class="order-steps"
          id="order-detail-steps"
          :steps="JSON.stringify(steps)"
          :current="stepsCurrent"
        />
        <oas-descriptions data-testid="order-detail-basic" id="order-detail-basic" column="2">
          <oas-descriptions-item :label="t('orders.th.customer')">
            <span>{{ order.customer }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('orders.th.amount')">
            <span class="mono">{{ formatMoney(order.amount) }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.label.phone')">
            <span class="mono">{{ order.phone ?? '-' }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('form.summary.urgent')">
            <span>{{ order.urgent ? t('form.label.urgent') : t('form.summary.normalDelivery') }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('orders.th.created')">
            <span class="mono">{{ order.created }}</span>
          </oas-descriptions-item>
          <oas-descriptions-item :label="t('orders.th.items')">
            <span>
              <oas-tag v-for="it in order.items" :key="it">{{ it }}</oas-tag>
            </span>
          </oas-descriptions-item>
        </oas-descriptions>
        <div class="order-timeline-head">{{ t('orderDetail.timelineTitle') }}</div>
        <div id="order-detail-timeline-wrap">
          <oas-timeline data-testid="order-detail-timeline">
            <oas-timeline-item
              v-for="n in timeline"
              :key="`${n.time}-${n.title}`"
              :time="n.time"
              :color="n.color ?? null"
            >
              {{ n.title }}
            </oas-timeline-item>
          </oas-timeline>
        </div>
        <div class="order-detail-foot">
          <oas-button
            v-if="flowTo"
            data-testid="order-detail-action"
            type="primary"
            :loading="flowing ? '' : null"
            @click="void onAction()"
          >
            {{ t(`orders.flow.${order.status}`) }}
          </oas-button>
          <div v-if="!flowTo" class="order-detail-note" data-testid="order-detail-note">
            {{ note }}
          </div>
        </div>
      </oas-card>
    </div>
    <div v-if="missing" id="order-detail-missing">
      <oas-empty :description="t('orderDetail.missing')" />
    </div>
  </div>
</template>

<style scoped>
/* 订单详情页样式（自 app.css 迁入）；.order-detail-foot/.order-detail-note/.ph-extra 与订单抽屉共用留全局 */
#order-detail-steps {
  margin-bottom: var(--oas-space-4);
}
.order-steps {
  --oas-control-height-sm: 24px;
  --oas-font-size-xs: 12px;
}

.order-timeline-head {
  margin-top: var(--oas-space-4);
  margin-bottom: var(--oas-space-3);
  font-weight: 600;
  color: var(--oas-color-text-primary);
}

.order-detail-ph::part(title) {
  font-family: var(--app-mono);
}
</style>
