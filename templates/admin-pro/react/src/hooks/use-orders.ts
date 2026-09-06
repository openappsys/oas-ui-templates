// src/hooks/use-orders.ts —— 订单域的 TanStack Query hooks
// 查询：列表（viewer 角色过滤在 queryFn 内，与原 refresh() 行为逐字对齐）/详情按 id；
// 变更：状态流转 + 创建订单，成功后失效订单缓存（抽屉/详情页/列表自动联动）
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createOrder, getOrder, listOrders, updateOrderStatus } from '../data/orders'
import { session } from '../store/session'

export const orderKeys = {
  all: ['orders'] as const,
  list: () => ['orders', 'list'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
}

/** 订单列表：viewer 只能看自己创建的（过滤逻辑留在数据侧单一出口） */
export function useOrdersList() {
  return useQuery({
    queryKey: orderKeys.list(),
    queryFn: async () => {
      let list = await listOrders()
      const u = session.user
      if (u?.role === 'viewer') list = list.filter((r) => r.creator === u.name)
      return list
    },
  })
}

/** 订单详情（按 id；查无返回 null → 页面 missing 态） */
export function useOrder(id: string) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: () => getOrder(id) })
}

/** 状态流转：成功后失效订单域（列表统计/徽标/抽屉行随重取刷新） */
export function useOrderStatusMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, target }: { id: string; target: Parameters<typeof updateOrderStatus>[1] }) =>
      updateOrderStatus(id, target),
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

/** 创建订单（向导表单提交）：失效列表，进入订单页即见新单 */
export function useCreateOrderMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  })
}
