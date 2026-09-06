<script setup lang="ts">
// src/pages/data-board.vue —— 数据看板：统计卡 + 柱状/饼图/堆叠柱状图 + 进度条 + 水印层
//    boardData() 静态数据取一次，图表 data/卡片标题/月份标签全部 computed（依赖 locale），
//    本模版 v-if/v-else 同分支，data-testid 命名（anim-*/stat-*）逐字一致
import { computed } from 'vue'
import { boardData } from '../data/board'
import type { CategorySlice, ChannelSeries } from '../data/board'
import { useT } from '../composables/use-t'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const STAT_KEYS = ['board.gmv', 'board.orders', 'board.users', 'board.conversion'] as const
const PROGRESS_KEYS = ['board.targetOrder', 'board.targetRevenue', 'board.targetUsers'] as const

const data = boardData()
const targets = data.quarterTargets
const progressValues = [targets.order, targets.revenue, targets.users]

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

<style scoped>
/* 数据看板样式（自 data-board.css 迁入）：.stat-card/.stat-label/.stat-value 在此覆盖全局基线（app.css） */
.board-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--oas-space-4);
  margin-bottom: var(--oas-space-4);
}
.stat-card {
  padding: var(--oas-space-4);
}
.stat-label {
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-secondary);
  margin-bottom: var(--oas-space-2);
}
.stat-value {
  display: flex;
  align-items: baseline;
  gap: var(--oas-space-1);
  font-size: var(--oas-font-size-xl);
  font-weight: 600;
  color: var(--oas-color-text-primary);
}
.stat-prefix {
  font-size: var(--oas-font-size-lg);
  color: var(--oas-color-text-secondary);
}
.board-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--oas-space-4);
  margin-bottom: var(--oas-space-4);
}
.chart-card {
  padding: var(--oas-space-4);
}
.chart-card--wide {
  grid-column: 1 / -1;
}
.board-progress {
  padding: var(--oas-space-4);
}
.progress-list {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-4);
}
.progress-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  gap: var(--oas-space-3);
}
.progress-label {
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-secondary);
  text-align: right;
}
@media (max-width: 900px) {
  .board-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .board-charts {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .board-grid {
    grid-template-columns: 1fr;
  }
  .progress-row {
    grid-template-columns: 1fr;
    gap: var(--oas-space-1);
  }
  .progress-label {
    text-align: left;
  }
}
</style>
