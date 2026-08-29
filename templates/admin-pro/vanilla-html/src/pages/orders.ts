import { message } from '@oas-ui/ui/feedback/message'
import type { OASTable, TableColumn } from '@oas-ui/ui/data/table'
import { onLocaleChange, t } from '../i18n'
import { listOrders, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'
import { session } from '../store/session'
import { PAGE_SIZE_KEY } from '../settings-init'

// 每页条数跟随设置中心（settings 页 page-size）；未设置时保持原默认 8
const pageSize = (): number => {
  const raw = localStorage.getItem(PAGE_SIZE_KEY)
  return raw ? Number(raw) || 8 : 8
}

function statusLabel(status: OrderStatus): string {
  return t(`orders.status.${status}`)
}

const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}
const TABS = (): Array<{ label: string; value: 'all' | OrderStatus }> => [
  { label: t('orders.tabAll'), value: 'all' },
  { label: statusLabel('pending'), value: 'pending' },
  { label: statusLabel('paid'), value: 'paid' },
  { label: statusLabel('shipping'), value: 'shipping' },
  { label: statusLabel('done'), value: 'done' },
  { label: statusLabel('cancelled'), value: 'cancelled' },
]
const FLOW_TO: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'paid',
  paid: 'shipping',
  shipping: 'done',
}

function flowFor(status: OrderStatus): { label: string; to: OrderStatus } | undefined {
  const to = FLOW_TO[status]
  return to ? { label: t(`orders.flow.${status}`), to } : undefined
}

interface PageState {
  rows: OrderRow[]
  keyword: string
  status: 'all' | OrderStatus
  selectedId: string | null
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

function itemSummary(items: string[]): string {
  if (items.length <= 2) return items.join(t('orders.itemJoin'))
  return t('orders.itemSummary', {
    names: items.slice(0, 2).join(t('orders.itemJoin')),
    total: items.length,
  })
}

function setTagType(tag: HTMLElement, status: OrderStatus): void {
  const t = STATUS_TAG[status]
  if (t === 'purple') {
    tag.setAttribute('color', 'purple')
    tag.removeAttribute('type')
  } else {
    tag.setAttribute('type', t)
    tag.removeAttribute('color')
  }
}

function statusCell(row: OrderRow): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.textContent = statusLabel(row.status)
  setTagType(tag, row.status)
  return tag
}

function moneyCell(row: OrderRow): HTMLElement {
  const span = document.createElement('span')
  span.className = 'mono'
  span.textContent = formatMoney(row.amount)
  return span
}

