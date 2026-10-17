import type { IssuePriority, IssueStatus } from '@/types'

export const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}
/** 列表行 → oas-virtual-list 的 oas-item 渲染通道。
 *  行在组件 shadow 内，light DOM 样式表不生效——布局/配色全部 inline。 */
export const PRIORITY_TEXT: Record<IssuePriority, string> = {
  urgent: '#dc2626',
  high: '#d97706',
  medium: '#0b6cff',
  low: '#64748b',
}
export const STATUS_TEXT: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}
