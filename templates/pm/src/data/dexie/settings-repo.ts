import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { SettingsRepository } from '@/data/types'

export function createDexieSettingsRepository(db: PMDatabase): SettingsRepository {
  return {
    get: <T>(key: string) => db.settings.get(key).then((row) => row?.value as T | undefined),
    set: (key, value) =>
      db.settings.put({ key, value, updatedAt: Date.now() }).then(() => undefined),
    live: <T>(key: string) =>
      fromLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined),
  }
}
