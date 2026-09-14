/**
 * localStorage 持久化工具（自 vanilla src/data/store.ts 去 TS 移植，逻辑逐字保留）
 */

/**
 * 将行数据序列化写入 localStorage（隐私模式等写入失败时静默忽略）
 * @param {string} key
 * @param {Array<*>} rows
 */
export function persist(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    return
  }
}

/**
 * 从 localStorage 恢复行数据；无数据 / 坏数据时回落种子并回写
 * @template T
 * @param {string} key
 * @param {() => T[]} seed
 * @returns {T[]}
 */
export function restore(key, seed) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      const seeded = seed()
      persist(key, seeded)
      return seeded
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    const seeded = seed()
    persist(key, seeded)
    return seeded
  } catch {
    return seed()
  }
}
