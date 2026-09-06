<script setup lang="ts">
// src/pages/logs.vue —— 日志中心（虚拟列表 + 日期锚点 + 筛选 + 统计卡 + CSV 导出）
//    声明式——rows/filtered/level/keyword/dateRange/selected 全部 ref，锚点 items/空态显隐
//    由 state 派生；applyFilter 仅调 listLogs 写 filtered
// 2. 子组件拆分（单文件 ≤400 行纪律）：统计卡 ./logs-stats.vue、虚拟列表 ./logs-vlist.vue
//    （行模板/property 注入/回顶/滚动索引）、详情弹窗 ./logs-detail-modal.vue；锚点联动
//    （items/active/click 滚动 + 窄屏方向切换）保留本文件（依赖 filtered 与反查表）
// 3. 锚点联动：oas-scroll → 子组件 currentScrollIndex() 反查日期 → anchor active；
// 4. 事件绑定：level/keyword/date-picker 的 oas-change/oas-input/oas-clear 模板直绑
//    导出按钮原生 click 直绑 @click
import '../styles/pages/logs.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { LogEntry, LogLevel } from '../data/logs'
import { useT } from '../composables/use-t'
import { useLogsList } from '../composables/use-logs'
import { appMessage } from '../lib/app-message'
import LogsDetailModal from './logs-detail-modal.vue'
import LogsStats from './logs-stats.vue'
import LogsVList from './logs-vlist.vue'

const LEVEL_VALUES: Array<LogLevel | 'all'> = ['all', 'info', 'warn', 'error']

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

function levelLabel(level: LogLevel | 'all'): string {
  return t(`logs.level.${level}`)
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateKey(time: string): string {
  return iso(new Date(time))
}

function anchorLabel(d: string): string {
  const today = iso(new Date())
  const yesterday = iso(new Date(Date.now() - 86400000))
  if (d === today) return t('logs.anchor.today')
  if (d === yesterday) return t('logs.anchor.yesterday')
  return t('logs.anchor.date', { month: d.slice(5, 7), day: d.slice(8, 10) })
}

function buildDateGroups(list: LogEntry[]): Array<{ date: string; label: string; index: number }> {
  const groups: Array<{ date: string; label: string; index: number }> = []
  let lastDate = ''
  for (let i = 0; i < list.length; i++) {
    const d = dateKey(list[i].time)
    if (d !== lastDate) {
      groups.push({ date: d, label: anchorLabel(d), index: i })
      lastDate = d
    }
  }
  return groups
}

// 日志数据：composable（全量 + 筛选 + 条件状态）
const { rows, filtered, level, keyword, dateRange, load, applyFilter } = useLogsList()
const selected = ref<LogEntry | null>(null)
const detailOpen = ref(false)

const anchorRef = ref<HTMLElement | null>(null)
const vlistCompRef = ref<InstanceType<typeof LogsVList> | null>(null)

const empty = computed(() => filtered.value.length === 0)

const statsToday = computed(() => iso(new Date()))
const statsTodayCount = computed(
  () => rows.value.filter((r) => dateKey(r.time) === statsToday.value).length,
)
const statsErrorCount = computed(() => rows.value.filter((r) => r.level === 'error').length)
const statsWarnCount = computed(() => rows.value.filter((r) => r.level === 'warn').length)

const levelOptions = computed(() =>
  JSON.stringify(LEVEL_VALUES.map((v) => ({ label: levelLabel(v), value: v }))),
)

const dateIndexMap = new Map<string, number>()
const hrefDateMap = new Map<string, string>()
// items JSON 纯派生；反查表写入放 watch（computed 保持无副作用）
const anchorItems = computed(() => {
  void locale.value
  return JSON.stringify(
    buildDateGroups(filtered.value).map((g) => ({
      href: `#logs-day-${g.date}`,
      title: `${g.label} (${g.date.slice(5)})`,
    })),
  )
})
watch(
  filtered,
  () => {
    dateIndexMap.clear()
    hrefDateMap.clear()
    for (const g of buildDateGroups(filtered.value)) {
      const href = `#logs-day-${g.date}`
      dateIndexMap.set(g.date, g.index)
      hrefDateMap.set(href, g.date)
    }
  },
  { immediate: true },
)

// watch 派生，锚点/统计/空态由 computed 派生）

onMounted(async () => {
  await load()
})

function updateAnchorActive(): void {
  const index = vlistCompRef.value?.currentScrollIndex() ?? 0
  const row = filtered.value[index]
  if (!row) return
  anchorRef.value?.setAttribute('active', `#logs-day-${dateKey(row.time)}`)
}

function onAnchorClick(e: Event): void {
  const href = (e as CustomEvent<{ href: string }>).detail.href
  const d = hrefDateMap.get(href)
  if (d === undefined) return
  vlistCompRef.value?.scrollToIndex(dateIndexMap.get(d) ?? 0)
  anchorRef.value?.setAttribute('active', href)
}

function onLevelChange(e: Event): void {
  const value = (e as CustomEvent<{ value: string }>).detail.value
  level.value = (value || 'all') as LogLevel | 'all'
  void applyFilter()
}

function onKeywordInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value
  void applyFilter()
}
function onKeywordClear(): void {
  keyword.value = ''
  void applyFilter()
}

