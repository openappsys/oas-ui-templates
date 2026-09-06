<script setup lang="ts">
// src/pages/orders-drawer.vue —— 订单详情抽屉（状态标签 + 描述列表 + 流程操作 + 完整详情链接）
// 行为事实来源：vanilla-html/src/pages/orders.ts 的 drawer 段（fillDesc/renderAction/openDrawer/
// order-detail-action click）（react 版同期并行中仍为占位，以 vanilla 为准）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla openDrawer 时逐节点 setAttribute/textContent 回填；本模版声明式——
//    字段全部由 row prop 派生，oas-descriptions 结构静态写出（节点 id 与 vanilla 逐字一致：
//    order-detail-no/order-detail-tag/order-detail-desc/order-detail-action/order-detail-note）
// 2. 流程操作：vanilla 在按钮 click 里直接 updateOrderStatus + message + refresh；本模版
//    oas-* 按钮在 drawer panel 内，Vue @click 直绑元素本身不受 stopPropagation 影响
//    （AGENTS.md 第 5 条），点击仅上抛 flow(to)，持久化/提示/刷新在父组件（user-detail.vue 先例）
// 3. visible 受控：oas-close 上抛 close 回写父组件 state（user-form.vue 同款）
// 4. 完整详情链接：vanilla 点击写 sessionStorage('order-detail-id') + href="#/order-detail"；
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

// vanilla STATUS_TAG（orders 版：purple 走 color 属性，其余走 type）
const STATUS_TAG: Record<OrderRow['status'], string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}

const statusLabel = computed(() => (props.row ? t(`orders.status.${props.row.status}`) : ''))
const tagType = computed(() => (props.row ? STATUS_TAG[props.row.status] : 'default'))
// vanilla formatMoney（orders 版：¥ 带空格、无小数位）
const amountText = computed(() =>
  props.row ? `¥ ${props.row.amount.toLocaleString('en-US')}` : '',
)
// vanilla fillDesc 的 items 标签列表
const items = computed(() => props.row?.items ?? [])
// vanilla renderAction：有流转目标显示按钮（文案为当前状态的下一步动作），否则显示终态提示
const flowLabel = computed(() => (props.row ? t(`orders.flow.${props.row.status}`) : ''))
const note = computed(() => {
  if (!props.row || props.flowTo) return ''
  return props.row.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')
})
// vanilla order-detail-link：携带当前订单号跳全量详情页
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
