// localStorage 持久化助手：写入失败静默、读取坏数据回退种子
// （自 vanilla src/data/store.ts 去 TS 移植，逻辑逐字保留）

export function persist(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    return
  }
}

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
