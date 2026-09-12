<script lang="ts">
  // src/pages/data-board.svelte —— 数据看板（水印 + 数字动画统计卡 + 三图表 + 季度目标进度）
  // 声明式模板，useT() 订阅 locale 后整页重渲，图表 data/aria-label/progress value 等
  // attribute 随之重算（数据全部来自 boardData() 纯函数，无异步）
  import '../styles/pages/data-board.css'
  import { boardData } from '../data/board'
  import { useT } from '../lib/use-t.svelte'

  const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion']
  const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers']
  const PROGRESS_TESTIDS = [
    'board-progress-order',
    'board-progress-revenue',
    'board-progress-users',
  ]

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const data = boardData()

  // loose 声明控件的未声明属性走展开通道；图表文案随 locale 重算（对象身份变化触发 setAttribute）
  const monthBar = $derived(
    JSON.stringify(
      data.monthRevenue.map((v, i) => ({ label: tt(`board.month${i + 1}`), value: v })),
    ),
  )
  const pie = $derived(
    JSON.stringify(data.categoryShare.map((c) => ({ label: c.name, value: c.value }))),
  )
  const stacked = $derived(
    JSON.stringify({
      labels: data.channel.series[0]?.data.map((_, i) => tt(`board.month${i + 1}`)) ?? [],
      series: data.channel.series.map((s) => ({ name: s.name, data: s.data })),
    }),
  )
  const targets = data.quarterTargets
  const progressValues = [targets.order, targets.revenue, targets.users]
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('board.title')}</h1>
      <p class="page-subtitle">{tt('board.subtitle')}</p>
    </div>
  </div>
  <oas-watermark {...{ text: 'OAS Admin Pro', repeat: '', opacity: '0.12' }}>
    <div class="board-grid" id="board-grid">
      {#each data.stats as s, i (s.key)}
        <oas-card class="stat-card">
          <div class="stat-label">{tt(STAT_KEYS[i] ?? '')}</div>
          <div class="stat-value">
            {#if s.prefix}<span class="stat-prefix">{s.prefix}</span>{/if}
            {#if s.anim}
              <oas-number-animation data-testid={`anim-${s.key}`} {...{ value: s.value }}>
              </oas-number-animation>
            {:else}
              <oas-statistic data-testid={`stat-${s.key}`} {...{ value: s.value }}>
                {#if s.suffix}<span slot="suffix">{s.suffix}</span>{/if}
              </oas-statistic>
            {/if}
          </div>
        </oas-card>
      {/each}
    </div>
    <div class="board-charts">
      <oas-card class="chart-card" title={tt('board.monthRevenue')}>
        <oas-chart {...{ type: 'bar', data: monthBar, 'aria-label': tt('board.monthRevenue') }}>
        </oas-chart>
      </oas-card>
      <oas-card class="chart-card" title={tt('board.categoryShare')}>
        <oas-chart {...{ type: 'pie', data: pie, 'aria-label': tt('board.categoryShare') }}>
        </oas-chart>
      </oas-card>
      <oas-card class="chart-card chart-card--wide" title={tt('board.channelTrend')}>
        <oas-chart
          {...{
            type: 'stacked-bar',
            options: '{"showLegend":true}',
            data: stacked,
            'aria-label': tt('board.channelTrend'),
          }}
        ></oas-chart>
      </oas-card>
    </div>
    <oas-card class="board-progress" title={tt('board.targetTitle')}>
      <div class="progress-list">
        {#each PROGRESS_KEYS as key, i (key)}
          <div class="progress-row">
            <span class="progress-label">{tt(key)}</span>
            <oas-progress data-testid={PROGRESS_TESTIDS[i]} {...{ value: progressValues[i] }}>
            </oas-progress>
          </div>
        {/each}
      </div>
    </oas-card>
  </oas-watermark>
</div>
