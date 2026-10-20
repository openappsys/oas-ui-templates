import { useMemo } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { IssueStatus, Member } from '@/types'
import { ISSUE_STATUSES } from '@/types'
import { statusLabel, t } from '@/i18n'
import { STATUS_COLOR } from '@/lib/colors'
import { useProjectCounts } from '@/lib/hooks'
import { Chart } from '@/components/Chart'
import { toChartData } from '@/lib/chart-data'
import { DashSkeleton } from '@/components/skeletons/DashSkeleton'

/* ── 仪表盘 ── */
export function DashboardView({
  projectId,
  memberMap,
  currentUser,
}: {
  projectId: string
  memberMap: Map<string, Member>
  currentUser: string
}) {
  const { issues: issuesRepo, members: membersRepo } = useRepositories()
  const counts = useProjectCounts(projectId)
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const workload = useObservable(
    () => issuesRepo.liveAssigneeWorkload(projectId),
    [issuesRepo, projectId],
  )
  const topAssignees = useMemo(() => {
    if (!members || !workload) return undefined
    const countByMemberId = new Map(workload.map((r) => [r.memberId, r.count]))
    return members
      .map((m) => ({ label: m.name, value: countByMemberId.get(m.id) ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [members, workload])

  const statusData = ISSUE_STATUSES.map((s) => ({
    label: statusLabel(s),
    value: counts?.byStatus[s] ?? 0,
  }))

  // 近 30 天创建趋势（createdAt 索引范围取数，按天聚合）
  const trendFrom = useMemo(() => Date.now() - 30 * 86400000, [])
  const trendRows = useObservable(
    () => issuesRepo.liveByCreatedSince(trendFrom),
    [issuesRepo, trendFrom],
  )
  const trend = useMemo(() => {
    if (!trendRows) return undefined
    const day = 86400000
    const byDay = new Map<string, number>()
    for (let i = 30; i >= 0; i--) {
      byDay.set(new Date(Date.now() - i * day).toISOString().slice(5, 10), 0)
    }
    for (const r of trendRows) {
      const k = new Date(r.createdAt).toISOString().slice(5, 10)
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1)
    }
    return [...byDay.entries()].map(([label, value]) => ({ label, value }))
  }, [trendRows])

  if (counts === undefined) {
    return (
      <div className="dash-page" data-testid="dashboard">
        <h1 className="page-h1">{t('dashboard')}</h1>
        <DashSkeleton />
        <p className="dash-note" data-testid="dashboard-member-note">
          {t('dashNote').replace('{name}', memberMap.get(currentUser)?.name ?? '')}
        </p>
      </div>
    )
  }

  return (
    <div className="dash-page" data-testid="dashboard">
      <h1 className="page-h1">{t('dashboard')}</h1>
      <div className="dash-cards">
        <oas-statistic className="dash-card" data-testid="stat-total" title={t('dashStatAll')}>
          <span slot="value">{counts?.total.toLocaleString() ?? '…'}</span>
        </oas-statistic>
        {(['todo', 'in_progress', 'done'] as IssueStatus[]).map((s) => (
          <oas-statistic
            key={s}
            className="dash-card"
            data-testid={`stat-${s}`}
            title={statusLabel(s)}
          >
            <span slot="value" style={{ color: STATUS_COLOR[s] }}>
              {(counts?.byStatus[s] ?? 0).toLocaleString()}
            </span>
          </oas-statistic>
        ))}
      </div>
      <div className="dash-charts">
        <div className="dash-chart-box">
          <p className="dash-chart-title">{t('chartStatus')}</p>
          <Chart
            type="donut"
            data={toChartData(t('chartStatus'), statusData)}
            testid="chart-status"
            label={t('chartStatusAria')}
          />
        </div>
        <div className="dash-chart-box">
          <p className="dash-chart-title">{t('chartAssignee')}</p>
          <Chart
            type="bar"
            data={toChartData(t('chartAssignee'), topAssignees ?? [])}
            testid="chart-assignee"
            label={t('chartAssigneeAria')}
          />
        </div>
      </div>
      <div className="dash-chart-box" data-testid="trend-box">
        <p className="dash-chart-title">{t('chartTrend')}</p>
        <Chart
          type="area"
          data={toChartData(t('chartTrend'), trend ?? [])}
          testid="chart-trend"
          label={t('chartTrendAria')}
        />
      </div>
      <p className="dash-note" data-testid="dashboard-member-note">
        {t('dashNote').replace('{name}', memberMap.get(currentUser)?.name ?? '')}
      </p>
    </div>
  )
}
