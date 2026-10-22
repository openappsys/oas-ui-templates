import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { ActivityRepository, ActivityInput } from '@/data/types'
import { notifyActivity } from './notify-write'

export function createDexieActivityRepository(db: PMDatabase): ActivityRepository {
  return {
    // 活动先落库再生成通知：指派/状态变更的「变更前」值只能在这里读到
    log: (entry: ActivityInput) =>
      db
        .transaction('rw', db.activities, db.issues, db.notifications, async () => {
          await db.activities.add({ id: nanoid(), ...entry, createdAt: Date.now() })
          await notifyActivity(db, entry)
        })
        .then(() => undefined),
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
