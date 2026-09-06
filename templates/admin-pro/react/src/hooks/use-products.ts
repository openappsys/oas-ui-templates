// src/hooks/use-products.ts —— 商品/分类域的 TanStack Query hooks
// 查询：列表/详情/分类；变更：create/update/toggle/remove，成功后失效对应 key
// 由缓存层驱动重取（页面不再持有手动 refresh 回调链）；消息提示与导航留在页面层
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProduct,
  getProduct,
  listProducts,
  removeProduct,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import {
  createCategory,
  listCategories,
  removeCategory,
  updateCategory,
} from '../data/categories'
import type { CategoryRow } from '../data/categories'
import type { ProductRow } from '../data/products'

/** 商品域 key 工厂：list 固定、detail 按 id 派生，invalidate(all) 一锅端 */
export const productKeys = {
  all: ['products'] as const,
  list: () => ['products', 'list'] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
}

/** 分类域 key：被商品表单/筛选与分类管理页共享 */
export const categoryKeys = {
  all: ['categories'] as const,
}

/** 商品列表（顶栏筛选/卡片/表格共用同一份缓存） */
export function useProductsList() {
  return useQuery({ queryKey: productKeys.list(), queryFn: listProducts })
}

/** 商品详情（按 id；查无返回 null，页面据此渲染 missing 态） */
export function useProduct(id: number | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? 0),
    queryFn: () => getProduct(id ?? 0),
    enabled: id != null,
  })
}

/** 分类列表（products 筛选、product-form 选项、category 管理页共用） */
export function useCategories() {
  return useQuery({ queryKey: categoryKeys.all, queryFn: listCategories })
}

export interface ProductPayload {
  name: string
  category: string
  price: number
  stock: number
  status: 'on' | 'off'
  created: string
}

/** 商品变更集：成功后失效商品缓存；列表页订阅同一 key 自动重取 */
export function useProductMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: productKeys.all })

  const create = useMutation({
    mutationFn: (payload: ProductPayload) => createProduct(payload),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<ProductRow, 'id'>> }) =>
      updateProduct(id, payload),
    onSuccess: invalidate,
  })
  const toggleStatus = useMutation({
    mutationFn: (id: number) => toggleProductStatus(id),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => removeProduct(id),
    onSuccess: invalidate,
  })
  return { create, update, toggleStatus, remove }
}

export type CategoryPayload = Omit<CategoryRow, 'id'>

/** 分类变更集：成功后失效分类缓存（商品筛选/表单选项联动重取） */
export function useCategoryMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: categoryKeys.all })

  const create = useMutation({
    mutationFn: (data: CategoryPayload) => createCategory(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<CategoryRow, 'id'>> }) =>
      updateCategory(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: removeCategory, onSuccess: invalidate })
  return { create, update, remove }
}
