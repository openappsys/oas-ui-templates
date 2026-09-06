<script setup lang="ts">
// src/pages/logs.vue —— 日志中心（虚拟列表 + 日期锚点 + 筛选 + 统计卡 + CSV 导出）
// 行为事实来源：vanilla-html/src/pages/logs.ts（402 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（applyFilter 手动刷列表/锚点/统计/空态）；本模版
//    声明式——rows/filtered/level/keyword/dateRange/selected 全部 ref，锚点 items/空态显隐
//    由 state 派生；applyFilter 仅调 listLogs 写 filtered
// 2. 子组件拆分（单文件 ≤400 行纪律）：统计卡 ./logs-stats.vue、虚拟列表 ./logs-vlist.vue
//    （行模板/property 注入/回顶/滚动索引）、详情弹窗 ./logs-detail-modal.vue；锚点联动
//    （items/active/click 滚动 + 窄屏方向切换）保留本文件（依赖 filtered 与反查表）
// 3. 锚点联动：oas-scroll → 子组件 currentScrollIndex() 反查日期 → anchor active；
//    oas-click 按 href 反查日期分组索引 → 子组件 scrollToIndex（vanilla 同款语义）
// 4. 事件绑定：level/keyword/date-picker 的 oas-change/oas-input/oas-clear 模板直绑
//    （AGENTS.md 第 1 条）；导出按钮原生 click 直绑 @click
// 5. 响应式锚点方向：vanilla matchMedia('(max-width: 768px)') 切 horizontal/vertical；
//    本模版同款监听，onUnmounted 移除（vanilla cleanup 同语义）
// 6. CSS：vanilla 页面顶部 import logs.css 与 '@oas-ui/ui' 子路径按需注册；本模版 main.ts
//    已全量注册组件，仅需 import logs.css（从 vanilla 原样复制）
import '../styles/pages/logs.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { listLogs } from '../data/logs'
import type { LogEntry, LogLevel } from '../data/logs'
import { useT } from '../composables/use-t'
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

// vanilla anchorLabel：今天/昨天/月日 文案
function anchorLabel(d: string): string {
  const today = iso(new Date())
  const yesterday = iso(new Date(Date.now() - 86400000))
  if (d === today) return t('logs.anchor.today')
  if (d === yesterday) return t('logs.anchor.yesterday')
  return t('logs.anchor.date', { month: d.slice(5, 7), day: d.slice(8, 10) })
}

// vanilla buildDateGroups：相邻同日合并为锚点分组
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

const rows = ref<LogEntry[]>([])
const filtered = ref<LogEntry[]>([])
const level = ref<LogLevel | 'all'>('all')
const keyword = ref('')
const dateRange = ref<[string, string] | null>(null)
const selected = ref<LogEntry | null>(null)
const detailOpen = ref(false)

const anchorRef = ref<HTMLElement | null>(null)
const vlistCompRef = ref<InstanceType<typeof LogsVList> | null>(null)

const empty = computed(() => filtered.value.length === 0)

// vanilla renderStats 的取数段（基于全量 rows，不随筛选变化；卡片结构在 logs-stats.vue）
const statsToday = computed(() => iso(new Date()))
const statsTodayCount = computed(
  () => rows.value.filter((r) => dateKey(r.time) === statsToday.value).length,
)
const statsErrorCount = computed(() => rows.value.filter((r) => r.level === 'error').length)
const statsWarnCount = computed(() => rows.value.filter((r) => r.level === 'warn').length)

// vanilla LEVEL_OPTIONS（label 随 locale 重算）
const levelOptions = computed(() =>
  JSON.stringify(LEVEL_VALUES.map((v) => ({ label: levelLabel(v), value: v }))),
)

// vanilla renderAnchor：锚点 items JSON + href→日期/日期→索引两张反查表
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

// vanilla applyFilter：按 level/keyword/dateRange 拉取（列表/回顶由 logs-vlist.vue 的
// watch 派生，锚点/统计/空态由 computed 派生）
async function applyFilter(): Promise<void> {
  filtered.value = await listLogs({
    level: level.value,
    keyword: keyword.value,
    dateRange: dateRange.value ?? undefined,
  })
}

onMounted(async () => {
  rows.value = await listLogs()
  await applyFilter()
})

// vanilla updateAnchorActive：滚动位置 → 当前行日期 → 锚点 active
function updateAnchorActive(): void {
  const index = vlistCompRef.value?.currentScrollIndex() ?? 0
  const row = filtered.value[index]
  if (!row) return
  anchorRef.value?.setAttribute('active', `#logs-day-${dateKey(row.time)}`)
}

// vanilla anchor oas-click 段：href 反查日期 → 索引滚动 + active
function onAnchorClick(e: Event): void {
  const href = (e as CustomEvent<{ href: string }>).detail.href
  const d = hrefDateMap.get(href)
  if (d === undefined) return
  vlistCompRef.value?.scrollToIndex(dateIndexMap.get(d) ?? 0)
  anchorRef.value?.setAttribute('active', href)
}

// vanilla levelSelect oas-change 段
function onLevelChange(e: Event): void {
  const value = (e as CustomEvent<{ value: string }>).detail.value
  level.value = (value || 'all') as LogLevel | 'all'
  void applyFilter()
}

// vanilla keywordInput oas-input/oas-clear 段
function onKeywordInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value
  void applyFilter()
}
function onKeywordClear(): void {
  keyword.value = ''
  void applyFilter()
}

// vanilla datePicker oas-change 段：value 为二元数组时生效，其余清空
function onDateChange(e: Event): void {
  const value = (e as CustomEvent<{ value: string[] | string }>).detail.value
  if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
    dateRange.value = [value[0], value[1]]
  } else {
    dateRange.value = null
  }
  void applyFilter()
}

// vanilla exportBtn click 段：空数据提示；否则拼 BOM CSV 下载
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

// vanilla syncAnchorDirection：窄屏横向锚点（matchMedia 监听，卸载时移除）
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
