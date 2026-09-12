export interface Notification {
  id: string
  title: string
  desc: string
  time: string
  read: boolean
}

function seed(): Notification[] {
  return [
    {
      id: 'n-system',
      title: '系统公告',
      desc: '平台将于本周六 02:00-04:00 进行例行维护，请提前保存工作内容。',
      time: '10:24',
      read: false,
    },
    {
      id: 'n-order',
      title: '新订单提醒',
      desc: '你收到一笔新的订单 #20260825-018，请及时确认并处理。',
      time: '09:51',
      read: false,
    },
    {
      id: 'n-stock',
      title: '库存预警',
      desc: 'SKU-PRO-008 库存已低于安全阈值，建议尽快安排补货。',
      time: '08:17',
      read: false,
    },
    {
      id: 'n-perm',
      title: '权限变更',
      desc: '角色「运营」已新增报表导出权限，相关账号已同步生效。',
      time: '昨天',
      read: true,
    },
    {
      id: 'n-release',
      title: '版本发布',
      desc: 'V2.2.0 已发布，新增命令面板与通知中心等系统增强。',
      time: '昨天',
      read: true,
    },
  ]
}

const items: Notification[] = seed()

export function listNotifications(): Notification[] {
  return items.map((n) => ({ ...n }))
}

export function markRead(id: string): void {
  const hit = items.find((n) => n.id === id)
  if (hit) hit.read = true
}

export function markAllRead(): void {
  for (const n of items) n.read = true
}

export function unreadCount(): number {
  return items.filter((n) => !n.read).length
}

export function resetNotifications(): void {
  items.length = 0
  items.push(...seed())
}
