// 通知中心数据（vanilla src/data/notifications.ts 同构：内存 seed 数据 + 已读状态）
const seed = () => [
  {
    id: 'n-system',
    title: '系统通知',
    desc: '平台将于 02:00-04:00 进行例行维护，请提前保存工作内容。',
    time: '10:24',
    read: false,
  },
  {
    id: 'n-order',
    title: '新订单提醒',
    desc: '您收到一笔新的订单 #20260825-018，请及时确认并处理。',
    time: '09:51',
    read: false,
  },
  {
    id: 'n-stock',
    title: '库存预警',
    desc: 'SKU-PRO-008 库存已低于安全库存值，请尽快安排补货。',
    time: '08:17',
    read: false,
  },
  {
    id: 'n-perm',
    title: '权限变更',
    desc: '角色「运营」被调整了模块权限，相关账号同步生效。',
    time: '昨天',
    read: true,
  },
  {
    id: 'n-release',
    title: '版本发布',
    desc: 'V2.2.0 已发布，本次更新包含通知系统增强。',
    time: '昨天',
    read: true,
  },
]

const items = seed()

export function listNotifications() {
  return items.map((n) => ({ ...n }))
}

export function markRead(id) {
  const hit = items.find((n) => n.id === id)
  if (hit) hit.read = true
}

export function markAllRead() {
  for (const n of items) n.read = true
}

export function unreadCount() {
  return items.filter((n) => !n.read).length
}
