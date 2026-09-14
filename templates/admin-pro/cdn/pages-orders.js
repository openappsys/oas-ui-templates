/**
 * 订单列表页（自 vanilla src/pages/orders.ts 去 TS 移植）
 * 内置分页（oas-table pagination 属性）与 vanilla 同构；DOM / testid 逐字对齐
 */
import { onLocaleChange, t } from './i18n.js'
import { listOrders, updateOrderStatus } from './data/orders.js'
import { flowFor, formatMoney, setTagType, statusLabel } from './order-shared.js'

const SESSION_KEY = 'oas-admin-cdn.session'
const PAGE_SIZE_KEY = 'oas-admin-cdn.settings.page-size'

/** 每页条数跟随设置中心（Task 5 落地）；未设置时保持默认 8 */
function pageSize() {
  const raw = localStorage.getItem(PAGE_SIZE_KEY)
  return raw ? Number(raw) || 8 : 8
}

/** 状态 Tab 定义（随语言重建） */
function tabs() {
  return [
    { label: t('orders.tabAll'), value: 'all' },
    { label: statusLabel('pending'), value: 'pending' },
    { label: statusLabel('paid'), value: 'paid' },
    { label: statusLabel('shipping'), value: 'shipping' },
    { label: statusLabel('done'), value: 'done' },
    { label: statusLabel('cancelled'), value: 'cancelled' },
  ]
}

/** 商品项摘要：≤2 项直接拼接，超出「前两项 等 N 项」 */
function itemSummary(items) {
  if (items.length <= 2) return items.join(t('orders.itemJoin'))
  return t('orders.itemSummary', {
    names: items.slice(0, 2).join(t('orders.itemJoin')),
    total: items.length,
  })
}

/** @param {import('./data/orders.js').OrderRow} row */
function statusCell(row) {
  const tag = document.createElement('oas-tag')
  tag.textContent = statusLabel(row.status)
  setTagType(tag, row.status)
  return tag
}

/** @param {import('./data/orders.js').OrderRow} row */
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
    { key: 'items', title: t('orders.th.items'), ellipsis: true, render: (r) => itemSummary(r.items) },
    { key: 'amount', title: t('orders.th.amount'), align: 'right', summary: 'sum', render: (r) => moneyCell(r) },
    { key: 'status', title: t('orders.th.status'), render: (r) => statusCell(r) },
    { key: 'created', title: t('orders.th.created') },
  ]
}

