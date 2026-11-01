import { useObservableState } from '@/data/use-observable'
import { useRepositories } from '@/data/context'
import type { WorkflowState } from '@/types'
import { CATEGORY_TONE, DEFAULT_WORKFLOW_STATES, statusName as fallbackName } from './workflow'
import { STATUS_COLOR } from './colors'
import { statusLabel } from '@/i18n'

export type WorkflowStates = WorkflowState[]

/** 项目工作流状态（live，按 order 升序）。未加载完成时回退内置五态，
 *  保证看板列/筛选/抽屉选择器首帧不空 */
export function useWorkflowStates(projectId: string): WorkflowStates {
  const repos = useRepositories()
  const { value } = useObservableState(
    () => repos.workflowStates.live(projectId),
    [repos.workflowStates, projectId],
  )
  if (!value || value.length === 0) {
    return DEFAULT_WORKFLOW_STATES.map((s) => ({ ...s, projectId }))
  }
  return [...value].sort((a, b) => a.order - b.order)
}

/** 内置五态 id（走 i18n 多语言词汇；改名后走管理员输入的原名） */
const BUILTIN_IDS = new Set(DEFAULT_WORKFLOW_STATES.map((s) => s.id))

export function workflowStateLabel(state: Pick<WorkflowState, 'id' | 'name'>): string {
  const def = DEFAULT_WORKFLOW_STATES.find((d) => d.id === state.id)
  if (def && state.name === def.name) return statusLabel(state.id)
  return state.name
}

/** 兼容旧调用点：只有 id 时（如活动流 a.to）直接走 i18n 内置词典 */
export const statusDisplayLabel = statusLabel

/** 状态展示色：管理员配色优先，内置态回落主题色板，自定义态按类别兜底 */
export function workflowStateColor(
  state: Pick<WorkflowState, 'id' | 'color' | 'category'>,
): string {
  if (state.color) return state.color
  if (BUILTIN_IDS.has(state.id)) {
    const c = (STATUS_COLOR as Record<string, string>)[state.id]
    if (c) return c
  }
  return CATEGORY_TONE[state.category]
}

export { fallbackName }

/** 状态是否属于「完成」类（替代散落的 === 'done' 判断，燃尽/completedAt 语义跟着类别走） */
/** 时间线进度派生：按类别（done 100 / started 50 / 其余 0）——自定义状态同样适用 */
export const PROGRESS_BY_CATEGORY = {
  todo: 0,
  started: 50,
  done: 100,
  cancelled: 0,
} as const
export const progressOfCategory = (cat: WorkflowState['category'] | undefined): number =>
  (cat && PROGRESS_BY_CATEGORY[cat]) ?? 0

export const isDoneCategory = (state: Pick<WorkflowState, 'category'> | undefined): boolean =>
  state?.category === 'done'
