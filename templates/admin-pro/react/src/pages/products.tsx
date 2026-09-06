// src/pages/products.tsx —— 商品管理（卡片/列表双视图 + 三表单模式 + 批量操作 + 列设置持久化）
//    rows/keyword/category/page/view/selected/columnKeys 全部 useState，表格切片/空态/批量栏
//    显隐/分页属性全部由 state 派生；refresh() 仅重拉数据 setRows，重渲染即最新
// 2. 事件绑定：oas-input/oas-select/oas-segmented/oas-pagination 的 oas-* 自定义事件一律
//    useOasEvent工具栏按钮为 light DOM 原生 click 直绑 onClick；
//    closest 匹配）；批量栏/列设置弹窗的事件接线见 ./products-batch-bar.tsx /
//    ./products-columns-modal.tsx 头注释（popconfirm oas-ok 走 useOasEvent，modal panel
//    内按钮原生 click 按第 2 条例外直绑）
// 3. visible 受控同步：表单容器/列设置弹窗的 visible 由 state 持有，组件侧关闭（遮罩/Esc）
//    不回头改 state（显示结果一致，避免渲染期 setState）
//    重渲染，rules/options/columns/标签随 locale 自动重算（dashboard 同款模式）
// 6. 子组件拆分（主体 ≤400 行纪律；本文件加分页器 hidden 补写逻辑与头注释后贴线 408 行）：表格 ./products-table.tsx、表单 ./product-form.tsx、
//    批量栏 ./products-batch-bar.tsx、列设置弹窗 ./products-columns-modal.tsx；
// 7. oas-pagination 的 hidden 声明式失效：组件 update() 在非 hide-on-single 路径无条件
//    removeAttribute("hidden")（node_modules/@oas-ui/ui/dist/navigation/pagination/
//    oas-pagination.js:93），hidden 不在 observedAttributes（补写不回环）。后果：total/
//    current 任一变更（卡片视图搜索、切视图且 page≠1、表格搜空）及组件基类语言自刷
//    在 setAttribute total/current 之后命令式赋 pager.hidden）与 vue 版（watch flush:post）：
//    保留 JSX 声明式 hidden 作首渲染兜底，useEffect 在提交后（晚于 React 的 attribute 补丁
//    与组件同步 update）以 pager.hidden 属性赋值命令式补写，依赖覆盖 hidden 全部输入
//    （view/filtered.length/current）+ locale（基类切语言自刷 update 同样摘 hidden）
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import './products.css'
import { stockLevel } from '../data/products'
import type { ProductRow } from '../data/products'
import { useOasEvent } from '../hooks/use-oas-event'
import { useCategories, useProductMutations, useProductsList } from '../hooks/use-products'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { readFormMode, readPageSize } from '../settings-init'
import type { FormMode } from '../settings-init'
import { session } from '../store/session'
import { readProductColumns } from './product-columns'
import type { ProductColumnKey } from './product-columns'
import { ProductForm } from './product-form'
import { ProductsBatchBar } from './products-batch-bar'
import { ProductsColumnsModal } from './products-columns-modal'
import { ProductsTable } from './products-table'

const VIEW_KEY = 'oas-admin.products-view'
const DEFAULT_PAGE_SIZE = 5

type ViewMode = 'cards' | 'table'

function readView(): ViewMode {
  return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards'
}

