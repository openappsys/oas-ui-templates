import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type Dexie from 'dexie'
import { nanoid } from 'nanoid'
import { db } from '../db/schema'
import type { Issue, IssuePriority, IssueStatus, Member } from '../types'
import { ISSUE_PRIORITIES, STATUS_LABEL } from '../types'
import { OSelect } from './oas-wrappers'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']

/** 批量操作浮条：选中集 → 批量改状态/优先级/负责人/删除（写活动历史） */
export function BulkBar({
  selectedIds,
  currentUser,
  onDone,
}: {
  selectedIds: Set<string>
  currentUser: string
  onDone: () => void
}) {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [assignee, setAssignee] = useState('__none__')
  const members = useLiveQuery(() => db.members.toArray(), [])

  if (selectedIds.size === 0) return null

  const apply = async () => {
    const now = Date.now()
    await db.transaction('rw', db.issues, db.activities, async () => {
      for (const id of selectedIds) {
        const patch: Partial<Issue> = { updatedAt: now }
        const acts: Array<Promise<unknown>> = []
        if (status) {
          acts.push(
            db.activities.add({
              id: nanoid(),
              issueId: id,
              actorId: currentUser,
              type: 'status',
              field: 'status',
              to: status,
              createdAt: now,
            }),
          )
          patch.status = status as IssueStatus
        }
        if (priority) {
          acts.push(
            db.activities.add({
              id: nanoid(),
              issueId: id,
              actorId: currentUser,
              type: 'priority',
              field: 'priority',
              to: priority,
              createdAt: now,
            }),
          )
          patch.priority = priority as IssuePriority
        }
        if (assignee !== '') {
          acts.push(
            db.activities.add({
              id: nanoid(),
              issueId: id,
              actorId: currentUser,
              type: 'assignee',
              field: 'assigneeId',
              to: assignee === '__none__' ? '' : assignee,
              createdAt: now,
            }),
          )
          patch.assigneeId = assignee === '__none__' ? null : assignee
        }
        await Promise.all(acts)
        await db.issues.update(id, patch)
      }
    })
    onDone()
  }

  const remove = async () => {
    await db.transaction('rw', db.issues, async () => {
      for (const id of selectedIds) await db.issues.delete(id)
    })
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
          ...STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s })),
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
  return useLiveQuery(() => db.savedViews.orderBy('name').toArray(), [])
}

export async function saveView(name: string, filters: unknown): Promise<void> {
  await db.savedViews.add({
    id: nanoid(),
    name,
    filters: JSON.stringify(filters),
    createdAt: Date.now(),
  })
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

export type { Issue, IssueStatus, Member, Dexie }
