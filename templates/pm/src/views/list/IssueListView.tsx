import { useState, useCallback, useMemo } from 'react'
import type { Issue, IssuePriority, Member } from '@/types'
import { ISSUE_PRIORITIES } from '@/types'
import { OSelect, OCheckbox } from '@/components/oas-wrappers'
import { t } from '@/i18n'
import { BulkBar } from '@/components/BulkBar'
import { Avatar } from '@/components/Avatar'
import type { Action, Ctx } from '@/permission/policy'
import { GROUP_PREVIEW, type Filters, type SortBy, type Grouping } from '@/lib/filters'
import { VirtualIssueList } from './VirtualIssueList'

/* ── Issue 列表（筛选/排序/分组工具条） ── */
export function IssueListView({
  issues,
  total,
  filters,
  setFilters,
  grouping,
  setGrouping,
  memberMap,
  onSelect,
  onSaveView,
  currentUser,
  can,
}: {
  issues: Issue[]
  total: number
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  grouping: Grouping
  setGrouping: (g: Grouping) => void
  memberMap: Map<string, Member>
  onSelect: (id: string) => void
  onSaveView: () => void
  currentUser: string
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const canBulk = can('bulk:apply')
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const groups = useMemo(() => {
    if (grouping === 'none') return null
    const map = new Map<string, Issue[]>()
    for (const i of issues) {
      const k = grouping === 'priority' ? i.priority : (i.assigneeId ?? '未分配')
      const arr = map.get(k) ?? []
      arr.push(i)
      map.set(k, arr)
    }
    return [...map.entries()]
  }, [issues, grouping])

  const rowEl = (i: Issue) => (
    <div
      key={i.id}
      className="issue-row"
      role="button"
      tabIndex={0}
      style={{
        display: 'grid',
        gridTemplateColumns: canBulk ? '18px 110px 1fr 24px 70px 90px' : '110px 1fr 24px 70px 90px',
        alignItems: 'center',
        gap: 12,
        height: 44,
        padding: '0 16px',
      }}
      onClick={() => onSelect(i.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(i.id)
      }}
    >
      {canBulk && (
        <OCheckbox
          className="row-check"
          testid="row-check"
          checked={selectedIds.has(i.id)}
          onChange={() => toggleSelect(i.id)}
        />
      )}
      <span className="issue-key">{i.key}</span>
      <span className="issue-title">{i.title}</span>
      <Avatar member={memberMap.get(i.assigneeId ?? '')} size={18} />
      <span className={`issue-priority pri-${i.priority}`}>{i.priority}</span>
      <span className={`issue-status st-${i.status}`}>{i.status}</span>
    </div>
  )

  return (
    <div className="issue-page">
      <div className="issue-header">
        <h1>Issues</h1>
        <span className="issue-total" data-testid="issue-total">
          {total.toLocaleString()} 条{total > issues.length ? `（窗口 ${issues.length} 条）` : ''}
        </span>
      </div>
      <div className="issue-toolbar" data-testid="issue-toolbar">
        <span className="issue-toolbar-label">{t('sort')}</span>
        <OSelect
          testid="sort-by"
          value={filters.sortBy}
          options={[
            { label: '最近更新', value: 'updatedAt' },
            { label: '优先级', value: 'priority' },
            { label: '创建时间', value: 'createdAt' },
          ]}
          onChange={(v) => setFilters((prev) => ({ ...prev, sortBy: v as SortBy }))}
        />
        <span className="issue-toolbar-label">{t('group')}</span>
        <OSelect
          testid="group-by"
          value={grouping}
          options={[
            { label: '不分组', value: 'none' },
            { label: '按优先级', value: 'priority' },
            { label: '按负责人', value: 'assignee' },
          ]}
          onChange={(v) => setGrouping(v as Grouping)}
        />
        <span className="issue-toolbar-label">{t('priority')}</span>
        <OSelect
          testid="filter-priority"
          value={filters.priorityFilter ?? 'all'}
          options={[
            { label: '全部', value: 'all' },
            ...ISSUE_PRIORITIES.map((p) => ({ label: p, value: p })),
          ]}
          onChange={(v) =>
            setFilters((prev) => ({
              ...prev,
              priorityFilter: (v === 'all' ? null : v) as IssuePriority | null,
            }))
          }
        />
        {(filters.search || filters.assigneeFilter || filters.priorityFilter || filters.myOnly) && (
          <button
            className="issue-toolbar-clear"
            type="button"
            data-testid="filter-clear"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                search: '',
                assigneeFilter: null,
                priorityFilter: null,
                myOnly: false,
              }))
            }
          >
            {t('clearFilters')}
          </button>
        )}
        {can('view:save') && (
          <button
            className="issue-toolbar-clear"
            type="button"
            data-testid="save-view-btn"
            onClick={onSaveView}
          >
            {t('saveView')}
          </button>
        )}
      </div>
      <div className="issue-thead">
        <span>{t('key')}</span>
        <span>{t('title')}</span>
        <span>{t('assignee')}</span>
        <span>{t('priority')}</span>
        <span>{t('status')}</span>
      </div>
      {groups ? (
        <div className="issue-scroll">
          {groups.map(([k, arr]) => (
            <div key={k} className="issue-group">
              <p className="issue-group-title">
                {k} <oas-badge>{String(arr.length)}</oas-badge>
              </p>
              {arr.slice(0, GROUP_PREVIEW).map(rowEl)}
              {arr.length > GROUP_PREVIEW && (
                <p className="board-col-more">组内还有 {arr.length - GROUP_PREVIEW} 条未显示</p>
              )}
            </div>
          ))}
          {groups.length === 0 && (
            <oas-empty description="无匹配 Issue" data-testid="issues-empty" />
          )}
        </div>
      ) : (
        <VirtualIssueList
          issues={issues}
          onSelect={onSelect}
          memberMap={memberMap}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          showCheckbox={canBulk}
        />
      )}
      <BulkBar
        selectedIds={selectedIds}
        currentUser={currentUser}
        onDone={clearSelection}
        can={can}
      />
    </div>
  )
}
