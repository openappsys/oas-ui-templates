import { message } from '@oas-ui/ui/feedback/message'
import { listOrders, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'

const PAGE_SIZE = 8
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  shipping: '配送中',
  done: '已完成',
  cancelled: '已取消',
}
const STATUS_TAG: Record<OrderStatus, string> = {
  pending: 'warning',
  paid: 'primary',
  shipping: 'purple',
  done: 'success',
  cancelled: 'danger',
}
const TABS: Array<{ label: string; value: 'all' | OrderStatus }> = [
  { label: '全部', value: 'all' },
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '配送中', value: 'shipping' },
  { label: '已完成', value: 'done' },
  { label: '已取消', value: 'cancelled' },
]
const FLOW: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  pending: { label: '标记已支付', to: 'paid' },
  paid: { label: '开始配送', to: 'shipping' },
  shipping: { label: '确认完成', to: 'done' },
}

interface PageState {
  rows: OrderRow[]
  keyword: string
  status: 'all' | OrderStatus
  page: number
  selectedId: string | null
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

function itemSummary(items: string[]): string {
  if (items.length <= 2) return items.join('、')
  return `${items.slice(0, 2).join('、')} 等${items.length}项`
}

function tagMarkup(status: OrderStatus): string {
  const t = STATUS_TAG[status]
  return t === 'purple' ? `color="purple"` : `type="${t}"`
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

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    keyword: '',
    status: 'all',
    page: 1,
    selectedId: null,
  }

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">订单管理</h1>
          <p class="page-subtitle">跟踪订单状态与销售情况</p>
        </div>
        <oas-button data-testid="orders-export" type="primary" icon="download">导出 CSV</oas-button>
      </div>
      <div class="orders-stats" id="orders-stats"></div>
      <oas-card title="订单列表">
        <div class="orders-toolbar" slot="extra">
          <oas-input data-testid="orders-search" placeholder="搜索客户名称" clearable prefix-icon="search"></oas-input>
        </div>
        <oas-tabs data-testid="orders-tabs" id="orders-tabs"></oas-tabs>
        <div class="table-wrap" id="orders-table-wrap">
          <table class="orders-table" data-testid="orders-list">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>商品</th>
                <th class="num">金额</th>
                <th>状态</th>
                <th>创建日期</th>
              </tr>
            </thead>
            <tbody id="orders-tbody"></tbody>
          </table>
          <div class="empty-overlay" id="orders-empty" hidden>
            <oas-empty description="未找到匹配订单"></oas-empty>
            <oas-button id="orders-clear" type="primary">清除筛选</oas-button>
          </div>
        </div>
        <oas-pagination data-testid="orders-pager" total="0" page-size="${PAGE_SIZE}" current="1" show-total></oas-pagination>
      </oas-card>

