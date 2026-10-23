/** 列表表头全选：口径是「当前已加载（filtered）窗口」，不跨窗口累加——
 *  窗口随滚动续载扩大，跨窗口选择会让表头三态与用户看到的行脱节 */
export type SelectionState = 'none' | 'partial' | 'all'

/** 三态：这批 id 全在选中集 = all；部分在 = partial；都不在 = none。空列表按 none 处理 */
export function selectionState(
  ids: readonly string[],
  selected: ReadonlySet<string>,
): SelectionState {
  if (ids.length === 0) return 'none'
  let hit = 0
  for (const id of ids) if (selected.has(id)) hit++
  if (hit === 0) return 'none'
  return hit === ids.length ? 'all' : 'partial'
}

/** 表头勾选切换：已全选 → 清空这批 id；否则把缺失的 id 并入（窗口外的既有选择保留） */
export function toggleAll(ids: readonly string[], selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected)
  const all = selectionState(ids, selected) === 'all'
  for (const id of ids) {
    if (all) next.delete(id)
    else next.add(id)
  }
  return next
}
