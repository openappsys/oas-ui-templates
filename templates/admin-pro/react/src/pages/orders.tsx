// src/pages/orders.tsx —— 订单管理（统计卡 + 状态 tabs + 表格 + 快捷详情抽屉 + CSV 导出）
// 1. 状态：rows/keyword/status/selectedId 全部 useState，过滤/统计/空态/tabs 徽标全部由
//    state 派生；refresh() 仅重拉数据 setRows，重渲染即最新；tabs/统计/表格列随 locale
//    自动重算（users/dashboard 同款模式）
// 2. 事件绑定：search 的 oas-input/oas-clear、tabs 的 oas-change、table 的 oas-row-click
//    走 useOasEvent；导出/清筛选按钮为 light DOM 原生 click 直绑 onClick；抽屉内链接与
//    流程按钮的接线见 ./orders-drawer.tsx 头注释
// 3. 搜索/切 tab 后 tableRef.setAttribute('current','1') 人工复位首屏
// 4. 子组件拆分（单文件 ≤400 行纪律）：表格 ./orders-table.tsx、快捷详情抽屉 ./orders-drawer.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listOrders, updateOrderStatus } from '../data/orders'
import type { OrderRow, OrderStatus } from '../data/orders'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { PAGE_SIZE_KEY } from '../settings-init'
import { session } from '../store/session'
import { OrdersDrawer } from './orders-drawer'
import { OrdersTable, statusLabel } from './orders-table'

/** vanilla .orders-scope 内联样式（页面内的权限范围提示条） */
const SCOPE_STYLE = `
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
`

/** vanilla pageSize()：每页条数跟随设置中心；未设置时保持原默认 8 */
function readPageSizeNum(): number {
  const raw = localStorage.getItem(PAGE_SIZE_KEY)
  return raw ? Number(raw) || 8 : 8
}

/** vanilla TABS：全部 + 五状态（文案随 locale 重算） */
const STATUS_KEYS: OrderStatus[] = ['pending', 'paid', 'shipping', 'done', 'cancelled']

function buildTabs(
  t: (key: string) => string,
): Array<{ label: string; value: 'all' | OrderStatus }> {
  return [
    { label: t('orders.tabAll'), value: 'all' },
    ...STATUS_KEYS.map((s) => ({ label: statusLabel(s, t), value: s })),
  ]
}

