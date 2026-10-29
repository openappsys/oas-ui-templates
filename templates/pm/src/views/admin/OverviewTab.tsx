import { useEffect, useMemo, useRef } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Member } from '@/types'
import { getLang, t } from '@/i18n'
import { toChartData } from '@/lib/chart-data'
import { Chart } from '@/components/Chart'

type TableHost = HTMLElement & { columns?: unknown; data?: unknown }

export function OverviewTab({
  memberMap,
  onOpenProject,
}: {
  memberMap: Map<string, Member>
  onOpenProject: (projectId: string) => void
}) {
  const { admin } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const stats = useObservable(() => admin.liveGlobalStats(), [admin])
  const workload = useObservable(() => admin.liveMemberWorkload(), [admin])
  const health = useObservable(() => admin.liveProjectHealth(), [admin])

  /** 健康度数字语义色：非零才着色（逾期=danger，无负责人/停滞=warning），零值保持次级灰。
   *  表格行渲染在 oas-table shadow 内——light CSS 类穿不进去，用 CSS 变量（:root 定义可
   *  继承进 shadow，且随 data-theme 即时切换）：warn 浅底深琥珀/暗底亮琥珀双档 */
  const healthTone = (text: string, n: number, tone: 'danger' | 'warning') => {
    if (n <= 0) {
      const s = document.createElement('span')
      s.textContent = text
      s.style.color = 'var(--oas-color-text-secondary, #6b7280)'
      return s
    }
    const s = document.createElement('span')
    s.textContent = text
    s.style.fontWeight = '600'
    s.style.color =
      tone === 'danger' ? 'var(--oas-color-danger, #dc2626)' : 'var(--admin-health-warn, #b45309)'
    return s
  }

  const workloadData = useMemo(
    () =>
      (workload ?? [])
        .map((w) => ({ label: memberMap.get(w.memberId)?.name ?? w.memberId, value: w.total }))
        .sort((a, b) => b.value - a.value),
    [workload, memberMap],
  )
  const healthRows = useMemo(
    () =>
      (health ?? []).map((h) => ({
        projectId: h.projectId,
        name: h.name,
        total: h.total.toLocaleString(),
        // 原始数字保留给 render 做语义色；字符串列仍走 toLocaleString
        overdue: h.overdue.toLocaleString(),
        unassigned: h.unassigned.toLocaleString(),
        stale: h.stale.toLocaleString(),
        _overdue: h.overdue,
        _unassigned: h.unassigned,
        _stale: h.stale,
      })),
    [health],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: 语言切换需要重建表头
  const columns = useMemo(
    () => [
      { key: 'name', title: t('adminHealthProject') },
      { key: 'total', title: t('adminHealthTotal'), align: 'right' },
      {
        // 健康度语义色：逾期红（有逾期即异常）、无负责人/停滞橙（关注）
        key: 'overdue',
        title: t('adminHealthOverdue'),
        align: 'right' as const,
        render: (row: Record<string, unknown>) =>
          healthTone(String(row.overdue), Number(row._overdue ?? 0), 'danger'),
      },
      {
        key: 'unassigned',
        title: t('adminHealthUnassigned'),
        align: 'right' as const,
        render: (row: Record<string, unknown>) =>
          healthTone(String(row.unassigned), Number(row._unassigned ?? 0), 'warning'),
      },
      {
        key: 'stale',
        title: t('adminHealthStale'),
        align: 'right' as const,
        render: (row: Record<string, unknown>) =>
          healthTone(String(row.stale), Number(row._stale ?? 0), 'warning'),
      },
    ],
    [getLang()],
  )

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.columns = columns
    el.data = healthRows
  }, [columns, healthRows])

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    const h = (e: Event) => {
      const projectId = (e as CustomEvent<{ row?: { projectId?: string } }>).detail?.row?.projectId
      if (projectId) onOpenProject(projectId)
    }
    el.addEventListener('oas-row-click', h)
    return () => el.removeEventListener('oas-row-click', h)
  }, [onOpenProject])

  return (
    <div className="admin-overview-page" data-testid="admin-tab-overview">
      <h1 className="page-h1">{t('adminOverviewTitle')}</h1>
      <div className="admin-stats">
        <oas-statistic
          className="admin-stat-card"
          data-testid="admin-stat-projects"
          title={t('adminStatProjects')}
        >
          <span slot="value">{stats ? stats.projects.toLocaleString() : '…'}</span>
        </oas-statistic>
        <oas-statistic
          className="admin-stat-card"
          data-testid="admin-stat-members"
          title={t('adminStatMembers')}
        >
          <span slot="value">{stats ? stats.members.toLocaleString() : '…'}</span>
        </oas-statistic>
        <oas-statistic
          className="admin-stat-card"
          data-testid="admin-stat-issues"
          title={t('adminStatIssues')}
        >
          <span slot="value">{stats ? stats.issues.toLocaleString() : '…'}</span>
        </oas-statistic>
        <oas-statistic
          className="admin-stat-card"
          data-testid="admin-stat-done"
          title={t('adminStatDone')}
        >
          <span slot="value">{stats ? stats.done.toLocaleString() : '…'}</span>
        </oas-statistic>
      </div>
      <div className="admin-panel">
        <p className="admin-panel-title">{t('adminWorkloadChart')}</p>
        <div className="admin-chart-box">
          <Chart
            type="bar"
            data={toChartData(t('adminWorkloadChart'), workloadData)}
            testid="admin-chart-workload"
            label={t('adminWorkloadChart')}
          />
        </div>
      </div>
      <div className="admin-panel">
        <p className="admin-panel-title">{t('adminHealthTitle')}</p>
        <oas-table
          ref={tableRef}
          className="admin-health-table"
          row-key="projectId"
          aria-label={t('adminHealthTitle')}
          data-testid="admin-table-health"
        />
      </div>
    </div>
  )
}
