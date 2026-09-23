/**
 * 日志中心页（自 vanilla src/pages/logs.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 统计卡 + 过滤工具栏（级别/关键字/日期范围）+ oas-virtual-list 虚拟列表 + 日期锚点 + 详情弹窗 + CSV 导出
 */
import { onLocaleChange, t } from './i18n.js'
import { listLogs } from './data/logs.js'

const LEVEL_TAG = { info: 'default', warn: 'warning', error: 'danger' }
const ITEM_HEIGHT = 44

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(time) {
  const d = new Date(time)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function dateKey(time) {
  return iso(new Date(time))
}

function anchorLabel(d) {
  const today = iso(new Date())
  const yesterday = iso(new Date(Date.now() - 86400000))
  if (d === today) return t('logs.anchor.today')
  if (d === yesterday) return t('logs.anchor.yesterday')
  return t('logs.anchor.date', { month: d.slice(5, 7), day: d.slice(8, 10) })
}

function buildDateGroups(rows) {
  const groups = []
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

export function renderLogs(el) {
  const state = {
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
          <h1 class="page-title">${t('nav.logs')}</h1>
          <p class="page-subtitle">${t('logs.subtitle')}</p>
        </div>
      </div>
      <div class="logs-stats" id="logs-stats"></div>
      <oas-card class="logs-card" title="${t('logs.cardTitle')}">
        <div class="logs-toolbar" slot="extra">
          <oas-select data-testid="logs-level" placeholder="${t('logs.toolbar.level')}" clearable value="all"></oas-select>
          <oas-input data-testid="logs-keyword" placeholder="${t('logs.toolbar.keyword')}" clearable prefix-icon="search"></oas-input>
          <oas-date-picker data-testid="logs-date" type="daterange" placeholder="${t('logs.toolbar.dateRange')}"></oas-date-picker>
          <oas-button data-testid="logs-export" type="primary" icon="download">${t('logs.export')}</oas-button>
        </div>
        <div class="logs-main">
          <div class="logs-list-wrap">
            <div class="logs-header">
              <span class="logs-h-time">${t('logs.th.time')}</span>
              <span class="logs-h-level">${t('logs.th.level')}</span>
              <span class="logs-h-operator">${t('logs.th.operator')}</span>
              <span class="logs-h-action">${t('logs.th.action')}</span>
              <span class="logs-h-ip">${t('logs.th.ip')}</span>
            </div>
            <div class="logs-list-body">
              <oas-virtual-list data-testid="logs-list" id="logs-list" height="480" item-height="${ITEM_HEIGHT}" buffer="8"></oas-virtual-list>
              <div class="logs-empty" id="logs-empty" hidden>
                <oas-empty description="${t('logs.empty')}"></oas-empty>
              </div>
            </div>
          </div>
          <div class="logs-anchor-wrap">
            <oas-anchor data-testid="logs-anchor" id="logs-anchor" direction="vertical" hash="false"></oas-anchor>
          </div>
        </div>
      </oas-card>
      <oas-modal data-testid="logs-detail" id="logs-detail" title="${t('logs.detailTitle')}" no-footer>
        <div class="logs-detail-body" id="logs-detail-body"></div>
      </oas-modal>
    </div>`

  const vlist = el.querySelector('#logs-list')
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

  const levelSelect = el.querySelector('[data-testid="logs-level"]')
  const keywordInput = el.querySelector('[data-testid="logs-keyword"]')
  const datePicker = el.querySelector('[data-testid="logs-date"]')
  const exportBtn = el.querySelector('[data-testid="logs-export"]')
  const stats = el.querySelector('#logs-stats')
  const anchor = el.querySelector('#logs-anchor')
  const emptyOverlay = el.querySelector('#logs-empty')
  const detailModal = el.querySelector('#logs-detail')
  const detailBody = el.querySelector('#logs-detail-body')

  const dateIndexMap = new Map()
  const hrefDateMap = new Map()

  const LEVEL_VALUES = ['all', 'info', 'warn', 'error']
  const levelLabel = (level) => t(`logs.level.${level}`)
  const LEVEL_OPTIONS = () => LEVEL_VALUES.map((v) => ({ label: levelLabel(v), value: v }))

  function renderVirtualList() {
    vlist.items = state.filtered
  }

  function renderEmpty() {
    const empty = state.filtered.length === 0
    emptyOverlay.hidden = !empty
    vlist.hidden = empty
  }

  function renderStats() {
    const today = iso(new Date())
    const todayCount = state.rows.filter((r) => dateKey(r.time) === today).length
    const errorCount = state.rows.filter((r) => r.level === 'error').length
    const warnCount = state.rows.filter((r) => r.level === 'warn').length
    stats.innerHTML = `
      <oas-card class="stat-card">
        <div class="stat-label">${t('logs.stat.today')}</div>
        <div class="stat-value mono">${todayCount}</div>
        <div class="stat-foot">${today}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">${t('logs.stat.errors')}</div>
        <div class="stat-value mono" style="color:var(--oas-color-danger)">${errorCount}</div>
        <div class="stat-foot">${t('logs.stat.errorLevel')}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">${t('logs.stat.warns')}</div>
        <div class="stat-value mono" style="color:var(--oas-color-warning)">${warnCount}</div>
        <div class="stat-foot">${t('logs.stat.warnLevel')}</div>
      </oas-card>`
  }

  function renderAnchor() {
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

  function scrollToIndex(index) {
    const viewport = vlist.shadowRoot?.querySelector('.viewport')
    if (!viewport) return
    viewport.scrollTop = Math.max(0, index * ITEM_HEIGHT)
  }

  function resetScroll() {
    scrollToIndex(0)
  }

  function updateAnchorActive() {
    const viewport = vlist.shadowRoot?.querySelector('.viewport')
    if (!viewport) return
    const index = Math.min(state.filtered.length - 1, Math.floor(viewport.scrollTop / ITEM_HEIGHT))
    const row = state.filtered[index]
    if (!row) return
    anchor.setAttribute('active', `#logs-day-${dateKey(row.time)}`)
  }

  function openDetail(row) {
    state.selected = row
    detailBody.innerHTML = `
      <oas-descriptions column="1">
        <oas-descriptions-item label="${t('logs.dl.id')}"><span class="mono">${row.id}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.time')}"><span class="mono">${row.time}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.level')}"><oas-tag type="${LEVEL_TAG[row.level]}">${levelLabel(row.level)}</oas-tag></oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.operator')}">${row.operator}</oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.action')}">${row.action}</oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.ip')}"><span class="mono">${row.IP}</span></oas-descriptions-item>
      </oas-descriptions>`
    detailModal.setAttribute('visible', '')
  }

  async function applyFilter() {
    state.filtered = await listLogs({
      level: state.level,
      keyword: state.keyword,
      dateRange: state.dateRange ?? undefined,
    })
    // stale 守卫：等待期间导航离开后 el 已脱离文档，续体渲染只会写入陈旧 DOM，直接放弃
    if (!el.isConnected) return
    renderVirtualList()
    renderAnchor()
    renderStats()
    renderEmpty()
    resetScroll()
  }

  levelSelect.setAttribute('options', JSON.stringify(LEVEL_OPTIONS()))
  levelSelect.setAttribute('value', 'all')
  levelSelect.addEventListener('oas-change', (e) => {
    state.level = e.detail.value || 'all'
    applyFilter()
  })

  keywordInput.addEventListener('oas-input', (e) => {
    state.keyword = e.detail.value
    applyFilter()
  })
  keywordInput.addEventListener('oas-clear', () => {
    state.keyword = ''
    applyFilter()
  })

  datePicker.addEventListener('oas-change', (e) => {
    const value = e.detail.value
    if (Array.isArray(value) && value.length === 2 && value[0] && value[1]) {
      state.dateRange = [value[0], value[1]]
    } else {
      state.dateRange = null
    }
    applyFilter()
  })

  exportBtn.addEventListener('click', () => {
    if (state.filtered.length === 0) {
      OASUI.message.info(t('logs.noExportable'))
      return
    }
    const header = t('logs.exportHeader')
    const body = state.filtered.map((r) =>
      [r.time, levelLabel(r.level), r.operator, r.action, r.IP].join(','),
    )
    const csv = `﻿${[header, ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    OASUI.message.success(t('logs.exported', { count: state.filtered.length }))
  })

  vlist.addEventListener('oas-item', (e) => {
    const { item, element } = e.detail
    element.querySelector('[data-col="time"]').textContent = formatTime(item.time)
    const tag = element.querySelector('oas-tag')
    tag.textContent = levelLabel(item.level)
    tag.setAttribute('type', LEVEL_TAG[item.level])
    element.querySelector('[data-col="operator"]').textContent = item.operator
    element.querySelector('[data-col="action"]').textContent = item.action
    element.querySelector('[data-col="ip"]').textContent = item.IP
    element.addEventListener('click', () => openDetail(item))
  })

  vlist.addEventListener('oas-scroll', () => {
    updateAnchorActive()
  })

  anchor.addEventListener('oas-click', (e) => {
    const href = e.detail.href
    const d = hrefDateMap.get(href)
    if (d === undefined) return
    scrollToIndex(dateIndexMap.get(d) ?? 0)
    anchor.setAttribute('active', href)
  })

  // vanilla 同款 no-op：关闭时移除已移除的 visible 属性，保持不修
  detailModal.addEventListener('oas-cancel', () => {
    detailModal.removeAttribute('visible')
    state.selected = null
  })

  const mq = window.matchMedia('(max-width: 768px)')
  function syncAnchorDirection() {
    anchor.setAttribute('direction', mq.matches ? 'horizontal' : 'vertical')
  }
  syncAnchorDirection()
  mq.addEventListener('change', syncAnchorDirection)

  async function init() {
    state.rows = await listLogs()
    // stale 守卫：同 applyFilter，导航离开后不再续写已脱离文档的 DOM
    if (!el.isConnected) return
    await applyFilter()
  }

  function refreshText() {
    document.title = `${t('nav.logs')} · ${t('app.title')}`
    el.querySelector('h1.page-title').textContent = t('nav.logs')
    el.querySelector('p.page-subtitle').textContent = t('logs.subtitle')
    el.querySelector('.logs-card').setAttribute('title', t('logs.cardTitle'))
    levelSelect.setAttribute('placeholder', t('logs.toolbar.level'))
    levelSelect.setAttribute('options', JSON.stringify(LEVEL_OPTIONS()))
    keywordInput.setAttribute('placeholder', t('logs.toolbar.keyword'))
    el.querySelector('[data-testid="logs-date"]').setAttribute(
      'placeholder',
      t('logs.toolbar.dateRange'),
    )
    el.querySelector('[data-testid="logs-export"]').textContent = t('logs.export')
    const HEADERS = [
      ['.logs-h-time', 'logs.th.time'],
      ['.logs-h-level', 'logs.th.level'],
      ['.logs-h-operator', 'logs.th.operator'],
      ['.logs-h-action', 'logs.th.action'],
      ['.logs-h-ip', 'logs.th.ip'],
    ]
    for (const [sel, k] of HEADERS) {
      el.querySelector(sel).textContent = t(k)
    }
    el.querySelector('#logs-empty oas-empty').setAttribute('description', t('logs.empty'))
    el.querySelector('[data-testid="logs-detail"]').setAttribute('title', t('logs.detailTitle'))
    // 统计卡 + 虚拟列表行内级别标签随语言重渲；过滤条件/滚动位置不动
    renderStats()
    renderVirtualList()
  }

  document.title = `${t('nav.logs')} · ${t('app.title')}`
  init()

  const offLocale = onLocaleChange(refreshText)
  return () => {
    mq.removeEventListener('change', syncAnchorDirection)
    offLocale()
  }
}