export default function OrdersPage() {
  const { t } = useT()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'all' | OrderStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pageSize] = useState(readPageSizeNum)

  const tableRef = useRef<HTMLElement | null>(null)
  const searchRef = useRef<HTMLElement | null>(null)
  const tabsRef = useRef<HTMLElement | null>(null)

  const isViewer = session.user?.role === 'viewer'

  const refresh = useCallback(async () => {
    setLoading(true)
    let list = await listOrders()
    const u = session.user
    if (u?.role === 'viewer') list = list.filter((r) => r.creator === u.name)
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const table = tableRef.current
    if (!table) return
    if (loading) table.setAttribute('loading', '')
    else table.removeAttribute('loading')
  }, [loading])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (kw && !r.customer.toLowerCase().includes(kw)) return false
      return true
    })
  }, [rows, keyword, status])

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<'all' | OrderStatus, number>> = { all: rows.length }
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1
    return counts
  }, [rows])

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending' || r.status === 'paid').length
    const monthPrefix = new Date().toISOString().slice(0, 7)
    const monthSales = rows
      .filter((r) => r.created.startsWith(monthPrefix))
      .reduce((sum, r) => sum + r.amount, 0)
    const doneRate = rows.length
      ? Math.round((rows.filter((r) => r.status === 'done').length / rows.length) * 100)
      : 0
    return { pending, monthSales, doneRate }
  }, [rows])

  const dataJson = useMemo(() => JSON.stringify(filtered), [filtered])

  const onExport = () => {
    const list = filtered
    if (list.length === 0) {
      appMessage.info(t('orders.noExportable'))
      return
    }
    const header = t('orders.exportHeader')
    const body = list.map((r) =>
      [r.id, r.customer, r.amount, statusLabel(r.status, t), r.items.join(' | '), r.created].join(
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
    appMessage.success(t('orders.exported', { count: list.length }))
  }

  const onClearFilter = () => {
    setKeyword('')
    setStatus('all')
    tableRef.current?.setAttribute('current', '1')
    searchRef.current?.setAttribute('value', '')
  }

  const backToFirstPage = () => tableRef.current?.setAttribute('current', '1')
  useOasEvent<{ value: string }>(searchRef, 'oas-input', (d) => {
    setKeyword(d.value)
    backToFirstPage()
  })
  useOasEvent(searchRef, 'oas-clear', () => {
    setKeyword('')
    backToFirstPage()
  })
  useOasEvent<{ value: string }>(tabsRef, 'oas-change', (d) => {
    setStatus(d.value === 'all' ? 'all' : (d.value as OrderStatus))
    backToFirstPage()
  })

  const openDrawer = (row: OrderRow) => {
    setSelectedId(row.id)
    setDrawerOpen(true)
  }

  const applyFlow = useCallback(
    async (id: string, target: OrderStatus) => {
      const prev = rows.find((r) => r.id === id)
      const updated = await updateOrderStatus(id, target)
      if (!updated) {
        appMessage.error(t('orders.notFound'))
        return
      }
      appMessage.success(
        t('orders.flowApplied', { action: prev ? t(`orders.flow.${prev.status}`) : '' }),
      )
      await refresh()
    },
    [rows, t, refresh],
  )

  const tabs = buildTabs(t)
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null

  return (
    <div className="page">
      <style>{SCOPE_STYLE}</style>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.orders')}</h1>
          <p className="page-subtitle">{t('orders.subtitle')}</p>
        </div>
        <oas-button data-testid="orders-export" type="primary" icon="download" onClick={onExport}>
          {t('orders.exportCsv')}
        </oas-button>
      </div>
      <div id="orders-scope" className="orders-scope" hidden={!isViewer || undefined}>
        <oas-icon size="16" name="info" />
        <span data-testid="orders-scope-text">{t('orders.scopeOnlySelf')}</span>
      </div>
      <div className="orders-stats" id="orders-stats">
        <oas-card className="stat-card">
          <div className="stat-label">{t('orders.stat.pending')}</div>
          <div className="stat-value mono">{stats.pending}</div>
          <div className="stat-foot">{t('orders.stat.pendingHint')}</div>
        </oas-card>
        <oas-card className="stat-card">
          <div className="stat-label">{t('orders.stat.monthSales')}</div>
          <div className="stat-value mono">{`¥ ${stats.monthSales.toLocaleString('en-US')}`}</div>
          <div className="stat-foot">{t('orders.stat.monthHint')}</div>
        </oas-card>
        <oas-card className="stat-card">
          <div className="stat-label">{t('orders.stat.doneRate')}</div>
          <div className="stat-value mono">{stats.doneRate}%</div>
          <oas-progress className="stat-progress" percent={stats.doneRate} show-text="false" />
        </oas-card>
      </div>
      <oas-card className="list-card" title={t('orders.listTitle')}>
        <div className="orders-toolbar" slot="extra">
          <oas-input
            ref={searchRef}
            data-testid="orders-search"
            placeholder={t('orders.search')}
            clearable
            prefix-icon="search"
          />
        </div>
        <oas-tabs ref={tabsRef} data-testid="orders-tabs" active={status}>
          {tabs.map((item) => (
            <oas-tab-panel
              key={item.value}
              label={item.label}
              value={item.value}
              badge={tabCounts[item.value] || undefined}
            />
          ))}
        </oas-tabs>
        <OrdersTable
          tableRef={tableRef}
          dataJson={dataJson}
          empty={filtered.length === 0}
          pageSize={pageSize}
          onRowOpen={openDrawer}
          onClearFilter={onClearFilter}
        />
      </oas-card>

      <OrdersDrawer
        open={drawerOpen}
        row={selectedRow}
        onClose={() => setDrawerOpen(false)}
        onApplyFlow={applyFlow}
      />
    </div>
  )
}
