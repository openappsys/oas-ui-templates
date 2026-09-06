<script setup lang="ts">
// src/pages/dashboard.vue —— 仪表盘：统计卡 + 趋势/订单构成图表 + 最近订单 + 热销 Top5 + 快捷操作
// DOM 结构/类名与两端产出的 DOM 对齐（app.css 仪表盘样式依赖这些类名）。
//    本模版改为「range 状态 → 派生 JSON attribute」的声明式渲染（同 react 版），7/14/30 切换只改
//    range ref，图表 data、订单表 data、donut 图例随重渲自动联动（oas-chart/oas-table 的 data setter
//    均接受 JSON 字符串，见组件源码 normalizeData/set data）
// 3. 事件绑定：oas-segmented 的 oas-change 模板直绑（Vue 原生支持 kebab 事件，见 //    无需 react 版 useOasEvent 桥接）；刷新/导出/查看全部为原生 click，直绑 @click
//    与壳层导航同一出处
//    重渲染，columns/options/data 等 JSON attribute 随 computed 重算
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import { routeHref } from '../components/nav-items'
import { useSessionStore } from '../stores/session'
import { listProducts } from '../data/products'
import { orderBreakdown, recentOrders, trendDays, trendSeries } from '../data/dashboard'

interface StatDef {
  testid?: string
  icon: string
  tone: string
  labelKey: string
  value: number
  suffix?: string
  delta: number
}

const STATS: StatDef[] = [
  { testid: 'stat-visits', icon: 'eye', tone: 'blue', labelKey: 'dashboard.stat.visits', value: 12480, delta: 12.4 },
  { icon: 'user', tone: 'green', labelKey: 'dashboard.stat.users', value: 328, delta: 8.2 },
  { icon: 'arrow-up', tone: 'violet', labelKey: 'dashboard.stat.orders', value: 1926, delta: 3.1 },
  { icon: 'clock', tone: 'orange', labelKey: 'dashboard.stat.conversion', value: 4.6, suffix: '%', delta: -0.4 },
]

const DONUT_COLORS = [
  'var(--oas-color-success)',
  'var(--oas-color-primary)',
  'var(--oas-color-warning)',
  'var(--oas-color-danger)',
]

interface Top5Row {
  name: string
  category: string
  sold: number
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

// 会话用户：登录后页面重挂载才变，非响应式快照取值（products/users/orders 同款）
const user = useSessionStore().user
const name = user?.name ?? ''
const isAdmin = user?.role === 'admin'

const statsReady = ref(false)
const range = ref('7')
const top5 = ref<Top5Row[] | null>(null)

let skeletonTimer: ReturnType<typeof setTimeout> | null = null
// Top5 拉取存活标记：卸载后丢弃迟到的 Promise 结果（react 版 useEffect cleanup 同款语义）
let alive = true
onMounted(() => {
  skeletonTimer = setTimeout(() => {
    skeletonTimer = null
    statsReady.value = true
  }, 300)
  void listProducts().then((products) => {
    if (!alive) return
    top5.value = products
      .filter((p) => p.sold != null)
      .sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0))
      .slice(0, 5)
      .map((p) => ({ name: p.name, category: p.category, sold: p.sold ?? 0 }))
  })
})
onUnmounted(() => {
  alive = false
  if (skeletonTimer) clearTimeout(skeletonTimer)
})

// 天数切换联动：oas-segmented 的 oas-change 模板直绑
function onRangeChange(e: Event): void {
  range.value = (e as CustomEvent<{ value: string }>).detail.value
}

function todayLabel(): string {
  const tag = locale.value === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(),
  )
}

