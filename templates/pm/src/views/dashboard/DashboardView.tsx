import { useMemo } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Cycle, IssueStatus, Member } from '@/types'
import { ISSUE_STATUSES } from '@/types'
import { statusLabel, t } from '@/i18n'
import { STATUS_COLOR } from '@/lib/colors'
import { useProjectCounts } from '@/lib/hooks'
import { Chart } from '@/components/Chart'
import { toChartData } from '@/lib/chart-data'
import { currentCycleOf } from '@/lib/cycles'
import { buildBurndown, buildVelocity } from '@/lib/cycle-charts'
import { DashSkeleton } from '@/components/skeletons/DashSkeleton'

/** 燃尽图：周期内每个自然日一条「剩余未完成」序列 + 线性理想线（对全部工作项按索引直取，不受窗口截断） */
function BurndownChart({ projectId, cycle }: { projectId: string; cycle: Cycle }) {
  const { issues: issuesRepo } = useRepositories()
  const rows = useObservable(
    () => issuesRepo.liveCycleIssues(projectId, cycle.id),
    [issuesRepo, projectId, cycle.id],
  )
  const data = useMemo(() => {
    if (!rows) return undefined
    const burn = buildBurndown(cycle, rows)
    return {
      labels: burn.labels,
      series: [
        { name: t('burndownActual'), data: burn.actual },
        { name: t('burndownIdeal'), data: burn.ideal },
      ],
    }
  }, [rows, cycle])
  // 不传 options.colors：dist 的折线点（circle.dot）不吃 colors，只按序号取内置色板——
  // 自定义 colors 会让线与点异色（实测第二序列的点恒绿）。用内置色板保证线与点同色
  if (!data) {
    return <oas-skeleton rows="3" widths="90%,70%,80%" effect="pulse" />
  }
  return <Chart type="line" data={data} testid="chart-burndown" label={t('chartBurndownAria')} />
}

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
  const { issues: issuesRepo, members: membersRepo, cycles: cyclesRepo } = useRepositories()
  const counts = useProjectCounts(projectId)
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const cycles = useObservable(() => cyclesRepo.liveAll(projectId), [cyclesRepo, projectId])
  const cycleCounts = useObservable(
    () => issuesRepo.liveCycleCounts(projectId),
    [issuesRepo, projectId],
  )
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
  // 环形图 4 色调色板循环会让「已完成/已取消」错色：按 series 顺序显式给 5 段状态色
  const statusChartOptions = useMemo(
    () => ({ colors: ISSUE_STATUSES.map((s) => STATUS_COLOR[s]) }),
    [],
  )
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

  // 迭代两张卡：当前迭代燃尽 + 近 6 期完成量（口径见 lib/cycle-charts）。
  // 不 memo：数据量是周期级（≤ 十几个），且 now 每次渲染都要取真时钟，缓存反而拦了时钟推进
  const now = Date.now()
  const currentCycle = currentCycleOf(cycles ?? [], now)
  const velocity = buildVelocity(cycles ?? [], cycleCounts ?? [], now)

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
            options={statusChartOptions}
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
      <div className="dash-chart-box dash-chart-wide" data-testid="trend-box">
        <p className="dash-chart-title">{t('chartTrend')}</p>
        <Chart
          type="area"
          data={toChartData(t('chartTrend'), trend ?? [])}
          testid="chart-trend"
          label={t('chartTrendAria')}
        />
      </div>
      <div className="dash-charts">
        <div className="dash-chart-box" data-testid="burndown-box">
          <p className="dash-chart-title">
            {currentCycle ? `${t('chartBurndown')} · ${currentCycle.name}` : t('chartBurndown')}
          </p>
          {currentCycle ? (
            <BurndownChart projectId={projectId} cycle={currentCycle} />
          ) : (
            <oas-empty data-testid="burndown-empty" description={t('chartBurndownEmpty')} />
          )}
        </div>
        <div className="dash-chart-box" data-testid="velocity-box">
          <p className="dash-chart-title">{t('chartVelocity')}</p>
          {velocity.length > 0 ? (
            <Chart
              type="bar"
              data={toChartData(t('chartVelocity'), velocity)}
              testid="chart-velocity"
              label={t('chartVelocityAria')}
            />
          ) : (
            <oas-empty data-testid="velocity-empty" description={t('chartVelocityEmpty')} />
          )}
        </div>
      </div>
      <p className="dash-note" data-testid="dashboard-member-note">
        {t('dashNote').replace('{name}', memberMap.get(currentUser)?.name ?? '')}
      </p>
    </div>
  )
}
