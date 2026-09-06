// src/composables/use-orders.ts —— 订单领域数据 composable
// useOrdersList：列表拉取 + viewer 只看自己（原 orders.vue refresh 逻辑，会话走 Pinia store）；
// useOrderFlow：状态流转动作（提示与刷新语义原样保留）
import { ref } from 'vue'
import type { Ref } from 'vue'
import { useT } from './use-t'
import { listOrders, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'
import { useSessionStore } from '../stores/session'
import { appMessage } from '../lib/app-message'

export function useOrdersList() {
  const rows = ref<OrderRow[]>([])
  const loading = ref(false)
  /** viewer 视角提示条显隐（只看自己创建的订单） */
  const scopeVisible = ref(false)
  const auth = useSessionStore()

  async function refresh(): Promise<void> {
    loading.value = true
    let list = await listOrders()
    const u = auth.user
    if (u?.role === 'viewer') {
      list = list.filter((r) => r.creator === u.name)
      scopeVisible.value = true
    } else {
      scopeVisible.value = false
    }
    rows.value = list
    loading.value = false
  }

  return { rows, loading, scopeVisible, refresh }
}

export interface UseOrderFlowOptions {
  /** 流转成功后重拉列表 */
  refresh: () => Promise<void> | void
  /** 当前选中行 id 与行（流转目标与提示文案来源） */
  selectedId: Ref<string | null>
  selectedRow: Ref<OrderRow | null>
}

export function useOrderFlow(options: UseOrderFlowOptions) {
  const { t: tt } = useT()
  const { refresh, selectedId, selectedRow } = options
  const flowing = ref(false)

  async function flow(to: OrderStatus): Promise<void> {
    if (!selectedId.value) return
    const actionLabel = tt(`orders.flow.${selectedRow.value?.status ?? ''}`)
    flowing.value = true
    const updated = await updateOrderStatus(selectedId.value, to)
    flowing.value = false
    if (!updated) {
      appMessage.error(tt('orders.notFound'))
      return
    }
    appMessage.success(tt('orders.flowApplied', { action: actionLabel }))
    await refresh()
  }

  return { flowing, flow }
}