function trendLabels(days: number): string[] {
  return trendDays(days).map((d) => (d === '' ? '' : t('dashboard.rangeDays', { days: d })))
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatMoney(n: number): string {
  return `¥ ${formatNumber(n)}`
}

function getToneVars(tone: string): { bg: string; icon: string } {
  if (tone === 'blue') return { bg: 'var(--oas-color-primary)', icon: 'var(--oas-color-primary)' }
  if (tone === 'green') return { bg: 'var(--oas-color-success)', icon: 'var(--oas-color-success)' }
  if (tone === 'violet') return { bg: 'var(--oas-tint-violet)', icon: 'var(--oas-tint-violet)' }
  return { bg: 'var(--oas-color-warning)', icon: 'var(--oas-color-warning)' }
}

const days = computed(() => Number(range.value))
const breakdown = computed(() => orderBreakdown(days.value))

// 复杂数据走 JSON attribute 通道
const segmentedOptions = computed(() =>
  JSON.stringify([
    { label: t('dashboard.rangeDays', { days: '7' }), value: '7' },
    { label: t('dashboard.rangeDays', { days: '14' }), value: '14' },
    { label: t('dashboard.rangeDays', { days: '30' }), value: '30' },
  ]),
)
const trendData = computed(() =>
  JSON.stringify({
    labels: trendLabels(days.value),
    series: [{ name: t('dashboard.stat.visits'), data: trendSeries(days.value) }],
  }),
)
const trendOptions = JSON.stringify({ smooth: true, gradient: true })
const donutData = computed(() =>
  JSON.stringify(
    breakdown.value.slices.map((s) => ({ label: t(`orders.status.${s.status}`), value: s.value })),
  ),
)
const donutOptions = JSON.stringify({ colors: DONUT_COLORS })
const orderColumns = computed(() =>
  JSON.stringify([
    { key: 'id', title: t('orders.th.no') },
    { key: 'customer', title: t('orders.th.customer') },
    { key: 'amount', title: t('orders.th.amount') },
    { key: 'status', title: t('orders.th.status') },
  ]),
)
const orderRows = computed(() =>
  JSON.stringify(
    recentOrders(days.value).map((r) => ({
      id: r.id,
      customer: r.customer,
      amount: formatMoney(r.amount),
      status: t(`orders.status.${r.status}`),
    })),
  ),
)

const quickActions = computed(() => [
  { href: routeHref('/form'), icon: 'plus', label: t('nav.createOrder') },
  ...(isAdmin ? [{ href: routeHref('/products'), icon: 'edit', label: t('products.newProduct') }] : []),
  { href: routeHref('/orders'), icon: 'calendar', label: t('nav.orders') },
  ...(isAdmin ? [{ href: routeHref('/users'), icon: 'user', label: t('nav.users') }] : []),
])

function refresh(): void {
  appMessage.success(tt('dashboard.refreshed'))
}
function exportDemo(): void {
  appMessage.info(tt('dashboard.demoExport'))
}
function viewAllOrders(): void {
  appMessage.info(tt('dashboard.demoOrders'))
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.dashboard') }}</h1>
        <p class="page-subtitle">{{ t('dashboard.welcome', { name, date: todayLabel() }) }}</p>
      </div>
      <oas-space>
        <oas-button id="dash-refresh" icon="refresh" @click="refresh">
          {{ t('common.refresh') }}
        </oas-button>
        <oas-button id="dash-export" icon="download" @click="exportDemo">
          {{ t('dashboard.export') }}
        </oas-button>
      </oas-space>
    </div>

    <div id="stat-grid" class="stat-grid">
      <template v-if="statsReady">
        <oas-card
          v-for="s in STATS"
          :key="s.labelKey"
          class="stat-card"
          :data-testid="s.testid"
        >
          <div class="stat-row">
            <div
              class="stat-icon"
              :style="{ '--stat-icon-bg': getToneVars(s.tone).bg, '--stat-icon-color': getToneVars(s.tone).icon }"
            >
              <oas-icon :name="s.icon" size="16" />
            </div>
            <div class="stat-body">
              <div class="stat-label">{{ t(s.labelKey) }}</div>
              <div class="stat-value mono">{{ formatNumber(s.value) }}{{ s.suffix ?? '' }}</div>
              <div class="stat-delta">
                <oas-icon
                  :name="s.delta >= 0 ? 'arrow-up' : 'arrow-down'"
                  size="12"
                  :class="s.delta >= 0 ? 'delta-up' : 'delta-down'"
                />
                <span :class="s.delta >= 0 ? 'delta-up' : 'delta-down'">
                  {{ s.delta > 0 ? '+' : '' }}{{ s.delta }}%
                </span>
                <span class="stat-delta-label">{{ t('dashboard.vsYesterday') }}</span>
              </div>
            </div>
          </div>
        </oas-card>
      </template>
      <!-- oas-skeleton 的 active 为布尔存在性语义：静态写出即视为真-->
      <template v-else>
        <oas-card v-for="i in 4" :key="i" class="stat-card stat-card--skeleton">
          <oas-skeleton active rows="3" />
        </oas-card>
      </template>
    </div>

    <div class="chart-grid">
      <oas-card :title="t('dashboard.trendTitle')">
        <oas-segmented
          id="trend-range"
          slot="extra"
          :options="segmentedOptions"
          :value="range"
          @oas-change="onRangeChange"
        />
        <oas-chart
          id="chart-trend"
          class="chart"
          type="area"
          :options="trendOptions"
          :data="trendData"
          :aria-label="t('dashboard.trendTitle')"
        />
      </oas-card>
      <oas-card :title="t('dashboard.ordersTitle')">
        <oas-chart
          id="chart-orders"
          class="chart"
          type="donut"
          :options="donutOptions"
          :data="donutData"
          :aria-label="t('dashboard.ordersTitle')"
        />
        <div id="donut-legend-wrap">
          <div class="donut-legend" data-testid="donut-legend">
            <div class="donut-total">
              <span class="mono">{{ formatNumber(breakdown.total) }}</span>
              <span>{{ t('dashboard.ordersLabel') }}</span>
            </div>
            <div class="donut-legend-items">
              <span
                v-for="(s, i) in breakdown.slices"
                :key="s.status"
                class="donut-legend-item"
                :style="{ '--dot': DONUT_COLORS[i] }"
              >
                <i class="donut-dot" />
                <span>{{ t(`orders.status.${s.status}`) }}</span>
                <span class="donut-legend-pct mono">{{ Math.round((s.value / breakdown.total) * 100) }}%</span>
              </span>
            </div>
          </div>
        </div>
      </oas-card>
    </div>

    <div class="bottom-grid">
      <oas-card :title="t('dashboard.recentOrders')">
        <button id="orders-view-all" class="link-btn" slot="extra" @click="viewAllOrders">
          {{ t('dashboard.viewAll') }} <oas-icon name="chevron-right" size="12" />
        </button>
        <oas-table
          data-testid="orders-table"
          row-key="id"
          :columns="orderColumns"
          :data="orderRows"
        />
      </oas-card>
      <oas-card :title="t('dashboard.topProducts')">
        <a class="link-btn" :href="routeHref('/products')" slot="extra">
          {{ t('dashboard.viewAll') }} <oas-icon name="chevron-right" size="12" />
        </a>
        <div id="top5-list" data-testid="top5-list" class="top5-list">
          <template v-if="top5 !== null">
            <oas-empty v-if="top5.length === 0" :description="t('dashboard.noTop5')" />
            <template v-else>
              <div v-for="(p, i) in top5" :key="p.name" class="top5-row">
                <span class="top5-rank" :class="`rank-${i + 1}`">{{ i + 1 }}</span>
                <div class="top5-main">
                  <div class="top5-line">
                    <span class="top5-name" :title="p.name">{{ p.name }}</span>
                    <oas-tag class="top5-tag">{{ p.category }}</oas-tag>
                  </div>
                  <div class="top5-line top5-foot">
                    <oas-progress
                      class="top5-bar"
                      :percent="Math.round((p.sold / (top5[0]?.sold ?? 1)) * 100)"
                      show-text="false"
                    />
                    <span class="top5-sold mono">{{ p.sold }}</span>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </oas-card>
      <oas-card class="quick-card" :title="t('dashboard.quickActions')">
        <div class="quick-actions" data-testid="quick-actions">
          <a v-for="a in quickActions" :key="a.href" class="quick-action" :href="a.href">
            <oas-icon :name="a.icon" size="16" />
            <span>{{ a.label }}</span>
          </a>
        </div>
        <div class="quick-foot">{{ t('dashboard.techNote') }}</div>
      </oas-card>
    </div>
  </div>
</template>

<style scoped>
/* 仪表盘样式（自 app.css 迁入）：仅本页使用的栅格/榜单/快捷入口/指标卡细节 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: var(--oas-space-3);
  margin-bottom: var(--oas-space-3);
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: var(--oas-space-3);
  margin-bottom: var(--oas-space-3);
}

.donut-legend {
  margin-top: var(--oas-space-2);
}

.donut-total {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--oas-space-1);
  color: var(--oas-color-text-primary);
  font-weight: 600;
  margin-bottom: var(--oas-space-1);
}

.donut-total .mono {
  font-size: var(--oas-font-size-lg);
}

.donut-legend-items {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--oas-space-1) var(--oas-space-4);
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-secondary);
}

.donut-legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--oas-space-1);
}

.donut-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--dot);
}

.donut-legend-pct {
  color: var(--oas-color-text-primary);
}

.stat-card--skeleton oas-skeleton {
  height: 96px;
}
.stat-row {
  display: flex;
  align-items: center;
  gap: var(--oas-space-3);
}
.stat-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--oas-radius-md);
  background: color-mix(in srgb, var(--stat-icon-bg, var(--oas-color-primary)) 12%, transparent);
  color: var(--stat-icon-color, var(--oas-color-primary));
}
.stat-body {
  flex: 1;
  min-width: 0;
}
.stat-delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--oas-font-size-xs);
}
.delta-up {
  color: var(--oas-color-success);
}
.delta-down {
  color: var(--oas-color-danger);
}
.stat-delta-label {
  color: var(--oas-color-text-secondary);
}

.bottom-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: var(--oas-space-3);
}

.top5-list {
  display: flex;
  flex-direction: column;
}
.top5-row {
  display: flex;
  align-items: center;
  gap: var(--oas-space-2);
  padding: var(--oas-space-2) 0;
  border-bottom: 1px solid var(--oas-color-border);
}
.top5-row:last-child {
  border-bottom: none;
}
.top5-rank {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-family: var(--app-mono);
  font-size: 12px;
  font-weight: 700;
  background: var(--oas-color-bg-hover);
  color: var(--oas-color-text-secondary);
}
.top5-rank.rank-1 {
  background: color-mix(in srgb, var(--oas-rank-blue-1) 14%, transparent);
  color: var(--oas-rank-blue-1);
}
.top5-rank.rank-2 {
  background: color-mix(in srgb, var(--oas-rank-blue-2) 14%, transparent);
  color: var(--oas-rank-blue-2);
}
.top5-rank.rank-3 {
  background: color-mix(in srgb, var(--oas-rank-blue-3) 14%, transparent);
  color: var(--oas-rank-blue-3);
}
.top5-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-2);
}
.top5-line {
  display: flex;
  align-items: center;
  gap: var(--oas-space-2);
  min-width: 0;
}
.top5-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
}
.top5-tag::part(tag) {
  background: var(--oas-color-bg-hover);
  border-color: transparent;
  color: var(--oas-color-text-secondary);
}
.top5-bar {
  flex: 1;
  min-width: 0;
}
.top5-bar::part(track) {
  height: 6px;
}
.top5-bar::part(bar) {
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--oas-color-primary) 62%, transparent),
    var(--oas-color-primary)
  );
}
.top5-sold {
  flex-shrink: 0;
  min-width: 30px;
  text-align: right;
  font-size: var(--oas-font-size-sm);
  font-weight: 600;
  color: var(--oas-color-text-primary);
}

.quick-card::part(body) {
  display: flex;
  flex-direction: column;
}
.quick-actions {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.quick-action {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--oas-space-3);
  padding: var(--oas-space-2) 0;
  border-bottom: 1px solid var(--oas-color-border);
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}
.quick-action:last-child {
  border-bottom: none;
}
.quick-action oas-icon {
  flex-shrink: 0;
  color: var(--oas-color-text-secondary);
  transition: color 0.15s ease;
}
.quick-action span {
  flex: 1;
  min-width: 0;
}
.quick-action:hover {
  color: var(--oas-color-primary);
}
.quick-action:hover oas-icon {
  color: var(--oas-color-primary);
}
.quick-foot {
  margin-top: var(--oas-space-3);
  font-size: 12px;
  color: var(--oas-color-text-secondary);
}

@media (max-width: 768px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
  .chart-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 992px) {
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}
</style>