function onDateChange(e: Event): void {
  const value = (e as CustomEvent<{ value: string[] | string }>).detail.value
  if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
    dateRange.value = [value[0], value[1]]
  } else {
    dateRange.value = null
  }
  void applyFilter()
}

function onExport(): void {
  if (filtered.value.length === 0) {
    appMessage.info(tt('logs.noExportable'))
    return
  }
  const header = tt('logs.exportHeader')
  const body = filtered.value.map((r) =>
    [r.time, levelLabel(r.level), r.operator, r.action, r.IP].join(','),
  )
  const csv = `\ufeff${[header, ...body].join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  appMessage.success(tt('logs.exported', { count: filtered.value.length }))
}

let mq: MediaQueryList | null = null
function syncAnchorDirection(): void {
  anchorRef.value?.setAttribute('direction', mq?.matches ? 'horizontal' : 'vertical')
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)')
  syncAnchorDirection()
  mq.addEventListener('change', syncAnchorDirection)
})
onUnmounted(() => {
  mq?.removeEventListener('change', syncAnchorDirection)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.logs') }}</h1>
        <p class="page-subtitle">{{ t('logs.subtitle') }}</p>
      </div>
    </div>
    <LogsStats
      :today="statsToday"
      :today-count="statsTodayCount"
      :error-count="statsErrorCount"
      :warn-count="statsWarnCount"
    />
    <oas-card class="logs-card" :title="t('logs.cardTitle')">
      <div class="logs-toolbar" slot="extra">
        <oas-select
          data-testid="logs-level"
          :placeholder="t('logs.toolbar.level')"
          clearable
          value="all"
          :options="levelOptions"
          @oas-change="onLevelChange"
        />
        <oas-input
          data-testid="logs-keyword"
          :placeholder="t('logs.toolbar.keyword')"
          clearable
          prefix-icon="search"
          @oas-input="onKeywordInput"
          @oas-clear="onKeywordClear"
        />
        <oas-date-picker
          data-testid="logs-date"
          type="daterange"
          :placeholder="t('logs.toolbar.dateRange')"
          @oas-change="onDateChange"
        />
        <oas-button data-testid="logs-export" type="primary" icon="download" @click="onExport">
          {{ t('logs.export') }}
        </oas-button>
      </div>
      <div class="logs-main">
        <div class="logs-list-wrap">
          <div class="logs-header">
            <span class="logs-h-time">{{ t('logs.th.time') }}</span>
            <span class="logs-h-level">{{ t('logs.th.level') }}</span>
            <span class="logs-h-operator">{{ t('logs.th.operator') }}</span>
            <span class="logs-h-action">{{ t('logs.th.action') }}</span>
            <span class="logs-h-ip">{{ t('logs.th.ip') }}</span>
          </div>
          <div class="logs-list-body">
            <LogsVList
              ref="vlistCompRef"
              :rows="filtered"
              :empty="empty"
              @open-detail="
                (entry) => {
                  selected = entry
                  detailOpen = true
                }
              "
              @scroll="updateAnchorActive"
            />
            <div class="logs-empty" id="logs-empty" :hidden="!empty">
              <oas-empty :description="t('logs.empty')" />
            </div>
          </div>
        </div>
        <div class="logs-anchor-wrap">
          <oas-anchor
            ref="anchorRef"
            data-testid="logs-anchor"
            id="logs-anchor"
            direction="vertical"
            hash="false"
            :items="anchorItems"
            @oas-click="onAnchorClick"
          />
        </div>
      </div>
    </oas-card>

    <LogsDetailModal :open="detailOpen" :entry="selected" @close="detailOpen = false" />
  </div>
</template>
