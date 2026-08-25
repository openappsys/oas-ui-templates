import { beforeEach, describe, expect, it } from 'vitest'
import {
  listNotifications,
  markAllRead,
  markRead,
  resetNotifications,
  unreadCount,
} from './notifications'

describe('notifications 数据源', () => {
  beforeEach(() => resetNotifications())

  it('listNotifications 返回种子数据快照', () => {
    const items = listNotifications()
    expect(items.length).toBeGreaterThanOrEqual(5)
    expect(items[0]).toHaveProperty('id')
    expect(items[0]).toHaveProperty('title')
    expect(items[0]).toHaveProperty('read')
  })

  it('unreadCount 等于未读条数', () => {
    const unread = listNotifications().filter((n) => !n.read).length
    expect(unreadCount()).toBe(unread)
  })

  it('markRead 标记命中项为已读', () => {
    const target = listNotifications().find((n) => !n.read)!
    markRead(target.id)
    expect(listNotifications().find((n) => n.id === target.id)?.read).toBe(true)
  })

  it('markRead 未命中 id 不改变状态', () => {
    const before = listNotifications().map((n) => n.read)
    markRead('no-such-id')
    expect(listNotifications().map((n) => n.read)).toEqual(before)
  })

  it('markAllRead 全部已读后 unreadCount 为 0', () => {
    markAllRead()
    expect(unreadCount()).toBe(0)
    expect(listNotifications().every((n) => n.read)).toBe(true)
  })

  it('resetNotifications 恢复种子未读状态', () => {
    markAllRead()
    resetNotifications()
    const unread = listNotifications().filter((n) => !n.read).length
    expect(unreadCount()).toBe(unread)
    expect(unread).toBeGreaterThan(0)
  })
})
