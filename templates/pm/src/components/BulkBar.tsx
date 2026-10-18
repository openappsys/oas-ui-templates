import { useState } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Action, Ctx } from '@/permission/policy'
import type { IssuePriority, IssueStatus } from '../types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, STATUS_LABEL } from '../types'
import { OSelect } from './oas-wrappers'

/** 批量操作浮条：选中集 → 批量改状态/优先级/负责人/删除（写活动历史） */
export function BulkBar({
  selectedIds,
  currentUser,
  onDone,
  can,
}: {
  selectedIds: Set<string>
  currentUser: string
  onDone: () => void
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [assignee, setAssignee] = useState('__none__')
  const { issues: issuesRepo, members: membersRepo } = useRepositories()
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])

  if (!can('bulk:apply')) return null
  if (selectedIds.size === 0) return null

  const apply = async () => {
    const patch: { status?: IssueStatus; priority?: IssuePriority; assigneeId?: string | null } = {}
    if (status) patch.status = status as IssueStatus
    if (priority) patch.priority = priority as IssuePriority
    if (assignee !== '') patch.assigneeId = assignee === '__none__' ? null : assignee
    if (patch.status || patch.priority || patch.assigneeId !== undefined) {
      await issuesRepo.bulkApply([...selectedIds], patch, currentUser)
    }
    onDone()
  }

  const remove = async () => {
    await issuesRepo.bulkDelete([...selectedIds])
    onDone()
  }

  return (
    <div className="bulk-bar" data-testid="bulk-bar">
      <span className="bulk-count">已选 {selectedIds.size}</span>
      <OSelect
        testid="bulk-status"
        value={status}
        options={[
          { label: '改状态…', value: '' },
          ...ISSUE_STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s })),
        ]}
        onChange={setStatus}
      />
      <OSelect
        testid="bulk-priority"
        value={priority}
        options={[
          { label: '改优先级…', value: '' },
          ...ISSUE_PRIORITIES.map((p) => ({ label: p, value: p })),
        ]}
        onChange={setPriority}
      />
      <OSelect
        testid="bulk-assignee"
        value={assignee}
        options={[
          { label: '改负责人…', value: '' },
          { label: '未分配', value: '__none__' },
          ...(members ?? []).map((m) => ({ label: m.name, value: m.id })),
        ]}
        onChange={setAssignee}
      />
      <button
        className="bulk-apply"
        type="button"
        data-testid="bulk-apply"
        onClick={() => void apply()}
      >
        应用
      </button>
      <button
        className="bulk-delete"
        type="button"
        data-testid="bulk-delete"
        onClick={() => void remove()}
      >
        删除
      </button>
      <button className="bulk-cancel" type="button" data-testid="bulk-cancel" onClick={onDone}>
        取消
      </button>
    </div>
  )
}

/** 保存的视图（schema v4 savedViews 表）：侧栏列表 + 保存/应用/删除 */
export function useSavedViews() {
  const { savedViews } = useRepositories()
  return useObservable(() => savedViews.liveAll(), [savedViews])
}

export function filtersKey(f: Record<string, unknown>): string {
  return JSON.stringify([
    f.projectId,
    f.statusFilter,
    f.assigneeFilter,
    f.priorityFilter,
    f.myOnly,
    f.sortBy,
  ])
}
