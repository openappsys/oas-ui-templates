<script setup lang="ts">
// src/pages/data-board.vue —— 数据看板：统计卡 + 柱状/饼图/堆叠柱状图 + 进度条 + 水印层
// 行为事实来源：vanilla-html/src/pages/data-board.ts（134 行，逐块对齐）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla draw() innerHTML + refreshText 逐节点回写；本模版声明式——
//    boardData() 静态数据取一次，图表 data/卡片标题/月份标签全部 computed（依赖 locale），
//    useT() 订阅后整页重渲染即等价于 vanilla onLocaleChange(refreshText)
// 2. 图表数据：bar/pie/stacked-bar 的 data 传 JSON 字符串（AGENTS.md 第 3 条；
//    oas-chart setter 只写内部 dataProp 不落 attribute，与 vanilla setAttribute 通道效果一致）
// 3. 统计卡双形态：vanilla statCard() 按 anim 二选一（oas-number-animation / oas-statistic）；
//    本模版 v-if/v-else 同分支，data-testid 命名（anim-*/stat-*）逐字一致
import { computed } from 'vue'
import '../styles/pages/data-board.css'
import { boardData } from '../data/board'
import type { CategorySlice, ChannelSeries } from '../data/board'
import { useT } from '../composables/use-t'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

// vanilla STAT_KEYS / CHART_KEYS / PROGRESS_KEYS（按序对齐 stats/charts/progress 三个列表）
const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion'] as const
const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers'] as const

// 静态数据（vanilla render 时 boardData() 取一次）
const data = boardData()
const targets = data.quarterTargets
const progressValues = [targets.order, targets.revenue, targets.users]

// vanilla barData()/pieData()/stackedData()：月份标签随 locale 重算
const barData = computed(() =>
  JSON.stringify(data.monthRevenue.map((v, i) => ({ label: t(`board.month${i + 1}`), value: v }))),
)
const pieData = computed(() =>
  JSON.stringify(data.categoryShare.map((c: CategorySlice) => ({ label: c.name, value: c.value }))),
)
const stackedData = computed(() =>
  JSON.stringify({
    labels: data.channel.series[0]?.data.map((_, i) => t(`board.month${i + 1}`)) ?? [],
    series: data.channel.series.map((s: ChannelSeries) => ({ name: s.name, data: s.data })),
  }),
)
const stackedOptions = JSON.stringify({ showLegend: true })
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('board.title') }}</h1>
        <p class="page-subtitle">{{ t('board.subtitle') }}</p>
      </div>
    </div>
    <oas-watermark text="OAS Admin Pro" repeat opacity="0.12">
      <div class="board-grid" id="board-grid">
        <oas-card v-for="(s, i) in data.stats" :key="s.key" class="stat-card">
          <div class="stat-label">{{ t(STAT_KEYS[i] ?? '') }}</div>
          <div class="stat-value">
            <span v-if="s.prefix" class="stat-prefix">{{ s.prefix }}</span>
            <oas-number-animation
              v-if="s.anim"
              :data-testid="`anim-${s.key}`"
              :value="s.value"
            />
            <oas-statistic v-else :data-testid="`stat-${s.key}`" :value="s.value">
              <span v-if="s.suffix" slot="suffix">{{ s.suffix }}</span>
            </oas-statistic>
          </div>
        </oas-card>
      </div>
      <div class="board-charts">
        <oas-card class="chart-card" :title="t('board.monthRevenue')">
          <oas-chart type="bar" :data="barData" :aria-label="t('board.monthRevenue')" />
        </oas-card>
        <oas-card class="chart-card" :title="t('board.categoryShare')">
          <oas-chart type="pie" :data="pieData" :aria-label="t('board.categoryShare')" />
        </oas-card>
        <oas-card class="chart-card chart-card--wide" :title="t('board.channelTrend')">
          <oas-chart
            type="stacked-bar"
            :options="stackedOptions"
            :data="stackedData"
            :aria-label="t('board.channelTrend')"
          />
        </oas-card>
      </div>
      <oas-card class="board-progress" :title="t('board.targetTitle')">
        <div class="progress-list">
          <div v-for="(key, i) in PROGRESS_KEYS" :key="key" class="progress-row">
            <span class="progress-label">{{ t(key) }}</span>
            <oas-progress :value="progressValues[i]" :data-testid="`board-progress-${['order', 'revenue', 'users'][i]}`" />
          </div>
        </div>
      </oas-card>
    </oas-watermark>
  </div>
</template>
