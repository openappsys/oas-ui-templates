import type { IssuePriority, IssueStatus } from '@/types'

/**
 * 头像底色盘：主体取 700 档 + 两个中间色样例。
 * 上游 2.6.4 起 oas-avatar 的 on-color 按 WCAG 对比度在黑/白字间择优（不再是固定 0.35 亮度
 * 阈值二选一），`#ff6b00` / `#16a34a` 这类「白字不够 4.5、旧阈值又只会给白字」的中间色
 * 由组件自动改配深色字（黑字 7.37 / 6.37）——色板刻意保留两个中间色验证该行为。
 */
export const AVATAR_PALETTE = [
  '#0b6cff',
  '#7c3aed',
  '#ff6b00',
  '#047857',
  '#16a34a',
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
