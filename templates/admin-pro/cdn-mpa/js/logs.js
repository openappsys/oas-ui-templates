import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { listLogs } from './data/logs.js'

function boot() {
  document.title = `${t('nav.logs')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './logs.html' })
  window.OASShell.setBreadcrumb([{ label: 'nav.logs' }])
  renderLogs()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

const LEVEL_TAG = { info: 'default', warn: 'warning', error: 'danger' }
const ITEM_HEIGHT = 44

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(timeStr) {
  const d = new Date(timeStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function dateKey(timeStr) {
  return iso(new Date(timeStr))
}

function anchorLabel(d) {
  const today = iso(new Date())
  const yesterday = iso(new Date(Date.now() - 86400000))
  if (d === today) return t('logs.anchor.today')
  if (d === yesterday) return t('logs.anchor.yesterday')
  return tf('logs.anchor.date', { month: d.slice(5, 7), day: d.slice(8, 10) })
}

// 日期分组（锚点用）
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

function levelOptions() {
  return ['all', 'info', 'warn', 'error'].map((v) => ({
    label: t(`logs.level.${v}`),
    value: v,
  }))
}

function renderLogs() {
  const state = {
    rows: [],
    filtered: [],
    level: 'all',
    keyword: '',
    dateRange: null,
  }

  const vlist = document.querySelector('#logs-list')
  const levelSelect = document.querySelector('[data-testid="logs-level"]')
  const keywordInput = document.querySelector('[data-testid="logs-keyword"]')
  const datePicker = document.querySelector('[data-testid="logs-date"]')
  const exportBtn = document.querySelector('[data-testid="logs-export"]')
  const stats = document.querySelector('#logs-stats')
  const anchor = document.querySelector('#logs-anchor')
  const emptyOverlay = document.querySelector('#logs-empty')
  const detailModal = document.querySelector('[data-testid="logs-detail"]')
  const detailBody = document.querySelector('#logs-detail-body')

  const dateIndexMap = new Map()
  const hrefDateMap = new Map()

  function renderVirtualList() {
    // items 走 property 赋值（数组对象直传，对齐 vanilla）
    vlist.items = state.filtered
  }

  function renderEmpty() {
    const isEmpty = state.filtered.length === 0
    emptyOverlay.hidden = !isEmpty
    vlist.hidden = isEmpty
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

  function updateAnchorActive() {
    const viewport = vlist.shadowRoot?.querySelector('.viewport')
    if (!viewport) return
    const index = Math.min(state.filtered.length - 1, Math.floor(viewport.scrollTop / ITEM_HEIGHT))
    const row = state.filtered[index]
    if (!row) return
    anchor.setAttribute('active', `#logs-day-${dateKey(row.time)}`)
  }

  function openDetail(row) {
    detailBody.innerHTML = `
      <oas-descriptions column="1">
        <oas-descriptions-item label="${t('logs.dl.id')}"><span class="mono">${row.id}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.time')}"><span class="mono">${row.time}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('logs.th.level')}"><oas-tag type="${LEVEL_TAG[row.level]}">${t(`logs.level.${row.level}`)}</oas-tag></oas-descriptions-item>
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
    renderVirtualList()
    renderAnchor()
    renderStats()
    renderEmpty()
    scrollToIndex(0)
  }

  levelSelect.setAttribute('options', JSON.stringify(levelOptions()))
  levelSelect.setAttribute('value', 'all')
  levelSelect.addEventListener('oas-change', (e) => {
    state.level = e.detail?.value || 'all'
    applyFilter()
  })

  keywordInput.addEventListener('oas-input', (e) => {
    state.keyword = e.detail?.value ?? ''
    applyFilter()
  })
  keywordInput.addEventListener('oas-clear', () => {
    state.keyword = ''
    applyFilter()
  })

  datePicker.addEventListener('oas-change', (e) => {
    const value = e.detail?.value
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
      [r.time, t(`logs.level.${r.level}`), r.operator, r.action, r.IP].join(','),
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
    OASUI.message.success(tf('logs.exported', { count: state.filtered.length }))
  })

  // 虚拟列表行渲染：填单元格 + 级别标签 + 点击开详情
  vlist.addEventListener('oas-item', (e) => {
    const { item, element } = e.detail
    element.querySelector('[data-col="time"]').textContent = formatTime(item.time)
    const tag = element.querySelector('oas-tag')
    tag.textContent = t(`logs.level.${item.level}`)
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
    const href = e.detail?.href
    const d = hrefDateMap.get(href)
    if (d === undefined) return
    scrollToIndex(dateIndexMap.get(d) ?? 0)
    anchor.setAttribute('active', href)
  })

  detailModal.addEventListener('oas-cancel', () => {
    detailModal.removeAttribute('visible')
  })

  // 移动端锚点横向排布
  const mq = window.matchMedia('(max-width: 768px)')
  function syncAnchorDirection() {
    anchor.setAttribute('direction', mq.matches ? 'horizontal' : 'vertical')
  }
  syncAnchorDirection()
  mq.addEventListener('change', syncAnchorDirection)

  async function init() {
    state.rows = await listLogs()
    await applyFilter()
  }
  init()
}

if (guard()) boot()