const TABLE_COLUMNS = (): TableColumn[] => [
  { key: 'no', title: '#', serialNumber: true, width: '48px' },
  { key: 'id', title: t('orders.th.no') },
  { key: 'customer', title: t('orders.th.customer') },
  {
    key: 'items',
    title: t('orders.th.items'),
    ellipsis: true,
    render: (r) => String(itemSummary((r as unknown as OrderRow).items)),
  },
  {
    key: 'amount',
    title: t('orders.th.amount'),
    align: 'right',
    summary: 'sum',
    render: (r) => moneyCell(r as unknown as OrderRow),
  },
  {
    key: 'status',
    title: t('orders.th.status'),
    render: (r) => statusCell(r as unknown as OrderRow),
  },
  { key: 'created', title: t('orders.th.created') },
]

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    keyword: '',
    status: 'all',
    selectedId: null,
  }

  el.innerHTML = `
    <style>
      .orders-scope {
        display: flex;
        align-items: center;
        gap: var(--oas-space-2);
        margin-bottom: var(--oas-space-3);
        padding: var(--oas-space-3) var(--oas-space-4);
        border: 1px solid color-mix(in srgb, var(--oas-color-info-text) 30%, transparent);
        border-radius: var(--oas-radius-md);
        background: color-mix(in srgb, var(--oas-color-info-text) 10%, transparent);
        color: var(--oas-color-text-primary);
        font-size: var(--oas-font-size-sm);
      }
      .orders-scope oas-icon {
        color: var(--oas-color-info-text);
        flex-shrink: 0;
      }
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

  const table = el.querySelector<OASTable>('[data-testid="orders-list"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="orders-search"]')!
  const tabs = el.querySelector<HTMLElement>('[data-testid="orders-tabs"]')!
  const tableWrap = el.querySelector<HTMLElement>('#orders-table-wrap')!
  const emptyOverlay = el.querySelector<HTMLElement>('#orders-empty')!
  const stats = el.querySelector<HTMLElement>('#orders-stats')!
  const drawer = el.querySelector<HTMLElement>('[data-testid="order-drawer"]')!
  const scopeEl = el.querySelector<HTMLElement>('#orders-scope')!

  function filtered(): OrderRow[] {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (state.status !== 'all' && r.status !== state.status) return false
      if (kw && !r.customer.toLowerCase().includes(kw)) return false
      return true
    })
  }

  function renderTabs(): void {
    const counts: Record<string, number> = { all: state.rows.length }
    for (const r of state.rows) counts[r.status] = (counts[r.status] ?? 0) + 1
    tabs.innerHTML = TABS()
      .map(
        (tItem) =>
          `<oas-tab-panel label="${tItem.label}" value="${tItem.value}"${counts[tItem.value] ? ` badge="${counts[tItem.value]}"` : ''}></oas-tab-panel>`,
      )
      .join('')
    tabs.setAttribute('active', state.status)
  }

  function setEmpty(empty: boolean): void {
    if (empty) {
      table.setAttribute('data', '[]')
      emptyOverlay.hidden = false
      tableWrap.classList.add('is-empty')
    } else {
      emptyOverlay.hidden = true
      tableWrap.classList.remove('is-empty')
    }
  }

  function renderTable(): void {
    const list = filtered()
    table.columns = TABLE_COLUMNS()
    if (list.length === 0) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    table.setAttribute('data', JSON.stringify(list))
  }

  function renderStats(): void {
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

  async function refresh(): Promise<void> {
    table.setAttribute('loading', '')
    let rows = await listOrders()
    const u = session.user
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

  function fillDesc(row: OrderRow): void {
    const desc = el.querySelector<HTMLElement>('#order-detail-desc')!
    desc.innerHTML = `
      <oas-descriptions-item label="${t('orders.th.customer')}"><span id="od-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.dl.creator')}"><span id="od-creator"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.amount')}"><span id="od-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.th.created')}"><span id="od-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('orders.dl.items')}"><span id="od-items"></span></oas-descriptions-item>`
    desc.querySelector<HTMLElement>('#od-customer')!.textContent = row.customer
    desc.querySelector<HTMLElement>('#od-creator')!.textContent = row.creator
    desc.querySelector<HTMLElement>('#od-amount')!.textContent = formatMoney(row.amount)
    desc.querySelector<HTMLElement>('#od-created')!.textContent = row.created
    desc.querySelector<HTMLElement>('#od-items')!.innerHTML = row.items
      .map((it) => `<oas-tag>${it}</oas-tag>`)
      .join(' ')
  }

  function renderAction(row: OrderRow): void {
    const action = flowFor(row.status)
    const actionEl = el.querySelector<HTMLElement>('#order-detail-action')!
    const noteEl = el.querySelector<HTMLElement>('#order-detail-note')!
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

  function openDrawer(row: OrderRow): void {
    state.selectedId = row.id
    el.querySelector<HTMLElement>('#order-detail-no')!.textContent = row.id
    const tag = el.querySelector<HTMLElement>('#order-detail-tag')!
    tag.textContent = statusLabel(row.status)
    setTagType(tag, row.status)
    fillDesc(row)
    renderAction(row)
    drawer.setAttribute('visible', '')
  }

  el.querySelector<HTMLElement>('[data-testid="orders-export"]')!.addEventListener('click', () => {
    const list = filtered()
    if (list.length === 0) {
      message.info(t('orders.noExportable'))
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
    message.success(t('orders.exported', { count: list.length }))
  })

  el.querySelector<HTMLElement>('#orders-clear')!.addEventListener('click', () => {
    state.keyword = ''
    state.status = 'all'
    table.setAttribute('current', '1')
    search.setAttribute('value', '')
    renderTabs()
    renderTable()
  })

  el.querySelector<HTMLElement>('[data-testid="order-detail-link"]')!.addEventListener(
    'click',
    () => {
      if (state.selectedId) sessionStorage.setItem('order-detail-id', state.selectedId)
    },
  )

  el.querySelector<HTMLElement>('[data-testid="order-detail-action"]')!.addEventListener(
    'click',
    async (e) => {
      const button = e.currentTarget as HTMLElement
      const target = button.dataset.target as OrderStatus | undefined
      if (!target || !state.selectedId) return
      button.setAttribute('loading', '')
      const updated = await updateOrderStatus(state.selectedId, target)
      button.removeAttribute('loading')
      if (!updated) {
        message.error(t('orders.notFound'))
        return
      }
      message.success(t('orders.flowApplied', { action: button.textContent }))
      await refresh()
      const row = state.rows.find((r) => r.id === state.selectedId)
      if (row) {
        const tag = el.querySelector<HTMLElement>('#order-detail-tag')!
        tag.textContent = statusLabel(row.status)
        setTagType(tag, row.status)
        renderAction(row)
      }
    },
  )

  table.addEventListener('oas-row-click', (e) => {
    const row = (e as CustomEvent<{ row: OrderRow }>).detail?.row
    if (row?.id) openDrawer(row)
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value
    table.setAttribute('current', '1')
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    table.setAttribute('current', '1')
    renderTable()
  })

  tabs.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    state.status = value === 'all' ? 'all' : (value as OrderStatus)
    table.setAttribute('current', '1')
    renderTable()
  })

  function refreshText(): void {
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('nav.orders')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('orders.subtitle')
    el.querySelector<HTMLElement>('[data-testid="orders-export"]')!.textContent =
      t('orders.exportCsv')
    el.querySelector<HTMLElement>('[data-testid="orders-scope-text"]')!.textContent =
      t('orders.scopeOnlySelf')
    el.querySelector<HTMLElement>('oas-card.list-card')!.setAttribute(
      'title',
      t('orders.listTitle'),
    )
    search.setAttribute('placeholder', t('orders.search'))
    el.querySelector<HTMLElement>('#orders-empty oas-empty')!.setAttribute(
      'description',
      t('orders.empty'),
    )
    el.querySelector<HTMLElement>('#orders-clear')!.textContent = t('common.clearFilter')
    el.querySelector<HTMLElement>('[data-testid="order-drawer"]')!.setAttribute(
      'title',
      t('orders.detailTitle'),
    )
    el.querySelector<HTMLElement>('.order-detail-sub')!.textContent = t('orders.detailTitle')
    el.querySelector<HTMLElement>('[data-testid="order-detail-link"]')!.textContent =
      t('orders.fullDetail')
    // 统计卡 / 状态 tabs / 表格列与行内状态标签随语言重建；分页/筛选/搜索状态不动
    renderStats()
    renderTabs()
    renderTable()
  }

  void refresh()
  return onLocaleChange(refreshText)
}
