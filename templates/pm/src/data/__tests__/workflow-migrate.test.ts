import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { PMDatabase } from '@/db/schema'
import { createDexieWorkflowStateRepository } from '@/data/dexie/workflow-state-repo'
import { createDexieWorkflowRepository } from '@/data/dexie/workflow-repo'
import { createDexieIssueRepository } from '@/data/dexie/issue-repo'
import type { Issue } from '@/types'

/** 多工作流：状态删除迁移 + 项目→工作流解析（v17） */
describe('workflow repos（多工作流）', () => {
  let db: PMDatabase
  let states: ReturnType<typeof createDexieWorkflowStateRepository>
  let workflows: ReturnType<typeof createDexieWorkflowRepository>
  let issues: ReturnType<typeof createDexieIssueRepository>

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

  beforeEach(async () => {
    db = new PMDatabase(`test-${crypto.randomUUID()}`)
    await db.open()
    await db.projects.bulkPut([
      { id: 'p1', name: 'P', key: 'P', description: '', leadId: 'm1', createdAt: 1000 },
      { id: 'p2', name: 'Q', key: 'Q', description: '', leadId: 'm1', createdAt: 1000 },
    ])
    states = createDexieWorkflowStateRepository(db)
    workflows = createDexieWorkflowRepository(db)
    issues = createDexieIssueRepository(db)
    // 默认工作流 5 态 + p2 绑定工作流（开发流程）1 态
    await db.workflows.bulkPut([
      { id: 'wf-default', name: '默认工作流', projectId: null, order: 0 },
      { id: 'wf-dev', name: '开发流程', projectId: 'p2', order: 1 },
    ])
    await db.workflowStates.bulkPut([
      {
        id: 'st-todo',
        projectId: 'workspace',
        name: '待办',
        category: 'todo',
        order: 0,
        workflowId: 'wf-default',
      },
      {
        id: 'st-review',
        projectId: 'workspace',
        name: '复核中',
        category: 'started',
        order: 1,
        workflowId: 'wf-default',
      },
      {
        id: 'st-progress',
        projectId: 'workspace',
        name: '进行中',
        category: 'started',
        order: 2,
        workflowId: 'wf-default',
      },
      {
        id: 'st-done',
        projectId: 'workspace',
        name: '已完成',
        category: 'done',
        order: 3,
        workflowId: 'wf-default',
      },
      {
        id: 'st-code',
        projectId: 'workspace',
        name: '编码中',
        category: 'started',
        order: 0,
        workflowId: 'wf-dev',
      },
    ])
  })

  it('all(projectId) 按绑定工作流解析：p2 → 开发流程、p1 → 默认', async () => {
    const p2 = await states.all('p2')
    const p1 = await states.all('p1')
    expect(p2.map((s) => s.id)).toEqual(['st-code'])
    expect(p1.some((s) => s.id === 'st-todo')).toBe(true)
    expect(p1.some((s) => s.id === 'st-code')).toBe(false)
  })

  it('未绑定项目与全部视图 → 默认工作流', async () => {
    const all = await states.all('__all__')
    expect(all.some((s) => s.id === 'st-todo')).toBe(true)
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

  it('workflows：绑定唯一 + 删除保护', async () => {
    await expect(workflows.create({ name: '重复绑定', projectId: 'p2' })).rejects.toThrow()
    await expect(workflows.remove('wf-default')).rejects.toThrow()
    await expect(workflows.remove('wf-dev')).rejects.toThrow() // p2 仍绑定
    await workflows.update('wf-dev', { projectId: null }) // 解绑
    await workflows.remove('wf-dev') // 未绑定可删
    expect((await workflows.all()).map((w) => w.id)).toEqual(['wf-default'])
  })
})
