import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieSettingsRepository } from '@/data/dexie/settings-repo'
import { createDexieAdminRepository } from '@/data/dexie/admin-repo'
import { createDexieMemberRepository } from '@/data/dexie/member-repo'
import { createDexieProjectRepository } from '@/data/dexie/project-repo'
import type { Issue } from '@/types'

function seedIssue(_db: PMDatabase, over: Partial<Issue> = {}): Issue {
  return {
    id: over.id ?? crypto.randomUUID(),
    projectId: 'p1',
    key: 'OAS-1',
    title: 't',
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
    ...over,
  }
}

function seedMember(db: PMDatabase, id: string, role: 'admin' | 'member' | 'viewer') {
  return db.members.add({ id, name: id, email: `${id}@t.c`, avatarColor: '#000', role })
}
function seedProject(db: PMDatabase, id: string, key = 'P1') {
  return db.projects.add({
    id,
    name: id,
    key,
    description: '',
    leadId: 'm1',
    createdAt: 0,
    nextKeyNum: 1,
  })
}

describe('settings repository', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  it('set/get 往返', async () => {
    const repo = createDexieSettingsRepository(db)
    await repo.set('labels', ['a', 'b'])
    expect(await repo.get<string[]>('labels')).toEqual(['a', 'b'])
  })

  it('live 推送变更', async () => {
    const repo = createDexieSettingsRepository(db)
    const emissions: Array<string[] | undefined> = []
    let unsub: () => void = () => {}
    const second = new Promise<void>((resolve) => {
      unsub = repo.live<string[]>('labels').subscribe({
        next: (v) => {
          emissions.push(v)
          if (emissions.length >= 2) resolve()
        },
      })
    })
    while (emissions.length === 0) await new Promise((r) => setTimeout(r, 5))
    await repo.set('labels', ['x'])
    await second
    unsub()
    expect(emissions[0]).toBeUndefined()
    expect(emissions[1]).toEqual(['x'])
  })
})

