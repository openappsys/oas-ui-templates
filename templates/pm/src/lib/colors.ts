import type { IssuePriority, IssueStatus } from '@/types'

/**
 * 头像底色盘：全部取 700 档。
 * oas-avatar 的 on-color 按「亮度 > 0.35 用深色字，否则白字」二选一，500–600 档（如 #d97706 3.19、
 * #059669 3.77）配白字达不到 WCAG AA 4.5，且该档位又不足以触发深色字——只能由色板侧避开。
 */
export const AVATAR_PALETTE = [
  '#0b6cff',
  '#7c3aed',
  '#047857',
  '#b45309',
  '#dc2626',
  '#0e7490',
  '#be185d',
  '#4f46e5',
] as const

/** 未分配占位头像：中性深灰，白字比值 7.73（明暗主题都不依赖主题变量） */
export const AVATAR_UNASSIGNED = '#52525b'

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
