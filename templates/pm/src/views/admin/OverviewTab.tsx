import { useEffect, useMemo, useRef } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Member } from '@/types'
import { t } from '@/i18n'
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
        overdue: h.overdue.toLocaleString(),
        unassigned: h.unassigned.toLocaleString(),
        stale: h.stale.toLocaleString(),
      })),
    [health],
  )
  const columns = useMemo(
    () => [
      { key: 'name', title: t('adminHealthProject') },
      { key: 'total', title: t('adminHealthTotal'), align: 'right' },
      { key: 'overdue', title: t('adminHealthOverdue'), align: 'right' },
      { key: 'unassigned', title: t('adminHealthUnassigned'), align: 'right' },
      { key: 'stale', title: t('adminHealthStale'), align: 'right' },
    ],
    [],
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
            data={workloadData}
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
          data-testid="admin-table-health"
        />
      </div>
    </div>
  )
}
