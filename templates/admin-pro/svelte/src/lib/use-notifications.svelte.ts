// src/lib/use-notifications.svelte.ts —— 通知数据状态（runes 版）
// 由 AppShell 持有一份，badge（header-bar）与抽屉共享；
// list/markRead/markAllRead 是裸数据模块（无订阅），动作后重读列表驱动重渲染
import {
  listNotifications,
  markAllRead,
  markRead,
  type Notification,
} from '../data/notifications'

export function useNotifications() {
  let items = $state<Notification[]>(listNotifications())
  const unread = $derived(items.filter((n) => !n.read).length)

  function refresh(): void {
    items = listNotifications()
  }

  function readOne(id: string): void {
    markRead(id)
    refresh()
  }

  function readAll(): void {
    markAllRead()
    refresh()
  }

  return {
    get items() {
      return items
    },
    get unread() {
      return unread
    },
    readOne,
    readAll,
  }
}
