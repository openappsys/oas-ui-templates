import type { IssuePriority, IssueStatus } from '@/types'

export type SortBy = 'updatedAt' | 'priority' | 'createdAt'
export type Grouping = 'none' | 'priority' | 'assignee'

export interface Filters {
  projectId: string
  statusFilter: IssueStatus | null
  assigneeFilter: string | null
  priorityFilter: IssuePriority | null
  search: string
  myOnly: boolean
  sortBy: SortBy
}

export const DEFAULT_FILTERS: Filters = {
  projectId: 'project-1',
  statusFilter: null,
  assigneeFilter: null,
  priorityFilter: null,
  search: '',
  myOnly: false,
  sortBy: 'updatedAt',
}

export const LIST_WINDOW = 500
export const GROUP_PREVIEW = 30
