import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PMDatabase } from '@/db/schema'
import { createDexieActivityRepository } from '@/data/dexie/activity-repo'
import { createDexieCommentRepository } from '@/data/dexie/comment-repo'
import { createDexieIssueRepository } from '@/data/dexie/issue-repo'
import { createDexieMemberRepository } from '@/data/dexie/member-repo'
import { createDexieNotificationRepository } from '@/data/dexie/notification-repo'
import type { Notification } from '@/types'

function first<T>(o: {
  subscribe(x: { next(v: T): void; error?(e: unknown): void }): () => void
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let unsub: () => void = () => {}
    const timer = setTimeout(() => {
      unsub()
      reject(new Error('observable 未推送'))
    }, 5000)
    unsub = o.subscribe({
      next: (v) => {
        clearTimeout(timer)
        unsub()
        resolve(v)
      },
      error: (e) => {
        clearTimeout(timer)
        unsub()
        reject(e)
      },
    })
  })
}

const row = (over: Partial<Notification> & { id: string }): Notification => ({
  memberId: 'm1',
  type: 'system',
  readAt: null,
  createdAt: 1000,
  ...over,
})

describe('dexie notification repository', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  it('liveFor：本人倒序 + limit 截断，不串号', async () => {
    await db.notifications.bulkAdd([
      row({ id: 'a', createdAt: 100 }),
      row({ id: 'b', createdAt: 300 }),
      row({ id: 'c', createdAt: 200 }),
      row({ id: 'other', memberId: 'm2', createdAt: 400 }),
    ])
    const repo = createDexieNotificationRepository(db)
    const rows = await first(repo.liveFor('m1', 2))
    expect(rows.map((r) => r.id)).toEqual(['b', 'c'])
    expect(rows.every((r) => r.memberId === 'm1')).toBe(true)
  })

  it('unreadCount 只数本人未读', async () => {
    await db.notifications.bulkAdd([
      row({ id: 'a' }),
      row({ id: 'b', readAt: 5 }),
      row({ id: 'c', memberId: 'm2' }),
    ])
    const repo = createDexieNotificationRepository(db)
    expect(await first(repo.unreadCount('m1'))).toBe(1)
    expect(await first(repo.unreadCount('m2'))).toBe(1)
    expect(await first(repo.unreadCount('m3'))).toBe(0)
  })

  it('markRead 幂等（重复标记不改写已读时刻）', async () => {
    await db.notifications.add(row({ id: 'a' }))
    const repo = createDexieNotificationRepository(db)
    await repo.markRead('a')
    const once = (await db.notifications.get('a'))?.readAt
    expect(typeof once).toBe('number')
    await repo.markRead('a')
    expect((await db.notifications.get('a'))?.readAt).toBe(once)
    await repo.markRead('missing')
    expect(await db.notifications.count()).toBe(1)
  })

  it('markAllRead 只影响本人未读', async () => {
    await db.notifications.bulkAdd([
      row({ id: 'a' }),
      row({ id: 'b' }),
      row({ id: 'mine-read', readAt: 1 }),
      row({ id: 'other', memberId: 'm2' }),
    ])
    const repo = createDexieNotificationRepository(db)
    await repo.markAllRead('m1')
    const mine = await db.notifications.where('memberId').equals('m1').toArray()
    expect(mine.every((r) => r.readAt !== null)).toBe(true)
    expect((await db.notifications.get('other'))?.readAt).toBe(null)
    expect((await db.notifications.get('mine-read'))?.readAt).toBe(1)
    expect(await first(repo.unreadCount('m1'))).toBe(0)
  })
})

