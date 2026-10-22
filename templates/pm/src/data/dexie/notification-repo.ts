import Dexie from 'dexie'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import type { NotificationRepository } from '@/data/types'
import type { Notification } from '@/types'

/** createdAt 倒序，并列按 id 倒序——与 API 实现（mock-server 的同类排序）保持一致，
 *  否则同毫秒写入的多条通知在两种数据源间顺序会漂移 */
function byCreatedDesc(a: Notification, b: Notification): number {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

export function createDexieNotificationRepository(db: PMDatabase): NotificationRepository {
  return {
    liveFor(memberId: string, limit: number) {
      return fromLiveQuery(async () => {
        const rows = await db.notifications
          .where('[memberId+createdAt]')
          .between([memberId, Dexie.minKey], [memberId, Dexie.maxKey])
          .reverse()
          .toArray()
        return rows.sort(byCreatedDesc).slice(0, limit)
      })
    },

    unreadCount(memberId: string) {
      // [memberId+readAt] 不索引 null（IndexedDB 键不含 null）：未读计数只能 memberId 索引 + filter
      return fromLiveQuery(() =>
        db.notifications
          .where('memberId')
          .equals(memberId)
          .filter((n) => n.readAt === null)
          .count(),
      )
    },

    async markRead(id: string) {
      const row = await db.notifications.get(id)
      // 已读不改写时间：幂等，重复点击不会把「已读时刻」刷新成现在
      if (!row || row.readAt !== null) return
      await db.notifications.update(id, { readAt: Date.now() })
    },

    async markAllRead(memberId: string) {
      const now = Date.now()
      await db.notifications
        .where('memberId')
        .equals(memberId)
        .filter((n) => n.readAt === null)
        .modify({ readAt: now })
    },
  }
}
