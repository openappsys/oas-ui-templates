<script lang="ts">
  // src/pages/logs.svelte —— 日志中心（虚拟列表 + 日期锚点 + 统计卡 + 多条件过滤 + CSV 导出）
  // 对齐 react 版 logs.tsx：全量（统计卡）与过滤集（虚拟列表）拆两组数据；过滤条件变化即重取；
  // 统计/锚点分组/空态全部由 state 派生；数据变化回顶、语言切换锚点标题/表头/选项重算而
  // 过滤条件与滚动位置不动。
  // 1. 事件绑定：level/keyword/date 的 oas-change/oas-input/oas-clear、虚拟列表 oas-item/
  //    oas-scroll、锚点 oas-click、modal oas-cancel 模板直绑；导出按钮为原生 click 直绑
  // 2. 子组件拆分（单文件 ≤400 行纪律）：纯函数助手与行模板 ./logs-shared.ts、
  //    虚拟列表 ./logs-vlist.svelte（items 注入/buffer/行回填/滚动索引）
  import { onMount } from 'svelte'
  import '../styles/pages/logs.css'
  type LogEntry = import('../data/logs').LogEntry
  type LogLevel = import('../data/logs').LogLevel
  import { listLogs } from '../data/logs'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'
  import {
    buildDateGroups,
    dateKey,
    LEVEL_TAG,
    levelLabel,
    levelOptions,
  } from './logs-shared'
  import LogsVList from './logs-vlist.svelte'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let rows = $state<LogEntry[]>([])
  let filtered = $state<LogEntry[]>([])
  let level = $state<LogLevel | 'all'>('all')
  let keyword = $state('')
  let dateRange = $state<[string, string] | null>(null)
  let selected = $state<LogEntry | null>(null)
  let detailOpen = $state(false)
  let activeHref = $state<string | undefined>(undefined)
  let compact = $state(false)

  let vlistComp: ReturnType<typeof LogsVList> | null = $state(null)
  let logsCardEl: HTMLElement | null = $state(null)
  let detailModalEl: HTMLElement | null = $state(null)

  // title 命中 HTMLElement.prototype.title（property 通道会把未升级元素的 attribute 遮蔽掉），
  // oas-* 元素上的 title 必须走 setAttribute 通道
  $effect(() => {
    logsCardEl?.setAttribute('title', tt('logs.cardTitle'))
    detailModalEl?.setAttribute('title', tt('logs.detailTitle'))
  })

  onMount(() => {
    void (async () => {
      rows = await listLogs()
      await applyFilter()
    })()
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => (compact = mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  })

  /** 过滤条件变化即重取（清条件回落全量语义由 listLogs 自己保证） */
  async function applyFilter(): Promise<void> {
    filtered = await listLogs({
      level,
      keyword,
      dateRange: dateRange ?? undefined,
    })
  }

  const stats = $derived.by(() => {
    const today = dateKey(new Date().toISOString())
    return {
      today,
      todayCount: rows.filter((r) => dateKey(r.time) === today).length,
      errorCount: rows.filter((r) => r.level === 'error').length,
      warnCount: rows.filter((r) => r.level === 'warn').length,
    }
  })

  const levelOptionsJson = $derived.by(() => {
    void $locale
    return JSON.stringify(levelOptions(tt))
  })

  /** 锚点分组：按日期切分过滤结果（随 locale 重算标题，index 不变） */
  const groups = $derived.by(() => {
    void $locale
    return buildDateGroups(filtered, tt)
  })

  const anchorItemsJson = $derived(
    JSON.stringify(
      groups.map((g) => ({
        href: `#logs-day-${g.date}`,
        title: `${g.label} (${g.date.slice(5)})`,
      })),
    ),
  )

  /** href → 该日首行行号（锚点点击定位用反查表） */
  const hrefIndexMap = $derived(
    new Map<string, number>(groups.map((g) => [`#logs-day-${g.date}`, g.index])),
  )

  function updateAnchorActive(): void {
    const index = Math.min(
      filtered.length - 1,
      vlistComp?.currentScrollIndex() ?? 0,
    )
    const row = filtered[index]
    if (!row) return
    activeHref = `#logs-day-${dateKey(row.time)}`
  }

  function onAnchorClick(e: Event): void {
    const href = (e as CustomEvent<{ href: string }>).detail.href
    const index = hrefIndexMap.get(href)
    if (index === undefined) return
    vlistComp?.scrollToIndex(index)
    activeHref = href
  }

  function onLevelChange(e: Event): void {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    level = (value || 'all') as LogLevel | 'all'
    void applyFilter()
  }
  function onKeywordInput(e: Event): void {
    keyword = (e as CustomEvent<{ value: string }>).detail.value
    void applyFilter()
  }
  function onKeywordClear(): void {
    keyword = ''
    void applyFilter()
  }
  function onDateChange(e: Event): void {
    const value = (e as CustomEvent<{ value: string[] | string }>).detail.value
    if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
      dateRange = [value[0], value[1]]
    } else {
      dateRange = null
    }
    void applyFilter()
  }

  function onDetailCancel(): void {
    detailOpen = false
    selected = null
  }

  function onExport(): void {
    if (filtered.length === 0) {
      appMessage.info(tt('logs.noExportable'))
      return
    }
    const header = tt('logs.exportHeader')
    const body = filtered.map((r) =>
      [r.time, levelLabel(r.level, tt), r.operator, r.action, r.IP].join(','),
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
    appMessage.success(tt('logs.exported', { count: filtered.length }))
  }

  const empty = $derived(filtered.length === 0)
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.logs')}</h1>
      <p class="page-subtitle">{tt('logs.subtitle')}</p>
    </div>
  </div>
  <div class="logs-stats" id="logs-stats">
    <oas-card class="stat-card">
      <div class="stat-label">{tt('logs.stat.today')}</div>
      <div class="stat-value mono">{stats.todayCount}</div>
      <div class="stat-foot">{stats.today}</div>
    </oas-card>
    <oas-card class="stat-card">
      <div class="stat-label">{tt('logs.stat.errors')}</div>
      <div class="stat-value mono" style="color: var(--oas-color-danger)">{stats.errorCount}</div>
      <div class="stat-foot">{tt('logs.stat.errorLevel')}</div>
    </oas-card>
    <oas-card class="stat-card">
      <div class="stat-label">{tt('logs.stat.warns')}</div>
      <div class="stat-value mono" style="color: var(--oas-color-warning)">{stats.warnCount}</div>
      <div class="stat-foot">{tt('logs.stat.warnLevel')}</div>
    </oas-card>
  </div>
  <oas-card bind:this={logsCardEl} class="logs-card">
    <div class="logs-toolbar" slot="extra">
      <oas-select
        data-testid="logs-level"
        placeholder={tt('logs.toolbar.level')}
        clearable
        value={level}
        options={levelOptionsJson}
        onoas-change={onLevelChange}
      ></oas-select>
      <oas-input
        data-testid="logs-keyword"
        placeholder={tt('logs.toolbar.keyword')}
        clearable
        prefix-icon="search"
        onoas-input={onKeywordInput}
        onoas-clear={onKeywordClear}
      ></oas-input>
      <oas-date-picker
        data-testid="logs-date"
        type="daterange"
        placeholder={tt('logs.toolbar.dateRange')}
        onoas-change={onDateChange}
      ></oas-date-picker>
      <oas-button data-testid="logs-export" type="primary" icon="download" onclick={onExport}>
        {tt('logs.export')}
      </oas-button>
    </div>
    <div class="logs-main">
      <div class="logs-list-wrap">
        <div class="logs-header">
          <span class="logs-h-time">{tt('logs.th.time')}</span>
          <span class="logs-h-level">{tt('logs.th.level')}</span>
          <span class="logs-h-operator">{tt('logs.th.operator')}</span>
          <span class="logs-h-action">{tt('logs.th.action')}</span>
          <span class="logs-h-ip">{tt('logs.th.ip')}</span>
        </div>
        <div class="logs-list-body">
          <LogsVList
            bind:this={vlistComp}
            rows={filtered}
            {empty}
            onOpenDetail={(entry) => {
              selected = entry
              detailOpen = true
            }}
            onScroll={updateAnchorActive}
          />
          <div class="logs-empty" id="logs-empty" hidden={!empty}>
            <oas-empty description={tt('logs.empty')}></oas-empty>
          </div>
        </div>
      </div>
      <div class="logs-anchor-wrap">
        <oas-anchor
          data-testid="logs-anchor"
          id="logs-anchor"
          direction={compact ? 'horizontal' : 'vertical'}
          hash="false"
          items={anchorItemsJson}
          active={activeHref}
          onoas-click={onAnchorClick}
        ></oas-anchor>
      </div>
    </div>
  </oas-card>
  <oas-modal
    bind:this={detailModalEl}
    data-testid="logs-detail"
    id="logs-detail"
    no-footer
    visible={detailOpen ? '' : null}
    onoas-cancel={onDetailCancel}
  >
    <div class="logs-detail-body" id="logs-detail-body">
      <oas-descriptions column="1">
        <oas-descriptions-item label={tt('logs.dl.id')}>
          <span class="mono">{selected?.id ?? ''}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('logs.th.time')}>
          <span class="mono">{selected?.time ?? ''}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('logs.th.level')}>
          {#if selected}
            <oas-tag type={LEVEL_TAG[selected.level]}>
              {levelLabel(selected.level, tt)}
            </oas-tag>
          {/if}
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('logs.th.operator')}>
          {selected?.operator ?? ''}
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('logs.th.action')}>
          {selected?.action ?? ''}
        </oas-descriptions-item>
        <oas-descriptions-item label={tt('logs.th.ip')}>
          <span class="mono">{selected?.IP ?? ''}</span>
        </oas-descriptions-item>
      </oas-descriptions>
    </div>
  </oas-modal>
</div>
