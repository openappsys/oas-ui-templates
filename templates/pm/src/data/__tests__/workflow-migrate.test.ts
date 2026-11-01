import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieWorkflowStateRepository } from '@/data/dexie/workflow-state-repo'
import { createDexieIssueRepository } from '@/data/dexie/issue-repo'
import type { Issue } from '@/types'

/** 自定义工作流：删除状态前的引用迁移（migrateStatus）数据正确性 */
describe('workflow-state repo migrateStatus', () => {
  let db: PMDatabase
  let states: ReturnType<typeof createDexieWorkflowStateRepository>
  let issues: ReturnType<typeof createDexieIssueRepository>

  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
    await db.projects.bulkPut([
      { id: 'p1', name: 'P', key: 'P', description: '', leadId: 'm1', createdAt: 1000 },
    ])
    states = createDexieWorkflowStateRepository(db)
    issues = createDexieIssueRepository(db)
    await db.workflowStates.bulkPut([
      { id: 'st-todo', projectId: 'workspace', name: '待办', category: 'todo', order: 0 },
      { id: 'st-review', projectId: 'workspace', name: '复核中', category: 'started', order: 1 },
      { id: 'st-progress', projectId: 'workspace', name: '进行中', category: 'started', order: 2 },
      { id: 'st-done', projectId: 'workspace', name: '已完成', category: 'done', order: 3 },
    ])
  })

  const seedIssue = (over: Partial<Issue>): Issue => ({
    id: crypto.randomUUID(),
    projectId: 'p1',
    key: 'OAS-9',
    title: 't',
    description: '',
    status: 'st-review',
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

  it('migrateStatus 把 from 状态的全部 Issue 迁到 to', async () => {
    const a = await issues.create(seedIssue({}))
    const b = await issues.create(seedIssue({ status: 'st-progress' }))
    await states.migrateStatus('st-review', 'st-progress')
    expect((await issues.get(a.id))?.status).toBe('st-progress')
    expect((await issues.get(b.id))?.status).toBe('st-progress')
  })

  it('目标态不存在时抛错且不产生半迁移', async () => {
    const a = await issues.create(seedIssue({}))
    await expect(states.migrateStatus('st-review', 'st-ghost')).rejects.toThrow()
    expect((await issues.get(a.id))?.status).toBe('st-review')
  })
})