/** vanilla readPageSize：读 PAGE_SIZE_KEY，非法/缺省回落 5（settings-init 的 readPageSize 返回字符串） */
function readPageSizeNum(): number {
  const n = Number(readPageSize())
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('en-US')}`
}

export default function ProductsPage() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [view, setView] = useState<ViewMode>(readView)
  const [formMode] = useState<FormMode>(readFormMode)
  const [pageSize] = useState(readPageSizeNum)
  const [selected, setSelected] = useState<number[]>([])
  const [columnKeys, setColumnKeys] = useState<ProductColumnKey[]>(readProductColumns)
  const [surfaceOpen, setSurfaceOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)

  const canMutate = session.user?.role !== 'viewer'

  const searchRef = useRef<HTMLElement | null>(null)
  const categoryRef = useRef<HTMLElement | null>(null)
  const viewRef = useRef<HTMLElement | null>(null)
  const gridRef = useRef<HTMLElement | null>(null)
  const tableRef = useRef<HTMLElement | null>(null)
  const pagerRef = useRef<HTMLElement | null>(null)

  // 列表/分类走 query 缓存；变更走 mutation（成功后失效商品缓存自动重取）
  const { data: rowsData } = useProductsList()
  const rows = rowsData ?? []
  const { data: catsData } = useCategories()
  const categories = useMemo(
    () => (catsData ?? []).map((c) => ({ label: c.name, value: c.name })),
    [catsData],
  )
  const mutations = useProductMutations()

  // 分类被删后回落到「全部分类」（与原 refresh 内的复位等价，由 query 数据变化驱动）
  useEffect(() => {
    setCategory((prev) => (prev && !categories.some((c) => c.value === prev) ? '' : prev))
  }, [categories])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (category && r.category !== category) return false
      if (kw && !r.name.toLowerCase().includes(kw)) return false
      return true
    })
  }, [rows, keyword, category])

  // 手动分页（演示）：宿主 slice + 外部 oas-pagination（users/orders 用表格内置 pagination）
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, maxPage)
  const pageRows = filtered.slice((current - 1) * pageSize, current * pageSize)

  // 组件 update() 在 total/current 变化与语言自刷时无条件摘 hidden，声明式写入会被吞；
  // hidden 不在 observedAttributes，补写不触发回环，故提交后赋权威值是安全的。
  // 依赖必须含 filtered.length（即 total）——total 变化本身就触发组件摘 hidden，
  // 即使 shouldHidePager 逻辑值未变也要补写（「卡片视图搜索」场景）
  const shouldHidePager = view !== 'table' || filtered.length === 0
  useEffect(() => {
    if (pagerRef.current) pagerRef.current.hidden = shouldHidePager
  }, [shouldHidePager, filtered.length, current, locale])

  const openForm = (row: ProductRow | null) => {
    if (formMode === 'page') {
      if (row) sessionStorage.setItem('product-edit-id', String(row.id))
      else sessionStorage.removeItem('product-edit-id')
      navigate('/products/edit')
      return
    }
    setEditingId(row?.id ?? null)
    setSurfaceOpen(true)
  }

  const toggleStatus = async (id: number) => {
    const updated = await mutations.toggleStatus.mutateAsync(id)
    if (!updated) {
      appMessage.error(t('products.notFound'))
      return
    }
    appMessage.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
  }

  const inlineEdit = async (id: number, column: 'price' | 'stock', value: number) => {
    const updated = await mutations.update.mutateAsync({ id, payload: { [column]: value } })
    if (!updated) appMessage.error(t('products.notFound'))
    else appMessage.success(t('common.saved'))
  }

  const clearSelection = () => {
    setSelected([])
    tableRef.current?.removeAttribute('selected')
  }

  const batchStatus = async (target: 'on' | 'off') => {
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    let changed = 0
    for (const id of selected) {
      const row = rows.find((r) => r.id === id)
      if (!row || row.status === target) continue
      if (await mutations.toggleStatus.mutateAsync(id)) changed++
    }
    clearSelection()
    appMessage.success(t('products.batch.statusDone', { count: changed }))
  }

  const batchDelete = async () => {
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    let removed = 0
    for (const id of selected) {
      if (await mutations.remove.mutateAsync(id)) removed++
    }
    clearSelection()
    appMessage.success(t('products.batch.deleted', { count: removed }))
  }

  // 工具栏事件（全部 oas-* 自定义事件 → useOasEvent）
  useOasEvent<{ value: string }>(searchRef, 'oas-input', (d) => {
    setKeyword(d.value)
    setPage(1)
  })
  useOasEvent(searchRef, 'oas-clear', () => {
    setKeyword('')
    setPage(1)
  })
  useOasEvent<{ value: string }>(categoryRef, 'oas-change', (d) => {
    setCategory(d.value)
    setPage(1)
  })
  useOasEvent<{ value: string }>(viewRef, 'oas-change', (d) => {
    const v = d.value as ViewMode
    if ((v !== 'cards' && v !== 'table') || v === view) return
    setView(v)
    setPage(1)
    localStorage.setItem(VIEW_KEY, v)
  })
  useOasEvent<{ page: number }>(pagerRef, 'oas-change', (d) => setPage(d.page))

  useOasEvent(gridRef, 'oas-change', (_d, ev) => {
    const sw = ev.composedPath()[0] as HTMLElement
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    void toggleStatus(id)
  })

  const onGridClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('[data-testid="product-edit"]')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = rows.find((r) => r.id === id)
    if (row) openForm(row)
  }

  const filterOptions = JSON.stringify([
    { label: t('products.allCategories'), value: '' },
    ...categories,
  ])
  const viewOptions = JSON.stringify([
    { label: t('products.viewCards'), value: 'cards' },
    { label: t('products.viewTable'), value: 'table' },
  ])

  return (
    <div className="page products-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.products')}</h1>
          <p className="page-subtitle">{t('products.subtitle')}</p>
        </div>
        <oas-button
          data-testid="product-create"
          type="primary"
          icon="plus"
          onClick={() => openForm(null)}
        >
          {t('products.newProduct')}
        </oas-button>
      </div>
      <div className="products-toolbar">
        <oas-input
          ref={searchRef}
          data-testid="product-search"
          placeholder={t('products.search')}
          clearable
          prefix-icon="search"
        />
        <oas-select
          ref={categoryRef}
          data-testid="product-category"
          placeholder={t('products.category')}
          options={filterOptions}
          value={category}
        />
        <oas-segmented
          ref={viewRef}
          data-testid="product-view"
          className="products-view-toggle"
          options={viewOptions}
          value={view}
        />
        <oas-button
          data-testid="product-columns"
          className="products-columns-btn"
          icon="gear"
          onClick={() => setColumnsOpen(true)}
        >
          {t('products.columns.title')}
        </oas-button>
      </div>
      <ProductsBatchBar
        hidden={view !== 'table' || selected.length === 0}
        selectedCount={selected.length}
        canMutate={canMutate}
        onBatchStatus={(target) => void batchStatus(target)}
        onBatchDelete={() => void batchDelete()}
      />
      <oas-masonry
        ref={gridRef}
        className="product-grid"
        data-testid="product-grid"
        columns="4"
        gap="12px"
        hidden={view !== 'cards'}
        onClick={onGridClick}
      >
        {filtered.length === 0 ? (
          <oas-empty description={t('products.empty')} />
        ) : (
          filtered.map((r) => (
            <oas-card key={r.id} className="product-card" data-id={r.id}>
              <div className="product-card-head">
                <div className="product-name">{r.name}</div>
                <oas-tag className="cat-tag">{r.category}</oas-tag>
              </div>
              <div className="product-price mono">{formatMoney(r.price)}</div>
              <div className="product-meta">
                <span className={`product-stock is-${stockLevel(r.stock)}`}>
                  {t('products.stock', { n: r.stock })}
                </span>
                <span className="product-date mono">{r.created}</span>
              </div>
              <div className="product-card-foot">
                <div className="product-status">
                  <oas-switch
                    data-testid="product-switch"
                    data-id={r.id}
                    checked={r.status === 'on' || undefined}
                  />
                  <span className="product-status-label">
                    {r.status === 'on' ? t('products.status.on') : t('products.status.off')}
                  </span>
                </div>
                <oas-button
                  className="product-edit"
                  size="small"
                  icon="edit"
                  data-testid="product-edit"
                  data-id={r.id}
                  aria-label={t('common.edit')}
                />
              </div>
            </oas-card>
          ))
        )}
      </oas-masonry>
      <ProductsTable
        tableRef={tableRef}
        rows={pageRows}
        columnKeys={columnKeys}
        canMutate={canMutate}
        empty={filtered.length === 0}
        hidden={view !== 'table'}
        onToggleStatus={(id) => void toggleStatus(id)}
        onEditRow={(id) => {
          const row = rows.find((r) => r.id === id)
          if (row) openForm(row)
        }}
        onCheck={setSelected}
        onInlineEdit={inlineEdit}
      />
      {/* hidden 声明式仅首渲染兜底，权威值由上方 useEffect 命令式补写（头注释第 7 条） */}
      <oas-pagination
        ref={pagerRef}
        data-testid="product-pager"
        hidden={shouldHidePager}
        total={filtered.length}
        page-size={pageSize}
        current={current}
        show-total
      />
      {formMode !== 'page' && (
        <ProductForm
          mode={formMode}
          open={surfaceOpen}
          editingId={editingId}
          editing={rows.find((r) => r.id === editingId) ?? null}
          categories={categories}
          onClose={() => setSurfaceOpen(false)}
          onSaved={() => setSurfaceOpen(false)}
        />
      )}
      <ProductsColumnsModal
        open={columnsOpen}
        columnKeys={columnKeys}
        onChange={setColumnKeys}
        onClose={() => setColumnsOpen(false)}
      />
    </div>
  )
}
