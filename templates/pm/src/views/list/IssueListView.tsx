import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Issue, IssuePriority, Member } from '@/types'
import { ISSUE_PRIORITIES } from '@/types'
import { OSelect, OCheckbox } from '@/components/oas-wrappers'
import { t, getLang, priorityLabel, statusLabel } from '@/i18n'
import { BulkBar } from '@/components/BulkBar'
import { Avatar } from '@/components/Avatar'
import { ListSkeleton } from '@/components/skeletons/ListSkeleton'
import type { Action, Ctx } from '@/permission/policy'
import { GROUP_PREVIEW, type Filters, type SortBy, type Grouping } from '@/lib/filters'
import { isOverlayOpen, registerKey } from '@/lib/keyboard'
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
  navActive,
  onNearBottom,
}: {
  issues: Issue[] | undefined
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
  navActive: boolean
  onNearBottom: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [cursorIndex, setCursorIndex] = useState(-1)
  const list = issues ?? []
  const loading = issues === undefined
  const hasActiveFilter =
    filters.statusFilter.length > 0 ||
    filters.assigneeFilter.length > 0 ||
    filters.priorityFilter.length > 0 ||
    filters.cycleFilter !== null ||
    filters.search !== '' ||
    filters.myOnly
  const emptyText = hasActiveFilter ? t('emptyNoMatch') : t('emptyNoData')
  // 工具条优先级下拉是单值入口（多选主入口在侧栏）：多选时显示「已选 N 项」，
  // 一旦在此改动即收敛为单值/全部
  const priorityCount = filters.priorityFilter.length
  const priorityValue =
    priorityCount === 1 ? filters.priorityFilter[0] : priorityCount > 1 ? 'multi' : 'all'
  const priorityOptions = [
    { label: t('all'), value: 'all' },
    ...ISSUE_PRIORITIES.map((p) => ({ label: priorityLabel(p), value: p })),
    ...(priorityCount > 1
      ? [{ label: t('multiSelected').replace('{n}', String(priorityCount)), value: 'multi' }]
      : []),
  ]
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

  const navRef = useRef({ navActive, issues: list, cursorIndex, onSelect, can, toggleSelect })
  navRef.current = { navActive, issues: list, cursorIndex, onSelect, can, toggleSelect }

  useEffect(() => {
    setCursorIndex((i) => Math.min(i, list.length - 1))
  }, [list])

  useEffect(() => {
    const whenNav = () => navRef.current.navActive && !isOverlayOpen()
    const unsubs = [
      registerKey(
        'j',
        (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return
          e.preventDefault()
          const len = navRef.current.issues.length
          if (len === 0) return
          setCursorIndex((i) => Math.min(i + 1, len - 1))
        },
        whenNav,
      ),
      registerKey(
        'k',
        (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return
          e.preventDefault()
          const len = navRef.current.issues.length
          if (len === 0) return
          setCursorIndex((i) => Math.max(i - 1, 0))
        },
        whenNav,
      ),
      registerKey(
        'Enter',
        (e) => {
          const { issues: list, cursorIndex: idx, onSelect: open } = navRef.current
          const target = list[idx]
          if (!target) return
          e.preventDefault()
          open(target.id)
        },
        whenNav,
      ),
      registerKey(
        'x',
        (e) => {
          const {
            issues: list,
            cursorIndex: idx,
            can: check,
            toggleSelect: toggle,
          } = navRef.current
          const target = list[idx]
          if (!target || !check('bulk:apply')) return
          e.preventDefault()
          toggle(target.id)
        },
        whenNav,
      ),
    ]
    return () => {
      for (const u of unsubs) u()
    }
  }, [])

  const unassignedLabel = t('resourceUnassigned')
  const groups = useMemo(() => {
    if (grouping === 'none') return null
    const map = new Map<string, Issue[]>()
    for (const i of list) {
      const k = grouping === 'priority' ? i.priority : (i.assigneeId ?? unassignedLabel)
      const arr = map.get(k) ?? []
      arr.push(i)
      map.set(k, arr)
    }
    return [...map.entries()]
  }, [list, grouping, unassignedLabel])

  const cursorId = cursorIndex >= 0 && cursorIndex < list.length ? list[cursorIndex].id : null

  const rowEl = (i: Issue) => (
    // biome-ignore lint/a11y/useSemanticElements: 行内嵌多选框等交互子元素，不能换 <button>（button 不可嵌套交互控件）
    <div
      key={i.id}
      className={`issue-row${i.id === cursorId ? ' is-cursor' : ''}`}
      role="button"
      tabIndex={0}
      style={{
        display: 'grid',
        gridTemplateColumns: canBulk
          ? '22px 110px minmax(0, 1fr) 24px 70px 90px'
          : '110px minmax(0, 1fr) 24px 70px 90px',
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
      <span className={`issue-status st-${i.status}`}>{statusLabel(i.status)}</span>
    </div>
  )

  return (
    <div className="issue-page">
      <div className="issue-header">
        <h1>Issues</h1>
        <span className="issue-total" data-testid="issue-total">
          {loading
            ? '…'
            : total > list.length
              ? t('issueTotalMore')
                  .replace('{total}', total.toLocaleString())
                  .replace('{n}', list.length.toLocaleString())
              : t('issueTotal').replace('{total}', total.toLocaleString())}
        </span>
      </div>
      <div className="issue-toolbar" data-testid="issue-toolbar">
        <span className="issue-toolbar-label">{t('sort')}</span>
        <OSelect
          testid="sort-by"
          value={filters.sortBy}
          options={[
            { label: t('recentUpdate'), value: 'updatedAt' },
            { label: t('priority'), value: 'priority' },
            { label: t('createdAt'), value: 'createdAt' },
          ]}
          onChange={(v) => setFilters((prev) => ({ ...prev, sortBy: v as SortBy }))}
        />
        <span className="issue-toolbar-label">{t('group')}</span>
        <OSelect
          testid="group-by"
          value={grouping}
          options={[
            { label: t('none'), value: 'none' },
            { label: t('byPriority'), value: 'priority' },
            { label: t('byAssignee'), value: 'assignee' },
          ]}
          onChange={(v) => setGrouping(v as Grouping)}
        />
        <span className="issue-toolbar-label">{t('priority')}</span>
        <OSelect
          testid="filter-priority"
          value={priorityValue}
          options={priorityOptions}
          onChange={(v) => {
            if (v === 'multi') return
            setFilters((prev) => ({
              ...prev,
              priorityFilter: v === 'all' ? [] : [v as IssuePriority],
            }))
          }}
        />
        {(filters.search ||
          filters.assigneeFilter.length > 0 ||
          filters.priorityFilter.length > 0 ||
          filters.cycleFilter !== null ||
          filters.myOnly) && (
          <button
            className="issue-toolbar-clear"
            type="button"
            data-testid="filter-clear"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                search: '',
                assigneeFilter: [],
                priorityFilter: [],
                cycleFilter: null,
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
      {loading ? (
        <ListSkeleton />
      ) : groups ? (
        <div className="issue-scroll">
          {groups.map(([k, arr]) => (
            <div key={k} className="issue-group">
              <p className="issue-group-title">
                {k} <oas-badge>{String(arr.length)}</oas-badge>
              </p>
              {arr.slice(0, GROUP_PREVIEW).map(rowEl)}
              {arr.length > GROUP_PREVIEW && (
                <p className="board-col-more">
                  {t('groupMore').replace('{n}', String(arr.length - GROUP_PREVIEW))}
                </p>
              )}
            </div>
          ))}
          {groups.length === 0 && <oas-empty description={emptyText} data-testid="issues-empty" />}
        </div>
      ) : list.length === 0 ? (
        <div className="issue-scroll">
          <oas-empty description={emptyText} data-testid="issues-empty" />
        </div>
      ) : (
        <VirtualIssueList
          issues={list}
          onSelect={onSelect}
          memberMap={memberMap}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          showCheckbox={canBulk}
          cursorIndex={cursorIndex}
          onNearBottom={onNearBottom}
          lang={getLang()}
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
