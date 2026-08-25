export function persist<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    return
  }
}

export function restore<T>(key: string, seed: () => T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      const seeded = seed()
      persist(key, seeded)
      return seeded
    }
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as T[]
    const seeded = seed()
    persist(key, seeded)
    return seeded
  } catch {
    return seed()
  }
}
