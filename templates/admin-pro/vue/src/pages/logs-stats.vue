<script setup lang="ts">
// src/pages/logs-stats.vue —— 日志统计卡（今日新增/错误数/警告数）
// 行为事实来源：vanilla-html/src/pages/logs.ts 的 renderStats 段
//（拆分边界参照 products 系列先例，logs.vue 主文件 ≤400 行纪律）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla stats.innerHTML 手动重建三张卡；本模版声明式——stats ref 由父组件
//    applyFilter 后重算，卡片结构静态写出（类名/stat-value 配色与 vanilla 逐字一致）
// 2. 文案刷新：vanilla refreshText 里 renderStats 重建；本模版 useT() 订阅后随 locale 自动重算
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
