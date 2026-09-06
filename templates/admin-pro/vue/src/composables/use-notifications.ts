// src/composables/use-notifications.ts —— 通知数据状态（AppShell 持有一份，badge 与抽屉共享）
// list/markRead/markAllRead 是裸数据模块（无订阅），动作后重读列表驱动重渲染
// （对齐 react 版 notifications-drawer.tsx 内 useNotifications 的语义）
import { computed, ref } from 'vue'
import { listNotifications, markAllRead, markRead, type Notification } from '../data/notifications'

export function useNotifications() {
  const items = ref<Notification[]>(listNotifications())
  function refresh(): void {
    items.value = listNotifications()
  }
  function readOne(id: string): void {
    markRead(id)
    refresh()
  }
  function readAll(): void {
    markAllRead()
    refresh()
  }
  const unread = computed(() => items.value.filter((n) => !n.read).length)
  return { items, unread, readOne, readAll }
}
