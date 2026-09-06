// src/hooks/use-products.test.tsx —— 商品域 query/mutation hooks 单测：
// 列表查询走假后端缓存；mutation 成功后对应 query key 失效并重取
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetProducts } from '../data/products'
import { productKeys, useProductMutations, useProductsList } from './use-products'

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

describe('useProductsList', () => {
  beforeEach(() => resetProducts())

  it('拉取商品列表（假后端种子数据）', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useProductsList(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.length).toBeGreaterThan(0)
  })
})

describe('useProductMutations', () => {
  beforeEach(() => resetProducts())

  it('update 成功后使商品列表缓存失效并重取到新值', async () => {
    const { wrapper, qc } = makeWrapper()
    // 先预热缓存（fresh），再人为 mark stale 以观察 mutation 后的重取
    const { result: list } = renderHook(() => useProductsList(), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))
    const before = qc.getQueryState(productKeys.list())!.dataUpdatedAt

    const { result: mutations } = renderHook(() => useProductMutations(), { wrapper })
    await act(async () => {
      await mutations.current.update.mutateAsync({
        id: list.current.data![0].id,
        payload: { name: '改名商品' },
      })
    })

    await waitFor(() => {
      expect(qc.getQueryState(productKeys.list())!.dataUpdatedAt).toBeGreaterThan(before)
    })
    const rows = qc.getQueryData<{ name: string }[]>(productKeys.list())!
    expect(rows.find((r) => r.name === '改名商品')).toBeTruthy()
  })

  it('remove 成功后列表缓存联动重取（行数减一）', async () => {
    const { wrapper, qc } = makeWrapper()
    const { result: list } = renderHook(() => useProductsList(), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))
    const count = list.current.data!.length

    const { result: mutations } = renderHook(() => useProductMutations(), { wrapper })
    await act(async () => {
      const ok = await mutations.current.remove.mutateAsync(list.current.data![0].id)
      expect(ok).toBe(true)
    })

    await waitFor(() => {
      expect(qc.getQueryData<{ id: number }[]>(productKeys.list())!.length).toBe(count - 1)
    })
  })
})
