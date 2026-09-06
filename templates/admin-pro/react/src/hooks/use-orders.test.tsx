// src/hooks/use-orders.test.tsx —— 订单域 query/mutation hooks 单测：
// viewer 过滤、按 id 详情、状态流转后订单域缓存失效重取
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetOrders } from '../data/orders'
import { session } from '../store/session'
import { orderKeys, useOrder, useOrderStatusMutation, useOrdersList } from './use-orders'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
    qc,
  }
}

describe('useOrdersList', () => {
  beforeEach(() => {
    resetOrders()
    session.logout()
  })
  afterEach(() => session.logout())

  it('admin 拉到全量订单', async () => {
    session.login('张伟', 'admin')
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useOrdersList(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.length).toBeGreaterThan(0)
  })

  it('viewer 只能看到自己创建的订单', async () => {
    session.login('李秀', 'viewer')
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useOrdersList(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    for (const row of result.current.data!) {
      expect(row.creator).toBe('李秀')
    }
  })
})

describe('useOrder / useOrderStatusMutation', () => {
  beforeEach(() => {
    resetOrders()
    session.login('张伟', 'admin')
  })
  afterEach(() => session.logout())

  it('按 id 取详情；查无返回 null', async () => {
    const { wrapper } = makeWrapper()
    const { result: list } = renderHook(() => useOrdersList(), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))
    const id = list.current.data![0].id

    const { result: detail } = renderHook(() => useOrder(id), { wrapper })
    await waitFor(() => expect(detail.current.isSuccess).toBe(true))
    expect(detail.current.data!.id).toBe(id)

    const { result: missing } = renderHook(() => useOrder('no-such-id'), { wrapper })
    await waitFor(() => expect(missing.current.isSuccess).toBe(true))
    expect(missing.current.data).toBeNull()
  })

  it('状态流转成功后列表缓存失效重取到新状态', async () => {
    const { wrapper, qc } = makeWrapper()
    const { result: list } = renderHook(() => useOrdersList(), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))
    const target = list.current.data!.find((r) => r.status === 'pending')
    expect(target).toBeTruthy()

    const { result: mutation } = renderHook(() => useOrderStatusMutation(), { wrapper })
    await act(async () => {
      const updated = await mutation.current.mutateAsync({ id: target!.id, target: 'paid' })
      expect(updated?.status).toBe('paid')
    })

    await waitFor(() => {
      const rows = qc.getQueryData<{ id: string; status: string }[]>(orderKeys.list())!
      expect(rows.find((r) => r.id === target!.id)?.status).toBe('paid')
    })
  })
})
