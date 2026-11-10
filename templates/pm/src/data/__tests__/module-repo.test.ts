import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieModuleRepository } from '@/data/dexie/module-repo'
import type { Issue } from '@/types'

/** 模块仓库（v18）：项目内归类容器——CRUD/重名校验/删除解绑/计数 */
describe('module repo', () => {
  let db: PMDatabase
  let modules: ReturnType<typeof createDexieModuleRepository>

  const seedIssue = (over: Partial<Issue>): Issue => ({
    id: crypto.randomUUID(),
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
  })

  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
    await db.projects.bulkPut([
      { id: 'p1', name: 'P', key: 'P', description: '', leadId: 'm1', createdAt: 1000 },
      { id: 'p2', name: 'Q', key: 'Q', description: '', leadId: 'm1', createdAt: 1000 },
    ])
    modules = createDexieModuleRepository(db)
  })

  it('create：trim 名称、同项目重名拒绝、跨项目同名允许', async () => {
    const m = await modules.create({ projectId: 'p1', name: '  核心服务  ' })
    expect(m.name).toBe('核心服务')
    await expect(modules.create({ projectId: 'p1', name: '核心服务' })).rejects.toThrow()
    await expect(modules.create({ projectId: 'p1', name: '  ' })).rejects.toThrow()
    await expect(modules.create({ projectId: 'p2', name: '核心服务' })).resolves.toBeTruthy()
  })

  it('update：改名 trim + 重名校验（排除自身）', async () => {
    const a = await modules.create({ projectId: 'p1', name: 'A' })
    await modules.create({ projectId: 'p1', name: 'B' })
    await modules.update(a.id, { name: ' A2 ' })
    expect((await modules.get(a.id))?.name).toBe('A2')
    await expect(modules.update(a.id, { name: 'B' })).rejects.toThrow()
    // 改回自己原名不冲突
    await modules.update(a.id, { name: 'A' })
  })

  it('delete：解除归属而不是连带消失，同事务', async () => {
    const m = await modules.create({ projectId: 'p1', name: '核心服务' })
    await db.issues.bulkPut([
      seedIssue({ id: 'i1', moduleId: m.id }),
      seedIssue({ id: 'i2', moduleId: m.id }),
      seedIssue({ id: 'i3', moduleId: null }),
    ])
    await modules.delete(m.id)
    expect(await db.modules.get(m.id)).toBeUndefined()
    expect((await db.issues.get('i1'))?.moduleId).toBeNull()
    expect((await db.issues.get('i1'))?.updatedAt).toBeGreaterThan(1000)
    // issue 行不被删除
    expect(await db.issues.get('i2')).toBeTruthy()
  })

  it('排序：order 缺省回落名称序；reorder 按给定序列重排；create 缺省追加末尾', async () => {
    // 旧行无 order（模拟 v18 备份导入）→ 名称序
    await db.modules.bulkPut([
      { id: 'm-z', projectId: 'p1', name: '斑马', createdAt: 1000 },
      { id: 'm-a', projectId: 'p1', name: '阿尔法', createdAt: 1000 },
    ])
    const fallback = await modules.all('p1')
    expect(fallback.map((m) => m.name)).toEqual(['阿尔法', '斑马'])
    // reorder：斑马提前 → order 按下标重写
    await modules.reorder(['m-z', 'm-a'])
    const reordered = await modules.all('p1')
    expect(reordered.map((m) => m.id)).toEqual(['m-z', 'm-a'])
    expect((await modules.get('m-z'))?.order).toBe(0)
    // create 缺省追加到末尾（max(order)+1）
    const created = await modules.create({ projectId: 'p1', name: '尾模块' })
    expect(created.order).toBe(2)
    const after = await modules.all('p1')
    expect(after.map((m) => m.id)).toEqual(['m-z', 'm-a', created.id])
  })

  it('liveModuleCounts：按模块聚合计数，软删行不计', async () => {
    const a = await modules.create({ projectId: 'p1', name: 'A' })
    const b = await modules.create({ projectId: 'p1', name: 'B' })
    await db.issues.bulkPut([
      seedIssue({ id: 'i1', moduleId: a.id }),
      seedIssue({ id: 'i2', moduleId: a.id, deletedAt: 5000 }),
      seedIssue({ id: 'i3', moduleId: b.id }),
    ])
    const counts = await new Promise<Array<{ moduleId: string; total: number }>>((res) => {
      const sub = modules.liveModuleCounts('p1').subscribe({
        next: (v) => {
          sub()
          res(v)
        },
      })
    })
    expect(counts.find((x) => x.moduleId === a.id)?.total).toBe(1)
    expect(counts.find((x) => x.moduleId === b.id)?.total).toBe(1)
    // 全部项目作用域：跨项目聚合
    const all = await new Promise<Array<{ moduleId: string; total: number }>>((res) => {
      const sub = modules.liveModuleCounts('__all__').subscribe({
        next: (v) => {
          sub()
          res(v)
        },
      })
    })
    expect(all.length).toBe(2)
  })
})