export function renderOrders(el) {
  const state = { rows: [], keyword: '', status: 'all', selectedId: null }

  function draw() {
    document.title = `${t('nav.orders')} · ${t('app.title')}`
    el.innerHTML = `
    <style>
      /* 行内作用域样式（vanilla 页内 <style> 同款）：数据权限提示条 */
      .orders-scope oas-icon { flex-shrink: 0; }
    </style>
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.orders')}</h1>
          <p class="page-subtitle">${t('orders.subtitle')}</p>
        </div>
        <oas-button data-testid="orders-export" type="primary" icon="download">${t('orders.exportCsv')}</oas-button>
      </div>
      <div id="orders-scope" class="orders-scope" hidden>
        <oas-icon size="16" name="info"></oas-icon>
        <span data-testid="orders-scope-text">${t('orders.scopeOnlySelf')}</span>
      </div>
      <div class="orders-stats" id="orders-stats"></div>
      <oas-card class="list-card" title="${t('orders.listTitle')}">
        <div class="orders-toolbar" slot="extra">
          <oas-input data-testid="orders-search" placeholder="${t('orders.search')}" clearable prefix-icon="search"></oas-input>
        </div>
        <oas-tabs data-testid="orders-tabs" id="orders-tabs"></oas-tabs>
        <div class="table-wrap" id="orders-table-wrap">
          <oas-table data-testid="orders-list" row-key="id" empty-text="${t('orders.empty')}" pagination page-size="${pageSize()}"></oas-table>
          <div class="empty-overlay" id="orders-empty" hidden>
            <oas-empty description="${t('orders.empty')}"></oas-empty>
            <oas-button id="orders-clear" type="primary">${t('common.clearFilter')}</oas-button>
          </div>
        </div>
      </oas-card>

      <oas-drawer data-testid="order-drawer" title="${t('orders.detailTitle')}" placement="right" size="medium" no-footer>
        <div class="order-detail">
          <div class="order-detail-head">
            <div>
              <div class="order-detail-no mono" id="order-detail-no"></div>
              <div class="order-detail-sub">${t('orders.detailTitle')}</div>
            </div>
            <oas-tag data-testid="order-detail-tag" id="order-detail-tag"></oas-tag>
          </div>
          <oas-descriptions id="order-detail-desc" column="1"></oas-descriptions>
          <div class="order-detail-foot">
            <div class="order-detail-foot-row">
              <oas-button data-testid="order-detail-action" id="order-detail-action" type="primary" hidden></oas-button>
              <a class="link-btn" data-testid="order-detail-link" href="#/order-detail">${t('orders.fullDetail')}</a>
            </div>
            <div class="order-detail-note" id="order-detail-note" hidden></div>
          </div>
        </div>
      </oas-drawer>
    </div>`
    bind()
    void refresh()
  }

  const q = (sel) => el.querySelector(sel)

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
    q('[data-testid="orders-tabs"]').innerHTML = tabs()
      .map(
        (tb) =>
          `<oas-tab-panel label="${tb.label}" value="${tb.value}"${counts[tb.value] ? ` badge="${counts[tb.value]}"` : ''}></oas-tab-panel>`,
      )
      .join('')
    q('[data-testid="orders-tabs"]').setAttribute('active', state.status)
  }

  function setEmpty(empty) {
    const table = q('[data-testid="orders-list"]')
    if (empty) {
      table.setAttribute('data', '[]')
      q('#orders-empty').hidden = false
      q('#orders-table-wrap').classList.add('is-empty')
    } else {
      q('#orders-empty').hidden = true
      q('#orders-table-wrap').classList.remove('is-empty')
    }
  }

  function renderTable() {
    const table = q('[data-testid="orders-list"]')
    const list = filtered()
    table.columns = tableColumns()
    if (list.length === 0) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    table.setAttribute('data', JSON.stringify(list))
    // oas-pagination 的 update() 会自摘 hidden（为 hide-on-single 预留）：
    // 内置分页器随 data 渲染，空态时命令式补写 hidden，避免空态浮层下透出分页器
    const inner = table.shadowRoot?.querySelector('.pagination oas-pagination')
    if (inner) inner.setAttribute('hidden', '')
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
    q('#orders-stats').innerHTML = `
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
    const table = q('[data-testid="orders-list"]')
    table.setAttribute('loading', '')
    let rows = await listOrders()
    const u = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    // cdn 会话无角色概念（登录仅存 name），viewer 数据权限分支保留但恒不生效
    if (u?.role === 'viewer') {
      rows = rows.filter((r) => r.creator === u.name)
      q('#orders-scope').hidden = false
    } else {
      q('#orders-scope').hidden = true
    }
    state.rows = rows
    table.removeAttribute('loading')
    renderTabs()
    renderStats()
    renderTable()
  }

  function fillDesc(row) {
    const desc = q('#order-detail-desc')
    desc.innerHTML = `
      <oas-descriptions-item label="${t('orders.th.customer')}"><span id="od-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.dl.creator')}"><span id="od-creator"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.amount')}"><span id="od-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.created')}"><span id="od-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.dl.items')}"><span id="od-items"></span></oas-descriptions-item>`
    q('#od-customer').textContent = row.customer
    q('#od-creator').textContent = row.creator
    q('#od-amount').textContent = formatMoney(row.amount)
    q('#od-created').textContent = row.created
    q('#od-items').innerHTML = row.items.map((it) => `<oas-tag>${it}</oas-tag>`).join(' ')
  }

  function renderDrawerAction(row) {
    const action = flowFor(row.status)
    const actionEl = q('#order-detail-action')
    const noteEl = q('#order-detail-note')
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
    q('#order-detail-no').textContent = row.id
    const tag = q('#order-detail-tag')
    tag.textContent = statusLabel(row.status)
    setTagType(tag, row.status)
    fillDesc(row)
    renderDrawerAction(row)
    q('[data-testid="order-drawer"]').setAttribute('visible', '')
  }

  function bind() {
    q('[data-testid="orders-export"]').addEventListener('click', () => {
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
      OASUI.message.success(t('orders.exported', { count: list.length }))
    })

    q('#orders-clear').addEventListener('click', () => {
      state.keyword = ''
      state.status = 'all'
      q('[data-testid="orders-list"]').setAttribute('current', '1')
      q('[data-testid="orders-search"]').setAttribute('value', '')
      renderTabs()
      renderTable()
    })

    q('[data-testid="order-detail-link"]').addEventListener('click', () => {
      if (state.selectedId) sessionStorage.setItem('order-detail-id', state.selectedId)
    })

    q('[data-testid="order-detail-action"]').addEventListener('click', async (e) => {
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
      OASUI.message.success(t('orders.flowApplied', { action: button.textContent }))
      await refresh()
      const row = state.rows.find((r) => r.id === state.selectedId)
      if (row) {
        const tag = q('#order-detail-tag')
        tag.textContent = statusLabel(row.status)
        setTagType(tag, row.status)
        renderDrawerAction(row)
      }
    })

    q('[data-testid="orders-list"]').addEventListener('oas-row-click', (e) => {
      const row = e.detail?.row
      if (row?.id) openDrawer(row)
    })

    q('[data-testid="orders-search"]').addEventListener('oas-input', (e) => {
      state.keyword = e.detail.value ?? ''
      q('[data-testid="orders-list"]').setAttribute('current', '1')
      renderTable()
    })
    q('[data-testid="orders-search"]').addEventListener('oas-clear', () => {
      state.keyword = ''
      q('[data-testid="orders-list"]').setAttribute('current', '1')
      renderTable()
    })

    q('[data-testid="orders-tabs"]').addEventListener('oas-change', (e) => {
      const value = e.detail.value
      state.status = value === 'all' ? 'all' : value
      q('[data-testid="orders-list"]').setAttribute('current', '1')
      renderTable()
    })
  }

  draw()
  return onLocaleChange(draw)
}
