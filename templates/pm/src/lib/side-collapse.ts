/** 侧栏筛选分组的折叠偏好：localStorage 存「已折叠的分组键」，缺省全部展开。
 *  只存折叠项而不是折叠项 + 展开项：新增分组默认展开，老偏好不会把它意外藏起来 */
const STORAGE_KEY = 'oas-pm-side-collapsed'

/** 只依赖读写两个通道，单测可注入内存实现 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** 非法 JSON / 非字符串数组一律回落「全部展开」，不抛错（旧版本没有这个键） */
export function loadCollapsedGroups(storage: StorageLike = localStorage): string[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((k): k is string => typeof k === 'string' && k !== '')
  } catch {
    return []
  }
}

export function storeCollapsedGroups(
  keys: readonly string[],
  storage: StorageLike = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

/** 折叠切换：已折叠则展开（移除），否则折叠（追加）；不修改入参 */
export function toggleCollapsedGroup(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
}

export function isGroupCollapsed(keys: readonly string[], key: string): boolean {
  return keys.includes(key)
}
