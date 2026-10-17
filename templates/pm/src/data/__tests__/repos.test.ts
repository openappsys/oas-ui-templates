import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieProjectRepository } from '@/data/dexie/project-repo'
import { createDexieMemberRepository } from '@/data/dexie/member-repo'
import { createDexieCommentRepository } from '@/data/dexie/comment-repo'
import { createDexieActivityRepository } from '@/data/dexie/activity-repo'
import { createDexieSavedViewRepository } from '@/data/dexie/saved-view-repo'

const next = <T>(o: { subscribe(x: { next(v: T): void }): () => void }): Promise<T> =>
  new Promise((resolve) => {
    const unsub = o.subscribe({
      next: (v: T) => {
        resolve(v)
        unsub()
      },
    })
  })

describe('other repositories', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  it('project allocateKey 严格递增', async () => {
    await db.projects.add({
      id: 'p1',
      name: 'P',
      key: 'OAS',
      description: '',
      leadId: 'm1',
      createdAt: 0,
      nextKeyNum: 100001,
    })
    const repo = createDexieProjectRepository(db)
    expect(await repo.allocateKey('p1')).toBe(100001)
    expect(await repo.allocateKey('p1')).toBe(100002)
  })

  it('project liveAll 返回全部项目', async () => {
    const repo = createDexieProjectRepository(db)
    await db.projects.add({
      id: 'p1',
      name: 'P',
      key: 'OAS',
      description: '',
      leadId: 'm1',
      createdAt: 0,
    })
    expect((await next(repo.liveAll())).length).toBe(1)
  })

  it('member liveAll 响应变化', async () => {
    const repo = createDexieMemberRepository(db)
    const emissions: number[] = []
    let unsub: () => void = () => {}
    const second = new Promise<void>((resolve) => {
      unsub = repo.liveAll().subscribe({
        next: (v) => {
          emissions.push(v.length)
          if (emissions.length >= 2) resolve()
        },
      })
    })
    while (emissions.length === 0) await new Promise((r) => setTimeout(r, 5))
    expect(emissions[0]).toBe(0)
    await db.members.add({
      id: 'm1',
      name: '张',
      email: 'a@b.c',
      avatarColor: '#000',
      role: 'admin',
    })
    await second
    unsub()
    expect(emissions[1]).toBe(1)
  })

  it('member get/all 往返', async () => {
    const repo = createDexieMemberRepository(db)
    await db.members.add({
      id: 'm2',
      name: '李',
      email: 'l@oas.dev',
      avatarColor: '#111',
      role: 'viewer',
    })
    expect((await repo.get('m2'))?.role).toBe('viewer')
    expect((await repo.all()).length).toBe(1)
  })

  it('comment add/update/delete', async () => {
    const repo = createDexieCommentRepository(db)
    await repo.add({ issueId: 'i1', authorId: 'm1', body: 'hi' })
    const list = await next(repo.liveByIssue('i1'))
    expect(list.length).toBe(1)
    await repo.update(list[0].id, 'yo')
    expect((await next(repo.liveByIssue('i1')))[0].body).toBe('yo')
    await repo.delete(list[0].id)
    expect((await next(repo.liveByIssue('i1'))).length).toBe(0)
  })

  it('activity log 落库并可按 issue 读', async () => {
    const repo = createDexieActivityRepository(db)
    await repo.log({ issueId: 'i1', actorId: 'm1', type: 'create' })
    await repo.log({
      issueId: 'i1',
      actorId: 'm2',
      type: 'status',
      field: '状态',
      from: 'todo',
      to: 'done',
    })
    await repo.log({ issueId: 'i2', actorId: 'm1', type: 'create' })
    const forIssue = await next(repo.liveByIssue('i1'))
    expect(forIssue.length).toBe(2)
    const recent = await next(repo.liveRecent(10))
    expect(recent.length).toBe(3)
  })

  it('savedView create/delete + liveAll 按名排序', async () => {
    const repo = createDexieSavedViewRepository(db)
    await repo.create('b-view', { a: 1 })
    await repo.create('a-view', { b: 2 })
    const all = await next(repo.liveAll())
    expect(all.map((v) => v.name)).toEqual(['a-view', 'b-view'])
    await repo.delete(all[0].id)
    expect((await next(repo.liveAll())).length).toBe(1)
  })
})
