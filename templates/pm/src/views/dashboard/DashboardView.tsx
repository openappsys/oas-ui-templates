import { useMemo } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { IssueStatus, Member } from '@/types'
import { ISSUE_STATUSES, STATUS_LABEL } from '@/types'
import { STATUS_COLOR } from '@/lib/colors'
import { useProjectCounts } from '@/lib/hooks'
import { Chart } from '@/components/Chart'

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
    label: STATUS_LABEL[s],
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

  return (
    <div className="dash-page" data-testid="dashboard">
      <h1 className="page-h1">仪表盘</h1>
      <div className="dash-cards">
        <oas-statistic className="dash-card" data-testid="stat-total" title="全部 Issue">
          <span slot="value">{counts?.total.toLocaleString() ?? '…'}</span>
        </oas-statistic>
        {(['todo', 'in_progress', 'done'] as IssueStatus[]).map((s) => (
          <oas-statistic
            key={s}
            className="dash-card"
            data-testid={`stat-${s}`}
            title={STATUS_LABEL[s]}
          >
            <span slot="value" style={{ color: STATUS_COLOR[s] }}>
              {(counts?.byStatus[s] ?? 0).toLocaleString()}
            </span>
          </oas-statistic>
        ))}
      </div>
      <div className="dash-charts">
        <div className="dash-chart-box">
          <p className="dash-chart-title">状态分布</p>
          <Chart type="donut" data={statusData} testid="chart-status" label="状态分布图" />
        </div>
        <div className="dash-chart-box">
          <p className="dash-chart-title">成员 Issue 数 Top 6</p>
          <Chart
            type="bar"
            data={topAssignees ?? []}
            testid="chart-assignee"
            label="成员 Issue 分布图"
          />
        </div>
      </div>
      <div className="dash-chart-box" data-testid="trend-box">
        <p className="dash-chart-title">近 30 天创建趋势</p>
        <Chart type="area" data={trend ?? []} testid="chart-trend" label="创建与完成趋势图" />
      </div>
      <p className="dash-note" data-testid="dashboard-member-note">
        {memberMap.get(currentUser)?.name ?? ''} 的工作台 · 数据实时来自 IndexedDB
      </p>
    </div>
  )
}
