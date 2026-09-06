// src/pages/data-board.tsx —— 数据看板（水印 + 数字动画统计卡 + 三图表 + 季度目标进度）
//    本模版声明式 JSX，useT() 订阅 locale 后整页重渲染，图表 data/aria-label/progress
//    value 等 attribute 随之重算（数据全部来自 boardData() 纯函数，无异步）
import '../styles/pages/data-board.css'
import { boardData } from '../data/board'
import { useT } from '../hooks/use-t'

const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion']
const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers']
const PROGRESS_TESTIDS = ['board-progress-order', 'board-progress-revenue', 'board-progress-users']

type TFunc = (key: string, params?: Record<string, string | number>) => string

function barData(data: number[], t: TFunc): string {
  return JSON.stringify(data.map((v, i) => ({ label: t(`board.month${i + 1}`), value: v })))
}

export default function DataBoardPage() {
  const { t } = useT()
  const data = boardData()

  const monthBar = barData(data.monthRevenue, t)
  const pie = JSON.stringify(data.categoryShare.map((c) => ({ label: c.name, value: c.value })))
  const stacked = JSON.stringify({
    labels: data.channel.series[0]?.data.map((_, i) => t(`board.month${i + 1}`)) ?? [],
    series: data.channel.series.map((s) => ({ name: s.name, data: s.data })),
  })
  const targets = data.quarterTargets
  const progressValues = [targets.order, targets.revenue, targets.users]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('board.title')}</h1>
          <p className="page-subtitle">{t('board.subtitle')}</p>
        </div>
      </div>
      <oas-watermark text="OAS Admin Pro" repeat opacity="0.12">
        <div className="board-grid" id="board-grid">
          {data.stats.map((s, i) => (
            <oas-card className="stat-card" key={s.key}>
              <div className="stat-label">{t(STAT_KEYS[i] ?? '')}</div>
              <div className="stat-value">
                {s.prefix ? <span className="stat-prefix">{s.prefix}</span> : null}
                {s.anim ? (
                  <oas-number-animation data-testid={`anim-${s.key}`} value={s.value} />
                ) : (
                  <oas-statistic data-testid={`stat-${s.key}`} value={s.value}>
                    {s.suffix ? <span slot="suffix">{s.suffix}</span> : null}
                  </oas-statistic>
                )}
              </div>
            </oas-card>
          ))}
        </div>
        <div className="board-charts">
          <oas-card className="chart-card" title={t('board.monthRevenue')}>
            <oas-chart type="bar" data={monthBar} aria-label={t('board.monthRevenue')} />
          </oas-card>
          <oas-card className="chart-card" title={t('board.categoryShare')}>
            <oas-chart type="pie" data={pie} aria-label={t('board.categoryShare')} />
          </oas-card>
          <oas-card className="chart-card chart-card--wide" title={t('board.channelTrend')}>
            <oas-chart
              type="stacked-bar"
              options='{"showLegend":true}'
              data={stacked}
              aria-label={t('board.channelTrend')}
            />
          </oas-card>
        </div>
        <oas-card className="board-progress" title={t('board.targetTitle')}>
          <div className="progress-list">
            {PROGRESS_KEYS.map((key, i) => (
              <div className="progress-row" key={key}>
                <span className="progress-label">{t(key)}</span>
                <oas-progress value={progressValues[i]} data-testid={PROGRESS_TESTIDS[i]} />
              </div>
            ))}
          </div>
        </oas-card>
      </oas-watermark>
    </div>
  )
}
