import type { Dispatch, SetStateAction } from 'react'
import { t } from '@/i18n'
import type { Filters } from '@/lib/filters'
import { OMultiSelect, OSelect } from './oas-wrappers'

export interface FilterOption {
  label: string
  value: string
}

/**
 * 内容区顶部筛选栏（列表/看板/时间线/资源/日程共用）。
 * 与侧栏读写同一份 Filters：位置只是渲染位置，不存在第二份筛选状态。
 * 选项文案（含全量计数后缀）由宿主算好传入，两处控件才会完全同源。
 */
export function FilterBar({
  filters,
  setFilters,
  statusOptions,
  priorityOptions,
  assigneeOptions,
  cycleOptions,
}: {
  filters: Filters
  setFilters: Dispatch<SetStateAction<Filters>>
  statusOptions: FilterOption[]
  priorityOptions: FilterOption[]
  assigneeOptions: FilterOption[]
  cycleOptions: FilterOption[]
}) {
  const active =
    filters.statusFilter.length > 0 ||
    filters.priorityFilter.length > 0 ||
    filters.assigneeFilter.length > 0 ||
    filters.cycleFilter !== null
  const setF = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }))
  return (
    <section className="filter-bar" data-testid="topbar-filters" aria-label={t('topFilters')}>
      <span className="filter-bar-label">{t('status')}</span>
      <OMultiSelect
        testid="filters-status"
        label={t('status')}
        placeholder={t('allStatuses')}
        value={filters.statusFilter}
        options={statusOptions}
        onChange={(v) => setF('statusFilter', v as Filters['statusFilter'])}
      />
      <span className="filter-bar-label">{t('priority')}</span>
      <OMultiSelect
        testid="filters-priority"
        label={t('priority')}
        placeholder={t('allPriorities')}
        value={filters.priorityFilter}
        options={priorityOptions}
        onChange={(v) => setF('priorityFilter', v as Filters['priorityFilter'])}
      />
      <span className="filter-bar-label">{t('members')}</span>
      <OMultiSelect
        testid="filters-assignee"
        label={t('members')}
        searchLabel={t('searchMembers')}
        placeholder={t('allMembers')}
        value={filters.assigneeFilter}
        options={assigneeOptions}
        onChange={(v) => setF('assigneeFilter', v)}
      />
      {/* 迭代单选：周期有序，多选无交集语义（与侧栏迭代组同一契约） */}
      <span className="filter-bar-label">{t('cycles')}</span>
      <OSelect
        testid="filters-cycle"
        ariaLabel={t('cycles')}
        value={filters.cycleFilter ?? 'all'}
        options={cycleOptions}
        onChange={(v) => setF('cycleFilter', v === 'all' ? null : v)}
      />
      <button
        className="filter-bar-clear"
        type="button"
        data-testid="filters-clear"
        // 没有生效筛选时置灰而非隐藏：控件位置稳定，屏幕阅读器不会因为行数变化丢失焦点
        disabled={!active}
        onClick={() =>
          setFilters((prev) => ({
            ...prev,
            statusFilter: [],
            priorityFilter: [],
            assigneeFilter: [],
            cycleFilter: null,
          }))
        }
      >
        {t('clearFilters')}
      </button>
    </section>
  )
}
