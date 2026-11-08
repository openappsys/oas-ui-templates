import { nanoid } from 'nanoid'
import type { Workflow } from '@/types'
import type { WorkflowRepository } from '@/data/types'
import type { PMDatabase } from '@/db/schema'
import { fromLiveQuery } from '@/data/observable'
import { DEFAULT_WORKFLOW_ID } from '@/data/dexie/workflow-state-repo'

/** 多工作流容器管理：一个项目至多绑一个工作流；projectId: null = 默认工作流（跨项目/未绑定兜底） */
export function createDexieWorkflowRepository(db: PMDatabase): WorkflowRepository {
  return {
    live() {
      return fromLiveQuery(() => db.workflows.orderBy('order').toArray())
    },
    async all() {
      return db.workflows.orderBy('order').toArray()
    },
    async create(input) {
      if (
        input.projectId != null &&
        (await db.workflows.where('projectId').equals(input.projectId).count()) > 0
      ) {
        throw new Error('项目已绑定工作流')
      }
      const wf: Workflow = {
        id: nanoid(),
        projectId: input.projectId,
        order: input.order ?? (await db.workflows.count()),
        name: input.name,
      }
      await db.workflows.add(wf)
      return wf
    },
    async update(id, changes) {
      if (changes.projectId != null) {
        const dup = await db.workflows
          .where('projectId')
          .equals(changes.projectId)
          .filter((w) => w.id !== id)
          .count()
        if (dup > 0) throw new Error('项目已绑定工作流')
      }
      await db.workflows.update(id, changes)
    },
    async remove(id) {
      if (id === DEFAULT_WORKFLOW_ID) throw new Error('默认工作流不可删除')
      const bound = await db.projects
        .where('id')
        .equals((await db.workflows.get(id))?.projectId ?? '')
        .count()
      if (bound > 0) throw new Error('工作流仍绑定项目，先解绑')
      await db.workflows.delete(id)
      // 其状态一并清理（调用方已在迁移引用后执行）
      await db.workflowStates.where('workflowId').equals(id).delete()
    },
  }
}
