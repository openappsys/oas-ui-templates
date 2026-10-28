import type { WorkflowState } from '@/types'

/** 内置工作流状态（工作区级一套，全项目共用——与 labels 设置同层级）。
 *  id 与历史 IssueStatus 一致，存量 Issue.status 无缝匹配；管理员改名/加状态后
 *  仍然全项目生效。Dexie workflow-state-repo 与 mock-server 共用，保证两种数据源同形 */
export const DEFAULT_WORKFLOW_STATES: Array<{
  id: string
  name: string
  category: WorkflowState['category']
  order: number
}> = [
  { id: 'backlog', name: '待规划', category: 'todo', order: 0 },
  { id: 'todo', name: '待办', category: 'todo', order: 1 },
  { id: 'in_progress', name: '进行中', category: 'started', order: 2 },
  { id: 'done', name: '已完成', category: 'done', order: 3 },
  { id: 'cancelled', name: '已取消', category: 'cancelled', order: 4 },
]

/** 按 id 查状态名（未知 id 原样返回，兜底自定义状态尚未加载完成的首帧） */
export function statusName(
  states: Array<Pick<WorkflowState, 'id' | 'name'>> | undefined,
  id: string,
): string {
  return states?.find((s) => s.id === id)?.name ?? id
}

/** 状态类别 → 展示色调（沿用原 IssueStatus 五档语义，未配色时按类别兜底） */
export const CATEGORY_TONE: Record<WorkflowState['category'], string> = {
  todo: 'var(--oas-text-muted, #64748b)',
  started: '#2563eb',
  done: '#16a34a',
  cancelled: '#94a3b8',
}
