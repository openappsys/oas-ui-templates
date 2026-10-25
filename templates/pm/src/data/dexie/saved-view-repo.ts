import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { SavedViewRepository } from '@/data/types'

export function createDexieSavedViewRepository(db: PMDatabase): SavedViewRepository {
  return {
    liveAll: () => fromLiveQuery(() => db.savedViews.orderBy('name').toArray()),
    create: (name: string, filters: unknown, ownerId?: string | null) =>
      db.savedViews
        .add({
          id: nanoid(),
          name,
          filters: JSON.stringify(filters),
          createdAt: Date.now(),
          ownerId: ownerId ?? null,
        })
        .then(() => undefined),
    delete: (id) => db.savedViews.delete(id),
  }
}
