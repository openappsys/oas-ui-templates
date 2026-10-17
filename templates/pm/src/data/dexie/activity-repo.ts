import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { ActivityRepository, ActivityInput } from '@/data/types'

export function createDexieActivityRepository(db: PMDatabase): ActivityRepository {
  return {
    log: (entry: ActivityInput) =>
      db.activities.add({ id: nanoid(), ...entry, createdAt: Date.now() }).then(() => undefined),
    liveByIssue: (issueId: string) =>
      fromLiveQuery(() =>
        db.activities
          .where('[issueId+createdAt]')
          .between([issueId, Dexie.minKey], [issueId, Dexie.maxKey])
          .reverse()
          .toArray(),
      ),
    liveRecent: (limit: number) =>
      fromLiveQuery(() => db.activities.orderBy('createdAt').reverse().limit(limit).toArray()),
  }
}