      <oas-drawer data-testid="order-drawer" title="订单详情" placement="right" size="medium" no-footer>
        <div class="order-detail">
          <div class="order-detail-head">
            <div>
              <div class="order-detail-no mono" id="order-detail-no"></div>
              <div class="order-detail-sub">订单详情</div>
            </div>
            <oas-tag data-testid="order-detail-tag" id="order-detail-tag"></oas-tag>
          </div>
          <oas-descriptions id="order-detail-desc" column="1"></oas-descriptions>
          <div class="order-detail-foot">
            <div class="order-detail-foot-row">
              <oas-button data-testid="order-detail-action" id="order-detail-action" type="primary" hidden></oas-button>
              <a class="link-btn" data-testid="order-detail-link" href="#/order-detail">查看完整详情 →</a>
            </div>
            <div class="order-detail-note" id="order-detail-note" hidden></div>
          </div>
        </div>
      </oas-drawer>
    </div>`

  const tbody = el.querySelector<HTMLElement>('#orders-tbody')!
  const pager = el.querySelector<HTMLElement>('[data-testid="orders-pager"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="orders-search"]')!
  const tabs = el.querySelector<HTMLElement>('[data-testid="orders-tabs"]')!
  const tableWrap = el.querySelector<HTMLElement>('#orders-table-wrap')!
  const emptyOverlay = el.querySelector<HTMLElement>('#orders-empty')!
  const stats = el.querySelector<HTMLElement>('#orders-stats')!
  const drawer = el.querySelector<HTMLElement>('[data-testid="order-drawer"]')!

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
    tabs.innerHTML = TABS.map(
      (t) =>
        `<oas-tab-panel label="${t.label}" value="${t.value}"${counts[t.value] ? ` badge="${counts[t.value]}"` : ''}></oas-tab-panel>`,
    ).join('')
    tabs.setAttribute('active', state.status)
  }

  function setEmpty(empty: boolean): void {
    if (empty) {
      tbody.innerHTML = ''
      pager.classList.add('table-hidden')
      emptyOverlay.hidden = false
      tableWrap.classList.add('is-empty')
    } else {
      pager.classList.remove('table-hidden')
      emptyOverlay.hidden = true
      tableWrap.classList.remove('is-empty')
    }
  }

  function renderTable(): void {
    const list = filtered()
    if (list.length === 0) {
      pager.setAttribute('total', '0')
      pager.setAttribute('current', '1')
      setEmpty(true)
      return
    }
    setEmpty(false)
    const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
    tbody.innerHTML = slice
      .map(
        (r) => `
        <tr data-id="${r.id}">
          <td class="mono">${r.id}</td>
          <td>${r.customer}</td>
          <td class="items-cell" title="${r.items.join('、')}">${itemSummary(r.items)}</td>
          <td class="amount-cell mono">${formatMoney(r.amount)}</td>
          <td><oas-tag ${tagMarkup(r.status)}>${STATUS_LABEL[r.status]}</oas-tag></td>
          <td class="mono">${r.created}</td>
        </tr>`,
      )
      .join('')
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
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
        <div class="stat-label">待处理订单</div>
        <div class="stat-value mono">${pending}</div>
        <div class="stat-foot">待支付 + 已支付</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">本月销售额</div>
        <div class="stat-value mono">${formatMoney(monthSales)}</div>
        <div class="stat-foot">按创建日期统计</div>
      </oas-card>
      <oas-card class="stat-card">
        <div class="stat-label">完成率</div>
        <div class="stat-value mono">${doneRate}%</div>
        <oas-progress class="stat-progress" percent="${doneRate}" show-text="false"></oas-progress>
      </oas-card>`
  }

  async function refresh(): Promise<void> {
    tbody.classList.add('table-loading')
    state.rows = await listOrders()
    tbody.classList.remove('table-loading')
    renderTabs()
    renderStats()
    renderTable()
  }

  function fillDesc(row: OrderRow): void {
    const desc = el.querySelector<HTMLElement>('#order-detail-desc')!
    desc.innerHTML = `
      <oas-descriptions-item label="客户"><span id="od-customer"></span></oas-descriptions-item>
      <oas-descriptions-item label="金额"><span id="od-amount" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="创建日期"><span id="od-created" class="mono"></span></oas-descriptions-item>
      <oas-descriptions-item label="商品列表"><span id="od-items"></span></oas-descriptions-item>`
    desc.querySelector<HTMLElement>('#od-customer')!.textContent = row.customer
    desc.querySelector<HTMLElement>('#od-amount')!.textContent = formatMoney(row.amount)
    desc.querySelector<HTMLElement>('#od-created')!.textContent = row.created
    desc.querySelector<HTMLElement>('#od-items')!.innerHTML = row.items
      .map((it) => `<oas-tag>${it}</oas-tag>`)
      .join(' ')
  }

  function renderAction(row: OrderRow): void {
    const action = FLOW[row.status]
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
      noteEl.textContent = row.status === 'done' ? '订单已完成，无需后续操作' : '订单已取消'
    }
  }

  function openDrawer(row: OrderRow): void {
    state.selectedId = row.id
    el.querySelector<HTMLElement>('#order-detail-no')!.textContent = row.id
    const tag = el.querySelector<HTMLElement>('#order-detail-tag')!
    tag.textContent = STATUS_LABEL[row.status]
    setTagType(tag, row.status)
    fillDesc(row)
    renderAction(row)
    drawer.setAttribute('visible', '')
  }

  el.querySelector<HTMLElement>('[data-testid="orders-export"]')!.addEventListener('click', () => {
    const list = filtered()
    if (list.length === 0) {
      message.info('没有可导出的订单')
      return
    }
    const header = '订单号,客户,金额,状态,商品,创建日期'
    const body = list.map((r) =>
      [r.id, r.customer, r.amount, STATUS_LABEL[r.status], r.items.join(' | '), r.created].join(
        ',',
      ),
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
    message.success(`已导出 ${list.length} 条订单`)
  })

  el.querySelector<HTMLElement>('#orders-clear')!.addEventListener('click', () => {
    state.keyword = ''
    state.status = 'all'
    state.page = 1
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
        message.error('该订单不存在')
        return
      }
      message.success(`已${button.textContent}`)
      await refresh()
      const row = state.rows.find((r) => r.id === state.selectedId)
      if (row) {
        const tag = el.querySelector<HTMLElement>('#order-detail-tag')!
        tag.textContent = STATUS_LABEL[row.status]
        setTagType(tag, row.status)
        renderAction(row)
      }
    },
  )

  tbody.addEventListener('click', (e) => {
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-id]')
    if (!tr) return
    const id = tr.getAttribute('data-id')
    const row = state.rows.find((r) => r.id === id)
    if (row) openDrawer(row)
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value
    state.page = 1
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    state.page = 1
    renderTable()
  })

  tabs.addEventListener('oas-change', (e) => {
    const value = (e as CustomEvent<{ value: string }>).detail.value
    state.status = value === 'all' ? 'all' : (value as OrderStatus)
    state.page = 1
    renderTable()
  })

  pager.addEventListener('oas-change', (e) => {
    state.page = (e as CustomEvent<{ page: number }>).detail.page
    renderTable()
  })

  void refresh()
  return () => {}
}
