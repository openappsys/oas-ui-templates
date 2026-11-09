import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieMilestoneRepository } from '@/data/dexie/milestone-repo'
import type { Issue } from '@/types'

/** 里程碑仓库：删除解绑语义（与 cycle-repo/mock 端同口径） */
describe('milestone repo', () => {
  let db: PMDatabase
  let milestones: ReturnType<typeof createDexieMilestoneRepository>

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
    await db.projects.put({
      id: 'p1',
      name: 'P',
      key: 'P',
      description: '',
      leadId: 'm1',
      createdAt: 1000,
    })
    await db.milestones.bulkPut([
      { id: 'ms-1', projectId: 'p1', name: 'M1', dueAt: null, createdAt: 1000 },
      { id: 'ms-2', projectId: 'p1', name: 'M2', dueAt: null, createdAt: 1000 },
    ])
    milestones = createDexieMilestoneRepository(db)
  })

  it('delete 解除归属而不是连带消失：Issue 退回「无里程碑」', async () => {
    // bulkPut 直存：issue-repo.create 按字段白名单构建，不落 milestoneId
    await db.issues.bulkPut([
      seedIssue({ id: 'i-bound', milestoneId: 'ms-1' }),
      seedIssue({ id: 'i-other', milestoneId: 'ms-2' }),
    ])
    await milestones.delete('ms-1')
    expect(await db.milestones.get('ms-1')).toBeUndefined()
    expect((await db.issues.get('i-bound'))?.milestoneId).toBeNull()
    expect((await db.issues.get('i-bound'))?.updatedAt).toBeGreaterThan(1000)
    // 其它里程碑的归属不受影响
    expect((await db.issues.get('i-other'))?.milestoneId).toBe('ms-2')
  })

  it('all/live 按 dueAt 升序、无日期殿后', async () => {
    await db.milestones.bulkPut([
      { id: 'ms-3', projectId: 'p1', name: '有日期', dueAt: 500, createdAt: 1000 },
      { id: 'ms-4', projectId: 'p1', name: '更远', dueAt: 900, createdAt: 1000 },
    ])
    const rows = await milestones.all('p1')
    expect(rows.map((r) => r.id)).toEqual(['ms-3', 'ms-4', 'ms-1', 'ms-2'])
  })
})
