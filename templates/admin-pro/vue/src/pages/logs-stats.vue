<script setup lang="ts">
// src/pages/logs-stats.vue —— 日志统计卡（今日新增/错误数/警告数）
//（拆分边界参照 products 系列先例，logs.vue 主文件 ≤400 行纪律）
import { useT } from '../composables/use-t'

defineProps<{
  today: string
  todayCount: number
  errorCount: number
  warnCount: number
}>()

const { t, locale } = useT()
void locale.value
</script>

<template>
  <div id="logs-stats" class="logs-stats">
    <oas-card class="stat-card">
      <div class="stat-label">{{ t('logs.stat.today') }}</div>
      <div class="stat-value mono">{{ todayCount }}</div>
      <div class="stat-foot">{{ today }}</div>
    </oas-card>
    <oas-card class="stat-card">
      <div class="stat-label">{{ t('logs.stat.errors') }}</div>
      <div class="stat-value mono" style="color: var(--oas-color-danger)">{{ errorCount }}</div>
      <div class="stat-foot">{{ t('logs.stat.errorLevel') }}</div>
    </oas-card>
    <oas-card class="stat-card">
      <div class="stat-label">{{ t('logs.stat.warns') }}</div>
      <div class="stat-value mono" style="color: var(--oas-color-warning)">{{ warnCount }}</div>
      <div class="stat-foot">{{ t('logs.stat.warnLevel') }}</div>
    </oas-card>
  </div>
</template>
