import { nanoid } from 'nanoid'
import type { WorkflowState } from '@/types'
import type { WorkflowStateRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import { DEFAULT_WORKFLOW_STATES } from '@/lib/workflow'

export function createDexieWorkflowStateRepository(db: PMDatabase): WorkflowStateRepository {
  // 工作区级一套（id 全局唯一，无 per-project 冲突）；projectId 入参保留接口兼容
  const ensureDefaults = async (_projectId: string) => {
    if ((await db.workflowStates.count()) > 0) return
    await db.workflowStates.bulkPut(
      DEFAULT_WORKFLOW_STATES.map((d) => ({ ...d, projectId: 'workspace' })),
    )
  }
  return {
    live(_projectId: string) {
      // 首次进入无数据时同步播种一次（live 本身保持纯 Observable，不 await）
      void ensureDefaults('')
      return fromLiveQuery(() => db.workflowStates.toArray())
    },
    async all(_projectId: string) {
      await ensureDefaults('')
      return db.workflowStates.toArray()
    },
    ensureDefaults,
    async create(input) {
      const state: WorkflowState = {
        id: nanoid(),
        order: Date.now(),
        color: undefined,
        ...input,
        // 状态是工作区级：create 传入的 projectId 一律不落库
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
