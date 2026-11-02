import { nanoid } from 'nanoid'
import type { WorkflowState } from '@/types'
import type { WorkflowStateRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import { DEFAULT_WORKFLOW_STATES } from '@/lib/workflow'

/** 默认工作流 id：v17 迁移与空库播种共用（跨版本稳定） */
export const DEFAULT_WORKFLOW_ID = 'wf-default'

/** 按 projectId 解析工作流：ALL_PROJECTS/未绑定 → 默认工作流；否则找绑定记录，未命中回落默认 */
async function resolveWorkflow(db: PMDatabase, projectId: string) {
  const all = await db.workflows.toArray()
  const bound = projectId === '' || projectId === '__all__' ? undefined : all.find((w) => w.projectId === projectId)
  return bound ?? all.find((w) => w.projectId === null) ?? bound
}

export function createDexieWorkflowStateRepository(db: PMDatabase): WorkflowStateRepository {
  // 播种：空库建默认工作流 + 内置 5 态（挂默认工作流）。bulkPut 幂等——与 seed-db 并发不冲突
  const ensureDefaults = async () => {
    await db.workflows.bulkPut([{ id: DEFAULT_WORKFLOW_ID, name: '默认工作流', projectId: null, order: 0 }])
    if ((await db.workflowStates.count()) > 0) return
    await db.workflowStates.bulkPut(
      DEFAULT_WORKFLOW_STATES.map((d) => ({
        ...d,
        projectId: 'workspace',
        workflowId: DEFAULT_WORKFLOW_ID,
      })),
    )
  }
  const statesOf = async (projectId: string) => {
    await ensureDefaults()
    const wf = await resolveWorkflow(db, projectId)
    if (!wf) return []
    return db.workflowStates.where('workflowId').equals(wf.id).toArray()
  }
  // liveQuery 只读上下文：查询本身不写；播种由 void 异步触发（首次空→播种→下次 live 有数据）
  const statesRead = async (projectId: string) => {
    const wf = await resolveWorkflow(db, projectId)
    if (!wf) return []
    return db.workflowStates.where('workflowId').equals(wf.id).toArray()
  }
  return {
    live(projectId: string) {
      void ensureDefaults()
      return fromLiveQuery(() => statesRead(projectId))
    },
    async all(projectId: string) {
      return statesOf(projectId)
    },
    liveByWorkflow(workflowId: string) {
      void ensureDefaults()
      return fromLiveQuery(() =>
        db.workflowStates.where('workflowId').equals(workflowId).toArray(),
      )
    },
    ensureDefaults: async () => ensureDefaults(),
    async create(input) {
      await ensureDefaults()
      const wf =
        input.workflowId != null
          ? await db.workflows.get(input.workflowId)
          : await resolveWorkflow(db, input.projectId)
      if (!wf) throw new Error('workflow not found')
      const state: WorkflowState = {
        id: nanoid(),
        order: Date.now(),
        color: undefined,
        ...input,
        workflowId: wf.id,
        // 状态归属工作流：projectId 入参仅为接口兼容，不落语义
        projectId: 'workspace',
      }
      await db.workflowStates.add(state)
      return state
    },
    async update(id, changes) {
      await db.workflowStates.update(id, changes)
    },
    async delete(id) {
      await db.workflowStates.delete(id)
    },
    async reorder(orderedIds) {
      await Promise.all(orderedIds.map((id, i) => db.workflowStates.update(id, { order: i })))
    },
    async migrateStatus(from, to) {
      // 目标必须存在（防静默半迁移）；管理操作低频：filter 全表扫描可接受
      const toState = await db.workflowStates.get(to)
      if (!toState) throw new Error(`migrate target not found: ${to}`)
      await db.issues.filter((i) => i.status === from).modify({ status: to })
    },
  }
}
