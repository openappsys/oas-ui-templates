import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { Issue, Member } from '@/types'
import { OSelect, OCheckbox } from '@/components/oas-wrappers'
import { t, getLang, statusLabel } from '@/i18n'
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
  error,
  onRetry,
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
  onDeleted,
}: {
  issues: Issue[] | undefined
  /** 窗口订阅失败（首次加载/重试失败）：有数据时保留旧表，无数据时显示错误态 */
  error?: unknown
  onRetry?: () => void
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
  /** 批量删除成功：交给宿主弹「撤销」提示 */
  onDeleted?: (ids: string[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [cursorIndex, setCursorIndex] = useState(-1)
  const list = issues ?? []
  // 三重态：有错误且无数据 → 错误态；无数据 → 加载中；有数据 → 表格（错误只进 console，不闪空表）
  const failed = error !== undefined && issues === undefined
  const loading = issues === undefined && !failed
  const hasActiveFilter =
    filters.statusFilter.length > 0 ||
    filters.assigneeFilter.length > 0 ||
    filters.priorityFilter.length > 0 ||
    filters.cycleFilter !== null ||
    filters.search !== '' ||
    filters.myOnly
  const emptyText = hasActiveFilter ? t('emptyNoMatch') : t('emptyNoData')
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
          ariaLabel={t('rowSelect').replace('{key}', i.key)}
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
          {failed
            ? '—'
            : loading
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
          ariaLabel={t('sort')}
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
          ariaLabel={t('group')}
          value={grouping}
          options={[
            { label: t('none'), value: 'none' },
            { label: t('byPriority'), value: 'priority' },
            { label: t('byAssignee'), value: 'assignee' },
          ]}
          onChange={(v) => setGrouping(v as Grouping)}
        />
        {/* 筛选控件不在这里复制：状态/优先级/成员/迭代由侧栏筛选组（位置=侧栏/两者）或
            内容区顶部筛选栏（位置=顶部/两者）承载，同一份 Filters。工具条只留排序/分组/动作 */}
        {/* 动作按钮合成一组：容器吃掉 margin-left:auto，换行时整组一起换行（不留竖排按钮） */}
        <div className="issue-toolbar-actions">
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
      </div>
      {!failed && (
        <div className="issue-thead">
          <span>{t('key')}</span>
          <span>{t('title')}</span>
          <span>{t('assignee')}</span>
          <span>{t('priority')}</span>
          <span>{t('status')}</span>
        </div>
      )}
      {failed ? (
        <div className="list-error" data-testid="list-error">
          <p className="list-error-title">{t('listErrorTitle')}</p>
          <p className="list-error-hint">{t('listErrorHint')}</p>
          {error instanceof Error && error.message !== '' && (
            <p className="list-error-detail" data-testid="list-error-detail">
              {error.message}
            </p>
          )}
          {onRetry && (
            <oas-button type="primary" data-testid="list-error-retry" onClick={onRetry}>
              {t('errorRetry')}
            </oas-button>
          )}
        </div>
      ) : loading ? (
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
        onDeleted={onDeleted}
      />
    </div>
  )
}
