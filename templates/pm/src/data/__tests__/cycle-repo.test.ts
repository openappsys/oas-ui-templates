import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieCycleRepository } from '@/data/dexie/cycle-repo'
import type { Observable } from '@/data/observable'
import { ALL_PROJECTS } from '@/lib/filters'
import type { Cycle, Issue } from '@/types'

const first = <T>(o: Observable<T>): Promise<T> =>
  new Promise((resolve) => {
    const unsub = o.subscribe({
      next: (v) => {
        resolve(v)
        unsub()
      },
    })
  })

const DAY = 86_400_000

const seedCycle = (over: Partial<Cycle> & { id: string }): Cycle => ({
  projectId: 'p1',
  name: over.id,
  startAt: 0,
  endAt: DAY,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const seedIssue = (over: Partial<Issue> & { id: string }): Issue => ({
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
  createdAt: 0,
  updatedAt: 0,
  order: 0,
  cycleId: null,
  ...over,
})

describe('dexie cycle repository', () => {
  let db: PMDatabase
  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
  })

  it('create 落库并带 id/时间戳', async () => {
    const repo = createDexieCycleRepository(db)
    const created = await repo.create({
      projectId: 'p1',
      name: 'Sprint 1',
      startAt: 100,
      endAt: 200,
      goal: '目标',
    })
    expect(created.id).toBeTruthy()
    expect(created.createdAt).toBeGreaterThan(0)
    expect((await db.cycles.get(created.id))?.goal).toBe('目标')
  })

  it('create 无 goal 时不落空字段', async () => {
    const repo = createDexieCycleRepository(db)
    const created = await repo.create({ projectId: 'p1', name: 'S', startAt: 0, endAt: 1 })
    expect('goal' in created).toBe(false)
  })

  it('liveAll 只给本项目周期，startAt 倒序，同 startAt 按 id 倒序', async () => {
    await db.cycles.bulkAdd([
      seedCycle({ id: 'a', startAt: 10 }),
      seedCycle({ id: 'b', startAt: 30 }),
      seedCycle({ id: 'c', startAt: 30 }),
      seedCycle({ id: 'other', projectId: 'p2', startAt: 99 }),
    ])
    const repo = createDexieCycleRepository(db)
    expect((await repo.all('p1')).map((c) => c.id)).toEqual(['c', 'b', 'a'])
    expect((await first(repo.liveAll('p1'))).map((c) => c.id)).toEqual(['c', 'b', 'a'])
  })

  it('全部项目作用域给跨项目并集', async () => {
    await db.cycles.bulkAdd([
      seedCycle({ id: 'a', startAt: 10 }),
      seedCycle({ id: 'other', projectId: 'p2', startAt: 50 }),
    ])
    const repo = createDexieCycleRepository(db)
    expect((await repo.all(ALL_PROJECTS)).map((c) => c.id)).toEqual(['other', 'a'])
  })

  it('liveAll 响应新增（liveQuery 订阅）', async () => {
    const repo = createDexieCycleRepository(db)
    const seen: number[] = []
    const unsub = repo.liveAll('p1').subscribe({ next: (v) => seen.push(v.length) })
    while (seen.length === 0) await new Promise((r) => setTimeout(r, 5))
    await db.cycles.add(seedCycle({ id: 'a' }))
    while (seen.length < 2) await new Promise((r) => setTimeout(r, 5))
    unsub()
    expect(seen.slice(0, 2)).toEqual([0, 1])
  })

  it('update 改字段并盖 updatedAt', async () => {
    await db.cycles.add(seedCycle({ id: 'a', updatedAt: 0 }))
    const repo = createDexieCycleRepository(db)
    await repo.update('a', { name: '改名', endAt: 500 })
    const row = await db.cycles.get('a')
    expect(row?.name).toBe('改名')
    expect(row?.endAt).toBe(500)
    expect(row?.updatedAt).toBeGreaterThan(0)
  })

  it('delete 解除 Issue 归属（不删 Issue）并盖 updatedAt', async () => {
    await db.cycles.add(seedCycle({ id: 'a' }))
    await db.issues.bulkAdd([
      seedIssue({ id: 'i1', cycleId: 'a' }),
      seedIssue({ id: 'i2', cycleId: 'a' }),
      seedIssue({ id: 'i3', cycleId: null }),
    ])
    const repo = createDexieCycleRepository(db)
    await repo.delete('a')
    expect(await db.cycles.get('a')).toBeUndefined()
    expect(await db.issues.count()).toBe(3)
    const rows = await db.issues.toArray()
    expect(rows.every((r) => r.cycleId === null)).toBe(true)
    // 只写原归属该周期的行：未受影响的 Issue 保持原 updatedAt（0）
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get('i1')?.updatedAt).toBeGreaterThan(0)
    expect(byId.get('i2')?.updatedAt).toBeGreaterThan(0)
    expect(byId.get('i3')?.updatedAt).toBe(0)
  })
})
