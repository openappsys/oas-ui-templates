import { useState } from 'react'
import { useRepositories } from '@/data/context'
import type { Observer } from '@/data/observable'
import { useObservable } from '@/data/use-observable'
import { parseFilters } from '@/lib/filters'
import type { Action, Ctx } from '@/permission/policy'
import type { IssuePriority, IssueStatus, SavedView } from '../types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '../types'
import { statusLabel, t } from '@/i18n'
import { OSelect } from './oas-wrappers'

/** 批量操作浮条：选中集 → 批量改状态/优先级/负责人/删除（写活动历史） */
export function BulkBar({
  selectedIds,
  currentUser,
  onDone,
  can,
  onDeleted,
}: {
  selectedIds: Set<string>
  currentUser: string
  onDone: () => void
  can: (action: Action, ctx?: Ctx) => boolean
  /** 删除成功回调（id 列表）：宿主据此弹「撤销」条 */
  onDeleted?: (ids: string[]) => void
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
    const ids = [...selectedIds]
    await issuesRepo.bulkDelete(ids)
    onDeleted?.(ids)
    onDone()
  }

  return (
    <div className="bulk-bar" data-testid="bulk-bar">
      <span className="bulk-count">
        {t('bulkSelected').replace('{n}', String(selectedIds.size))}
      </span>
      <OSelect
        testid="bulk-status"
        value={status}
        options={[
          { label: t('bulkSetStatus'), value: '' },
          ...ISSUE_STATUSES.map((s) => ({ label: statusLabel(s), value: s })),
        ]}
        onChange={setStatus}
      />
      <OSelect
        testid="bulk-priority"
        value={priority}
        options={[
          { label: t('bulkSetPriority'), value: '' },
          ...ISSUE_PRIORITIES.map((p) => ({ label: p, value: p })),
        ]}
        onChange={setPriority}
      />
      <OSelect
        testid="bulk-assignee"
        value={assignee}
        options={[
          { label: t('bulkSetAssignee'), value: '' },
          { label: t('resourceUnassigned'), value: '__none__' },
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
        {t('apply')}
      </button>
      <button
        className="bulk-delete"
        type="button"
        data-testid="bulk-delete"
        onClick={() => void remove()}
      >
        {t('delete')}
      </button>
      <button className="bulk-cancel" type="button" data-testid="bulk-cancel" onClick={onDone}>
        {t('cancel')}
      </button>
    </div>
  )
}

/** 保存的视图（schema v4 savedViews 表）：侧栏列表 + 保存/应用/删除。
 *  旧视图存的是单值/null 结构：读取处统一归一为多选结构，写库仍只写新结构（不做数据迁移） */
export function useSavedViews() {
  const { savedViews } = useRepositories()
  return useObservable(() => {
    const source = savedViews.liveAll()
    return {
      subscribe(observer: Observer<SavedView[]>) {
        return source.subscribe({
          next: (rows) =>
            observer.next(
              rows.map((v) => {
                const normalized = parseFilters(v.filters)
                return normalized ? { ...v, filters: JSON.stringify(normalized) } : v
              }),
            ),
          error: (e) => observer.error?.(e),
        })
      },
    }
  }, [savedViews])
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
