import { guard, readSession } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { listOrders, updateOrderStatus } from './data/orders.js'

// 每页条数跟随设置中心（settings 页 page-size）；未设置时保持原默认 8
function pageSize() {
  const raw = localStorage.getItem('oas-admin-cdn-mpa.settings.page-size')
  const n = raw ? Number(raw) : 0
  return n > 0 ? n : 8
}

const STATUS_TAG = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}
const TABS = () => [
  { label: t('orders.tabAll'), value: 'all' },
  { label: statusLabel('pending'), value: 'pending' },
  { label: statusLabel('paid'), value: 'paid' },
  { label: statusLabel('shipping'), value: 'shipping' },
  { label: statusLabel('done'), value: 'done' },
  { label: statusLabel('cancelled'), value: 'cancelled' },
]
const FLOW_TO = { pending: 'paid', paid: 'shipping', shipping: 'done' }

function statusLabel(status) {
  return t(`orders.status.${status}`)
}

function flowFor(status) {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

function formatMoney(n) {
  return `¥ ${n.toLocaleString('en-US')}`
}

function itemSummary(items) {
  if (items.length <= 2) return items.join(t('orders.itemJoin'))
  return tf('orders.itemSummary', {
    names: items.slice(0, 2).join(t('orders.itemJoin')),
    total: items.length,
  })
}

function setTagType(tag, status) {
  const type = STATUS_TAG[status]
  if (type === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', type)
    tag.removeAttribute('color')
  }
}

function statusCell(row) {
  const tag = document.createElement('oas-tag')
  tag.textContent = statusLabel(row.status)
  setTagType(tag, row.status)
  return tag
}

function moneyCell(row) {
  const span = document.createElement('span')
  span.className = 'mono'
  span.textContent = formatMoney(row.amount)
  return span
}

function tableColumns() {
  return [
    { key: 'no', title: '#', serialNumber: true, width: '48px' },
    { key: 'id', title: t('orders.th.no') },
    { key: 'customer', title: t('orders.th.customer') },
    {
      key: 'items',
      title: t('orders.th.items'),
      ellipsis: true,
      render: (r) => String(itemSummary(r.items)),
    },
    {
      key: 'amount',
      title: t('orders.th.amount'),
      align: 'right',
      summary: 'sum',
      render: (r) => moneyCell(r),
    },
    { key: 'status', title: t('orders.th.status'), render: (r) => statusCell(r) },
    { key: 'created', title: t('orders.th.created') },
  ]
}

if (guard()) {
  document.title = `${t('nav.orders')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './orders.html' })
  renderOrders()
}

function renderOrders() {
  const state = { rows: [], keyword: '', status: 'all', selectedId: null }
  const table = document.querySelector('[data-testid="orders-list"]')
  const search = document.querySelector('[data-testid="orders-search"]')
  const tabs = document.querySelector('[data-testid="orders-tabs"]')
  const tableWrap = document.querySelector('#orders-table-wrap')
  const emptyOverlay = document.querySelector('#orders-empty')
  const stats = document.querySelector('#orders-stats')
  const drawer = document.querySelector('[data-testid="order-drawer"]')
  const scopeEl = document.querySelector('#orders-scope')
  table.setAttribute('page-size', String(pageSize()))

  function filtered() {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (state.status !== 'all' && r.status !== state.status) return false
      if (kw && !r.customer.toLowerCase().includes(kw)) return false
      return true
    })
  }

  function renderTabs() {
    const counts = { all: state.rows.length }
    for (const r of state.rows) counts[r.status] = (counts[r.status] ?? 0) + 1
    tabs.innerHTML = TABS()
      .map(
        (tItem) =>
          `<oas-tab-panel label="${tItem.label}" value="${tItem.value}"${counts[tItem.value] ? ` badge="${counts[tItem.value]}"` : ''}></oas-tab-panel>`,
      )
      .join('')
    tabs.setAttribute('active', state.status)
  }

  function setEmpty(empty) {
    if (empty) {
      table.setAttribute('data', '[]')
      emptyOverlay.hidden = false
      tableWrap.classList.add('is-empty')
    } else {
      emptyOverlay.hidden = true
      tableWrap.classList.remove('is-empty')
    }
  }

  function renderTable() {
    const list = filtered()
    table.columns = tableColumns()
    if (list.length === 0) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    table.setAttribute('data', JSON.stringify(list))
  }

  function renderStats() {
    const pending = state.rows.filter((r) => r.status === 'pending' || r.status === 'paid').length
    const monthPrefix = new Date().toISOString().slice(0, 7)
    const monthSales = state.rows
      .filter((r) => r.created.startsWith(monthPrefix))
      .reduce((sum, r) => sum + r.amount, 0)
    const doneRate = state.rows.length
      ? Math.round((state.rows.filter((r) => r.status === 'done').length / state.rows.length) * 100)
      : 0
    stats.innerHTML = `
      <oas-card class="stat-card">
        <div class="stat-label">${t('orders.stat.pending')}</div>
        <div class="stat-value mono">${pending}</div>
        <div class="stat-foot">${t('orders.stat.pendingHint')}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">${t('orders.stat.monthSales')}</div>
        <div class="stat-value mono">${formatMoney(monthSales)}</div>
        <div class="stat-foot">${t('orders.stat.monthHint')}</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">${t('orders.stat.doneRate')}</div>
        <div class="stat-value mono">${doneRate}%</div>
        <oas-progress class="stat-progress" percent="${doneRate}" show-text="false"></oas-progress>
      </oas-card>`
  }

  async function refresh() {
    table.setAttribute('loading', '')
    let rows = await listOrders()
    const u = readSession()
    // 数据权限演示：viewer 仅见本人订单（role 由登录页角色选择写入）
    if (u?.role === 'viewer') {
      rows = rows.filter((r) => r.creator === u.name)
      scopeEl.hidden = false
    } else {
      scopeEl.hidden = true
    }
    state.rows = rows
    table.removeAttribute('loading')
    renderTabs()
    renderStats()
    renderTable()
  }

  function fillDesc(row) {
    const desc = document.querySelector('#order-detail-desc')
    desc.innerHTML = `
      <oas-descriptions-item label="${t('orders.th.customer')}"><span id="od-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.dl.creator')}"><span id="od-creator"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.amount')}"><span id="od-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.created')}"><span id="od-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.dl.items')}"><span id="od-items"></span></oas-descriptions-item>`
    desc.querySelector('#od-customer').textContent = row.customer
    desc.querySelector('#od-creator').textContent = row.creator
    desc.querySelector('#od-amount').textContent = formatMoney(row.amount)
    desc.querySelector('#od-created').textContent = row.created
    desc.querySelector('#od-items').innerHTML = row.items
      .map((it) => `<oas-tag>${it}</oas-tag>`)
      .join(' ')
  }

  function renderAction(row) {
    const action = flowFor(row.status)
    const actionEl = document.querySelector('#order-detail-action')
    const noteEl = document.querySelector('#order-detail-note')
    if (action) {
      actionEl.hidden = false
      noteEl.hidden = true
      actionEl.textContent = action.label
      actionEl.dataset.target = action.to
    } else {
      actionEl.hidden = true
      noteEl.hidden = false
      noteEl.textContent = row.status === 'done' ? t('orders.noteDone') : t('orders.noteCancelled')
    }
  }

  function openDrawer(row) {
    state.selectedId = row.id
    document.querySelector('#order-detail-no').textContent = row.id
    const tag = document.querySelector('#order-detail-tag')
    tag.textContent = statusLabel(row.status)
    setTagType(tag, row.status)
    fillDesc(row)
    renderAction(row)
    drawer.setAttribute('visible', '')
  }

  document.querySelector('[data-testid="orders-export"]').addEventListener('click', () => {
    const list = filtered()
    if (list.length === 0) {
      OASUI.message.info(t('orders.noExportable'))
      return
    }
    const header = t('orders.exportHeader')
    const body = list.map((r) =>
      [r.id, r.customer, r.amount, statusLabel(r.status), r.items.join(' | '), r.created].join(','),
    )
    const csv = `\ufeff${[header, ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    OASUI.message.success(tf('orders.exported', { count: list.length }))
  })

  document.querySelector('#orders-clear').addEventListener('click', () => {
    state.keyword = ''
    state.status = 'all'
    table.setAttribute('current', '1')
    search.setAttribute('value', '')
    renderTabs()
    renderTable()
  })

  document.querySelector('[data-testid="order-detail-link"]').addEventListener('click', () => {
    // MPA 页间传参：详情页读 sessionStorage order-detail-id（vanilla/react/vue 同款约定）
    if (state.selectedId) sessionStorage.setItem('order-detail-id', state.selectedId)
  })

  document.querySelector('[data-testid="order-detail-action"]').addEventListener('click', async (e) => {
    const button = e.currentTarget
    const target = button.dataset.target
    if (!target || !state.selectedId) return
    button.setAttribute('loading', '')
    const updated = await updateOrderStatus(state.selectedId, target)
    button.removeAttribute('loading')
    if (!updated) {
      OASUI.message.error(t('orders.notFound'))
      return
    }
    OASUI.message.success(tf('orders.flowApplied', { action: button.textContent }))
    await refresh()
    const row = state.rows.find((r) => r.id === state.selectedId)
    if (row) {
      const tag = document.querySelector('#order-detail-tag')
      tag.textContent = statusLabel(row.status)
      setTagType(tag, row.status)
      renderAction(row)
    }
  })

  table.addEventListener('oas-row-click', (e) => {
    const row = e.detail?.row
    if (row?.id) openDrawer(row)
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = e.detail.value ?? ''
    table.setAttribute('current', '1')
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    table.setAttribute('current', '1')
    renderTable()
  })

  tabs.addEventListener('oas-change', (e) => {
    const value = e.detail?.value
    state.status = value === 'all' ? 'all' : value
    table.setAttribute('current', '1')
    renderTable()
  })

  void refresh()
}