describe('通知写入钩子（Dexie）', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
    await createDexieMemberRepository(db).create({
      id: 'm1',
      name: '张伟',
      email: 'a@oas.dev',
      avatarColor: '#000',
      role: 'admin',
    })
    await createDexieMemberRepository(db).create({
      id: 'm2',
      name: '李娜',
      email: 'b@oas.dev',
      avatarColor: '#111',
      role: 'member',
    })
    await db.issues.add({
      id: 'i1',
      projectId: 'p1',
      key: 'OAS-1',
      title: 't',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeId: 'm1',
      reporterId: 'm1',
      labels: [],
      startAt: null,
      dueAt: null,
      createdAt: 1000,
      updatedAt: 1000,
      order: 0,
    })
  })

  const notes = () => db.notifications.orderBy('createdAt').toArray() as Promise<Notification[]>

  it('评论 @提及 → mention；未提及负责人 → comment；自己评论自己 → 无通知', async () => {
    const repo = createDexieCommentRepository(db)
    await repo.add({ issueId: 'i1', authorId: 'm2', body: '@张伟 帮忙看下' })
    await repo.add({ issueId: 'i1', authorId: 'm2', body: '进度如何' })
    await repo.add({ issueId: 'i1', authorId: 'm1', body: '我自己的备注' })
    const rows = await notes()
    // 同毫秒写入的并列顺序由主键兜底 → 比多重集，再按类型取行断言内容
    expect(rows.map((r) => `${r.type}:${r.memberId}`).sort()).toEqual(['comment:m1', 'mention:m1'])
    const mention = rows.find((r) => r.type === 'mention')!
    expect(mention.actorId).toBe('m2')
    expect(mention.issueId).toBe('i1')
    expect(mention.message).toBe('@张伟 帮忙看下')
  })

  it('活动日志：指派给他人 → assigned；关闭类状态 → status；非关闭/自己指派自己 → 无', async () => {
    await db.issues.update('i1', { assigneeId: null })
    const repo = createDexieActivityRepository(db)
    await repo.log({ issueId: 'i1', actorId: 'm2', type: 'assignee', to: 'm1' })
    // 活动先写、字段后写（与界面保存顺序一致）：状态通知读到的是已更新的负责人
    await db.issues.update('i1', { assigneeId: 'm1' })
    await repo.log({ issueId: 'i1', actorId: 'm2', type: 'status', to: 'done' })
    await repo.log({ issueId: 'i1', actorId: 'm2', type: 'status', to: 'in_progress' })
    await repo.log({ issueId: 'i1', actorId: 'm1', type: 'assignee', to: 'm1' })
    const rows = await notes()
    // 同毫秒写入的并列顺序由主键兜底 → 比多重集
    expect(rows.map((r) => r.type).sort()).toEqual(['assigned', 'status'])
    expect(rows.find((r) => r.type === 'status')?.message).toBe('done')
  })

  it('详情抽屉的指派活动（type=assigneeId）同样生成 assigned', async () => {
    await db.issues.update('i1', { assigneeId: null })
    const repo = createDexieActivityRepository(db)
    await repo.log({ issueId: 'i1', actorId: 'm2', type: 'assigneeId', to: 'm1' })
    const rows = await notes()
    expect(rows.map((r) => `${r.type}:${r.memberId}`)).toEqual(['assigned:m1'])
  })

  it('bulkApply：批量指派/关闭按同一套规则生成通知', async () => {
    await db.issues.add({
      id: 'i2',
      projectId: 'p1',
      key: 'OAS-2',
      title: 'u',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeId: null,
      reporterId: 'm1',
      labels: [],
      startAt: null,
      dueAt: null,
      createdAt: 1000,
      updatedAt: 1000,
      order: 0,
    })
    const repo = createDexieIssueRepository(db)
    await repo.bulkApply(['i1', 'i2'], { assigneeId: 'm2', status: 'done' }, 'm1')
    const rows = await notes()
    // i1 负责人 m1、i2 未分配 → 都指派给 m2 产生 assigned；同一次操作里的 done 被 assigned 去重
    // 同一批写入的 createdAt 可能相同，列表顺序按 id 兜底 → 断言不比顺序
    expect(rows.map((r) => `${r.type}:${r.issueId}:${r.memberId}`).sort()).toEqual([
      'assigned:i1:m2',
      'assigned:i2:m2',
    ])
  })
})
