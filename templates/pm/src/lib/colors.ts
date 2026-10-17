import type { IssuePriority, IssueStatus } from '@/types'

export const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: 'var(--pm-status-backlog)',
  todo: 'var(--pm-status-todo)',
  in_progress: 'var(--pm-status-in-progress)',
  done: 'var(--pm-status-done)',
  cancelled: 'var(--pm-status-cancelled)',
}
/** 列表行 → oas-virtual-list 的 oas-item 渲染通道。
 *  行在组件 shadow 内，light DOM 样式表不生效——布局/配色全部 inline。 */
export const PRIORITY_TEXT: Record<IssuePriority, string> = {
  urgent: 'var(--pm-priority-urgent)',
  high: 'var(--pm-priority-high)',
  medium: 'var(--pm-priority-medium)',
  low: 'var(--pm-priority-low)',
}
export const STATUS_TEXT: Record<IssueStatus, string> = {
  backlog: 'var(--pm-status-backlog)',
  todo: 'var(--pm-status-todo)',
  in_progress: 'var(--pm-status-in-progress)',
  done: 'var(--pm-status-done)',
  cancelled: 'var(--pm-status-cancelled)',
}
