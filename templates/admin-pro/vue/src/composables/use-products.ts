// src/composables/use-products.ts —— 商品领域数据 composable
// useProductsList：列表 + 分类拉取（原 products.vue refresh 的数据逻辑）；
// useProductMutations：状态切换/行内编辑/批量上下架/批量删除（提示与刷新语义原样保留）
import { ref } from 'vue'
import type { Ref } from 'vue'
import { useT } from './use-t'
import { listCategories } from '../data/categories'
import {
  listProducts,
  removeProduct,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import type { ProductRow } from '../data/products'
import { appMessage } from '../lib/app-message'

/** 分类下拉选项（结构对齐 pages/product-form.vue 的 Option） */
export interface CategoryOption {
  label: string
  value: string
}

export interface UseProductsListOptions {
  /** 当前分类筛选值：refresh 后若该分类已被删除则回落空（原 products.vue 同款联动） */
  category?: Ref<string>
}

export function useProductsList(options: UseProductsListOptions = {}) {
  const rows = ref<ProductRow[]>([])
  const categories = ref<CategoryOption[]>([])

  async function refresh(): Promise<void> {
    const [list, cats] = await Promise.all([listProducts(), listCategories()])
    rows.value = list
    const opts = cats.map((c) => ({ label: c.name, value: c.name }))
    categories.value = opts
    const category = options.category
    if (category && category.value && !opts.some((c) => c.value === category.value)) {
      category.value = ''
    }
  }

  return { rows, categories, refresh }
}

export interface UseProductMutationsOptions {
  /** 变更成功后重拉列表 */
  refresh: () => Promise<void> | void
  /** 列表数据（批量操作按 id 找行、跳过已是目标状态的行） */
  rows: Ref<ProductRow[]>
  /** 勾选的行 id（批量操作对象） */
  selected: Ref<number[]>
  /** viewer 只读：批量操作前置校验 */
  canMutate: boolean
  /** 批量操作完成后清理勾选 */
  clearSelection: () => void
}

export function useProductMutations(options: UseProductMutationsOptions) {
  const { t: tt } = useT()
  const { refresh, rows, selected, canMutate, clearSelection } = options

  async function toggleStatus(id: number): Promise<void> {
    const updated = await toggleProductStatus(id)
    if (!updated) {
      appMessage.error(tt('products.notFound'))
      return
    }
    appMessage.success(
      updated.status === 'on' ? tt('products.status.on') : tt('products.status.off'),
    )
    void refresh()
  }

  function inlineEdit(id: number, column: 'price' | 'stock', value: number): void {
    void updateProduct(id, { [column]: value }).then((updated) => {
      if (!updated) appMessage.error(tt('products.notFound'))
      else appMessage.success(tt('common.saved'))
      void refresh()
    })
  }

  async function batchStatus(target: 'on' | 'off'): Promise<void> {
    if (!canMutate) {
      appMessage.error(tt('common.noPerm'))
      return
    }
    let changed = 0
    for (const id of selected.value) {
      const row = rows.value.find((r) => r.id === id)
      if (!row || row.status === target) continue
      if (await toggleProductStatus(id)) changed++
    }
    clearSelection()
    appMessage.success(tt('products.batch.statusDone', { count: changed }))
    void refresh()
  }

  async function batchDelete(): Promise<void> {
    if (!canMutate) {
      appMessage.error(tt('common.noPerm'))
      return
    }
    let removed = 0
    for (const id of selected.value) {
      if (await removeProduct(id)) removed++
    }
    clearSelection()
    appMessage.success(tt('products.batch.deleted', { count: removed }))
    void refresh()
  }

  return { toggleStatus, inlineEdit, batchStatus, batchDelete }
}