describe('admin repository', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  it('liveGlobalStats 统计项目/成员/Issue/完成数', async () => {
    await seedProject(db, 'p1')
    await seedMember(db, 'm1', 'admin')
    await db.issues.bulkAdd([
      seedIssue(db, { id: 's1', projectId: 'p1', status: 'done' }),
      seedIssue(db, { id: 's2', projectId: 'p1', status: 'todo' }),
    ])
    const repo = createDexieAdminRepository(db)
    const stats = await new Promise<{
      projects: number
      members: number
      issues: number
      done: number
    }>((resolve) => {
      const unsub = repo.liveGlobalStats().subscribe({
        next: (v) => {
          resolve(v)
          unsub()
        },
      })
    })
    expect(stats.projects).toBe(1)
    expect(stats.members).toBe(1)
    expect(stats.issues).toBe(2)
    expect(stats.done).toBe(1)
  })

  it('liveProjectHealth 逾期/无负责人/停滞', async () => {
    await seedProject(db, 'p1')
    const now = Date.now()
    const day = 86400000
    await db.issues.bulkAdd([
      seedIssue(db, {
        id: 'h1',
        assigneeId: 'm1',
        dueAt: now - day,
        status: 'todo',
        updatedAt: now,
      }),
      seedIssue(db, { id: 'h2', assigneeId: null, status: 'todo', updatedAt: now }),
      seedIssue(db, {
        id: 'h3',
        assigneeId: 'm1',
        status: 'todo',
        updatedAt: now - 20 * day,
        createdAt: now - 20 * day,
      }),
      seedIssue(db, {
        id: 'h4',
        assigneeId: 'm1',
        status: 'done',
        dueAt: now - day,
        updatedAt: now,
      }),
    ])
    const repo = createDexieAdminRepository(db)
    const rows = await new Promise<
      Array<{
        projectId: string
        total: number
        overdue: number
        unassigned: number
        stale: number
      }>
    >((resolve) => {
      const unsub = repo.liveProjectHealth().subscribe({
        next: (v) => {
          resolve(v)
          unsub()
        },
      })
    })
    expect(rows.length).toBe(1)
    expect(rows[0].projectId).toBe('p1')
    expect(rows[0].total).toBe(4)
    expect(rows[0].overdue).toBe(1)
    expect(rows[0].unassigned).toBe(1)
    expect(rows[0].stale).toBe(1)
  })

  it('export→wipe→import 往返等值', async () => {
    await seedProject(db, 'p1')
    await seedMember(db, 'm1', 'admin')
    await db.issues.bulkAdd([seedIssue(db, { id: 'r1' })])
    await db.comments.add({ id: 'c1', issueId: 'r1', authorId: 'm1', body: 'x', createdAt: 1 })
    const repo = createDexieAdminRepository(db)
    const json = await repo.exportAll()
    await repo.wipeAll()
    expect((await db.issues.toArray()).length).toBe(0)
    await repo.importAll(json)
    expect((await db.issues.toArray()).length).toBe(1)
    expect((await db.projects.toArray()).length).toBe(1)
    expect((await db.members.toArray()).length).toBe(1)
    expect((await db.comments.toArray()).length).toBe(1)
  })

  it('importAll 非法 JSON 抛错且数据不变', async () => {
    await seedProject(db, 'p1')
    const repo = createDexieAdminRepository(db)
    await expect(repo.importAll('not-json')).rejects.toThrow()
    expect((await db.projects.toArray()).length).toBe(1)
  })

  it('非空项目删除被拒绝，空项目可删', async () => {
    await seedProject(db, 'p1')
    await seedProject(db, 'p2')
    await db.issues.bulkAdd([seedIssue(db, { id: 'd1', projectId: 'p1' })])
    const repo = createDexieProjectRepository(db)
    await expect(repo.delete('p1')).rejects.toThrow()
    await repo.delete('p2')
    expect(await db.projects.get('p2')).toBeUndefined()
  })

  it('成员删除：名下 Issue 置未分配；最后 admin 拒绝', async () => {
    await seedMember(db, 'm1', 'admin')
    await seedMember(db, 'm2', 'member')
    await db.issues.bulkAdd([seedIssue(db, { id: 'u1', assigneeId: 'm2' })])
    const repo = createDexieMemberRepository(db)
    await repo.delete('m2')
    expect((await db.issues.get('u1'))?.assigneeId).toBeNull()
    await expect(repo.delete('m1')).rejects.toThrow()
  })

  it('最后 admin 降级被拒绝', async () => {
    await seedMember(db, 'm1', 'admin')
    await seedMember(db, 'm2', 'member')
    const repo = createDexieMemberRepository(db)
    await expect(repo.update('m1', { role: 'member' })).rejects.toThrow()
    await repo.update('m2', { role: 'viewer' })
    await repo.update('m1', { role: 'admin' })
  })

  it('issues 表含 [assigneeId+status] 复合索引', () => {
    expect(db.issues.schema.indexes.map((i) => i.name)).toContain('[assigneeId+status]')
  })

  it('liveMemberWorkload 跨项目聚合', async () => {
    await seedMember(db, 'm1', 'admin')
    await db.issues.bulkAdd([
      seedIssue(db, { id: 'w1', assigneeId: 'm1', status: 'todo' }),
      seedIssue(db, { id: 'w2', assigneeId: 'm1', status: 'done', projectId: 'p2' }),
      seedIssue(db, { id: 'w3', assigneeId: null }),
    ])
    const repo = createDexieAdminRepository(db)
    const rows = await new Promise<
      Array<{ memberId: string; total: number; todo: number; done: number }>
    >((resolve) => {
      const unsub = repo.liveMemberWorkload().subscribe({
        next: (v) => {
          resolve(v)
          unsub()
        },
      })
    })
    const m1 = rows.find((r) => r.memberId === 'm1')
    expect(m1?.total).toBe(2)
    expect(m1?.todo).toBe(1)
    expect(m1?.done).toBe(1)
  })
})
