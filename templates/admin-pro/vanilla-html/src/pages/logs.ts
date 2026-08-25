import '../styles/pages/logs.css'
import '@oas-ui/ui/data/virtual-list'
import '@oas-ui/ui/navigation/anchor'
import { message } from '@oas-ui/ui/feedback/message'
import { listLogs, type LogEntry, type LogLevel } from '../data/logs'

const LEVEL_OPTIONS = [
  { label: '全部级别', value: 'all' },
  { label: '信息', value: 'info' },
  { label: '告警', value: 'warn' },
  { label: '错误', value: 'error' },
]

const LEVEL_TAG: Record<LogLevel, string> = {
  info: 'default',
  warn: 'warning',
  error: 'danger',
}

const LEVEL_LABEL: Record<LogLevel | 'all', string> = {
  all: '全部级别',
  info: '信息',
  warn: '告警',
  error: '错误',
}

const ITEM_HEIGHT = 44

interface PageState {
  rows: LogEntry[]
  filtered: LogEntry[]
  level: LogLevel | 'all'
  keyword: string
  dateRange: [string, string] | null
  selected: LogEntry | null
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatTime(t: string): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function dateKey(t: string): string {
  return t.slice(0, 10)
}

function anchorLabel(d: string): string {
  const today = iso(new Date())
  const yesterday = iso(new Date(Date.now() - 86400000))
  if (d === today) return '今天'
  if (d === yesterday) return '昨天'
  return `${d.slice(5, 7)}月${d.slice(8, 10)}日`
}

interface DateGroup {
  date: string
  label: string
  index: number
}

function buildDateGroups(rows: LogEntry[]): DateGroup[] {
  const groups: DateGroup[] = []
  let lastDate = ''
  for (let i = 0; i < rows.length; i++) {
    const d = dateKey(rows[i].time)
    if (d !== lastDate) {
      groups.push({ date: d, label: anchorLabel(d), index: i })
      lastDate = d
    }
  }
  return groups
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    filtered: [],
    level: 'all',
    keyword: '',
    dateRange: null,
    selected: null,
  }

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">日志中心</h1>
          <p class="page-subtitle">系统操作日志查询与审计</p>
        </div>
      </div>
      <div class="logs-stats" id="logs-stats"></div>
      <oas-card class="logs-card" title="操作日志">
        <div class="logs-toolbar" slot="extra">
          <oas-select data-testid="logs-level" placeholder="级别" clearable value="all"></oas-select>
          <oas-input data-testid="logs-keyword" placeholder="关键词" clearable prefix-icon="search"></oas-input>
          <oas-date-picker data-testid="logs-date" type="daterange" placeholder="日期范围"></oas-date-picker>
          <oas-button data-testid="logs-export" type="primary" icon="download">导出</oas-button>
        </div>
        <div class="logs-main">
          <div class="logs-list-wrap">
            <div class="logs-header">
              <span class="logs-h-time">时间</span>
              <span class="logs-h-level">级别</span>
              <span class="logs-h-operator">操作人</span>
              <span class="logs-h-action">动作</span>
              <span class="logs-h-ip">IP</span>
            </div>
            <div class="logs-list-body">
              <oas-virtual-list data-testid="logs-list" id="logs-list" height="480" item-height="${ITEM_HEIGHT}" buffer="8"></oas-virtual-list>
              <div class="logs-empty" id="logs-empty" hidden>
                <oas-empty description="未找到匹配日志"></oas-empty>
              </div>
            </div>
          </div>
          <div class="logs-anchor-wrap">
            <oas-anchor data-testid="logs-anchor" id="logs-anchor" direction="vertical" hash="false"></oas-anchor>
          </div>
        </div>
      </oas-card>
      <oas-modal data-testid="logs-detail" id="logs-detail" title="日志详情" no-footer>
        <div class="logs-detail-body" id="logs-detail-body"></div>
      </oas-modal>
    </div>`

  const vlist = el.querySelector<HTMLElement>('#logs-list')!
  const template = document.createElement('template')
  template.setAttribute('slot', 'item')
  template.innerHTML = `
    <style>
      .logs-cell {
        font-size: var(--oas-font-size-sm);
        color: var(--oas-color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .logs-cell.mono {
        font-family: var(--app-mono);
      }
      .logs-cell.logs-time {
        color: var(--oas-color-text-secondary);
      }
      @media (max-width: 768px) {
        .logs-cell {
          font-size: var(--oas-font-size-xs);
        }
      }
    </style>
    <span class="logs-cell logs-time mono" data-col="time"></span>
    <span class="logs-cell logs-level" data-col="level"><oas-tag size="small"></oas-tag></span>
    <span class="logs-cell logs-operator" data-col="operator"></span>
    <span class="logs-cell logs-action" data-col="action"></span>
    <span class="logs-cell logs-ip mono" data-col="ip"></span>`
  vlist.appendChild(template)

  const levelSelect = el.querySelector<HTMLElement>('[data-testid="logs-level"]')!
  const keywordInput = el.querySelector<HTMLElement>('[data-testid="logs-keyword"]')!
  const datePicker = el.querySelector<HTMLElement>('[data-testid="logs-date"]')!
  const exportBtn = el.querySelector<HTMLElement>('[data-testid="logs-export"]')!
  const stats = el.querySelector<HTMLElement>('#logs-stats')!
  const anchor = el.querySelector<HTMLElement>('#logs-anchor')!
  const emptyOverlay = el.querySelector<HTMLElement>('#logs-empty')!
  const detailModal = el.querySelector<HTMLElement>('#logs-detail')!
  const detailBody = el.querySelector<HTMLElement>('#logs-detail-body')!

  const dateIndexMap = new Map<string, number>()
  const hrefDateMap = new Map<string, string>()

  function renderVirtualList(): void {
    ;(vlist as unknown as { items: LogEntry[] }).items = state.filtered
  }

  function renderEmpty(): void {
    const empty = state.filtered.length === 0
    emptyOverlay.hidden = !empty
    vlist.hidden = empty
  }

  function renderStats(): void {
    const today = iso(new Date())
    const todayCount = state.rows.filter((r) => dateKey(r.time) === today).length
    const errorCount = state.rows.filter((r) => r.level === 'error').length
    const warnCount = state.rows.filter((r) => r.level === 'warn').length
    stats.innerHTML = `
      <oas-card class="stat-card">
        <div class="stat-label">今日新增</div>
        <div class="stat-value mono">${todayCount}</div>
        <div class="stat-foot">${today}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">错误数</div>
        <div class="stat-value mono" style="color:var(--oas-color-danger)">${errorCount}</div>
        <div class="stat-foot">error 级别</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">告警数</div>
        <div class="stat-value mono" style="color:var(--oas-color-warning)">${warnCount}</div>
        <div class="stat-foot">warn 级别</div>
      </oas-card>`
  }

  function renderAnchor(): void {
    const groups = buildDateGroups(state.filtered)
    dateIndexMap.clear()
    hrefDateMap.clear()
    const items = groups.map((g) => {
      const href = `#logs-day-${g.date}`
      dateIndexMap.set(g.date, g.index)
      hrefDateMap.set(href, g.date)
      return { href, title: `${g.label} (${g.date.slice(5)})` }
    })
    anchor.setAttribute('items', JSON.stringify(items))
  }

  function scrollToIndex(index: number): void {
    const viewport = (
      vlist as unknown as { shadowRoot: ShadowRoot }
    ).shadowRoot.querySelector<HTMLElement>('.viewport')
    if (!viewport) return
    viewport.scrollTop = Math.max(0, index * ITEM_HEIGHT)
  }

  function resetScroll(): void {
    scrollToIndex(0)
  }

  function updateAnchorActive(): void {
    const viewport = (
      vlist as unknown as { shadowRoot: ShadowRoot }
    ).shadowRoot.querySelector<HTMLElement>('.viewport')
    if (!viewport) return
    const index = Math.min(state.filtered.length - 1, Math.floor(viewport.scrollTop / ITEM_HEIGHT))
    const row = state.filtered[index]
    if (!row) return
    const d = dateKey(row.time)
    anchor.setAttribute('active', `#logs-day-${d}`)
  }

  function openDetail(row: LogEntry): void {
    state.selected = row
    detailBody.innerHTML = `
      <oas-descriptions column="1">
        <oas-descriptions-item label="ID"><span class="mono">${row.id}</span></oas-descriptions-item>
        <oas-descriptions-item label="时间"><span class="mono">${row.time}</span></oas-descriptions-item>
        <oas-descriptions-item label="级别"><oas-tag type="${LEVEL_TAG[row.level]}">${LEVEL_LABEL[row.level]}</oas-tag></oas-descriptions-item>
        <oas-descriptions-item label="操作人">${row.operator}</oas-descriptions-item>
        <oas-descriptions-item label="动作">${row.action}</oas-descriptions-item>
        <oas-descriptions-item label="IP"><span class="mono">${row.IP}</span></oas-descriptions-item>
      </oas-descriptions>`
    detailModal.setAttribute('visible', '')
  }

  async function applyFilter(): Promise<void> {
    const list = await listLogs({
      level: state.level,
      keyword: state.keyword,
      dateRange: state.dateRange ?? undefined,
    })
    state.filtered = list
    renderVirtualList()
    renderAnchor()
    renderStats()
    renderEmpty()
    resetScroll()
  }

  levelSelect.setAttribute('options', JSON.stringify(LEVEL_OPTIONS))
  levelSelect.setAttribute('value', 'all')
  levelSelect.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    state.level = (value || 'all') as LogLevel | 'all'
    applyFilter()
  })

  keywordInput.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value
    applyFilter()
  })
  keywordInput.addEventListener('oas-clear', () => {
    state.keyword = ''
    applyFilter()
  })

  datePicker.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string[] | string }>).detail.value
    if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
      state.dateRange = [value[0], value[1]]
    } else {
      state.dateRange = null
    }
    applyFilter()
  })

  exportBtn.addEventListener('click', () => {
    if (state.filtered.length === 0) {
      message.info('没有可导出的日志')
      return
    }
    const header = '时间,级别,操作人,动作,IP'
    const body = state.filtered.map((r) =>
      [r.time, LEVEL_LABEL[r.level], r.operator, r.action, r.IP].join(','),
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
    message.success(`已导出 ${state.filtered.length} 条日志`)
  })

  vlist.addEventListener('oas-item', (e) => {
    const { item, element } = (e as CustomEvent<{ item: LogEntry; element: HTMLElement }>).detail
    const row = item
    element.querySelector<HTMLElement>('[data-col="time"]')!.textContent = formatTime(row.time)
    const tag = element.querySelector('oas-tag')!
    tag.textContent = LEVEL_LABEL[row.level]
    tag.setAttribute('type', LEVEL_TAG[row.level])
    element.querySelector<HTMLElement>('[data-col="operator"]')!.textContent = row.operator
    element.querySelector<HTMLElement>('[data-col="action"]')!.textContent = row.action
    element.querySelector<HTMLElement>('[data-col="ip"]')!.textContent = row.IP
    element.addEventListener('click', () => openDetail(row))
  })

  vlist.addEventListener('oas-scroll', () => {
    updateAnchorActive()
  })

  anchor.addEventListener('oas-click', (e) => {
    const href = (e as CustomEvent<{ href: string }>).detail.href
    const d = hrefDateMap.get(href)
    if (d === undefined) return
    const index = dateIndexMap.get(d) ?? 0
    scrollToIndex(index)
    anchor.setAttribute('active', href)
  })

  detailModal.addEventListener('oas-cancel', () => {
    detailModal.removeAttribute('visible')
    state.selected = null
  })

  const mq = window.matchMedia('(max-width: 768px)')
  function syncAnchorDirection(): void {
    anchor.setAttribute('direction', mq.matches ? 'horizontal' : 'vertical')
  }
  syncAnchorDirection()
  mq.addEventListener('change', syncAnchorDirection)

  async function init(): Promise<void> {
    state.rows = await listLogs()
    await applyFilter()
  }
  init()

  return () => {
    mq.removeEventListener('change', syncAnchorDirection)
  }
}
