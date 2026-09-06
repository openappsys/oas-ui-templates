// src/pages/products.tsx —— 商品管理（卡片/列表双视图 + 三表单模式 + 批量操作 + 列设置持久化）
// 行为事实来源：vanilla-html/src/pages/products.ts（755 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + setAttribute 回写）；本模版声明式——
//    rows/keyword/category/page/view/selected/columnKeys 全部 useState，表格切片/空态/批量栏
//    显隐/分页属性全部由 state 派生；refresh() 仅重拉数据 setRows，重渲染即最新
// 2. 事件绑定：oas-input/oas-select/oas-segmented/oas-pagination/oas-popconfirm/oas-checkbox
//    的 oas-* 自定义事件一律 useOasEvent（AGENTS.md 第 1 条）；工具栏/批量栏按钮为 light DOM
//    原生 click 直绑 onClick；列设置弹窗内的重置/完成按钮在 oas-modal panel 内，按第 2 条
//    例外直绑 addEventListener；卡片编辑按钮在 oas-masonry 的 light DOM 子节点上，onClick
//    委托即可（vanilla 同款 closest 匹配）
// 3. visible 受控同步：列设置弹窗/表单容器的 visible 由 state 持有，组件侧关闭（遮罩/Esc）
//    经 oas-close 回写 state（vanilla 靠组件自摘属性，无此问题）——两处 oas-close 监听是
//    本模版新增，行为与 vanilla 一致
// 4. 手动分页：vanilla 超页时静默 state.page = maxPage；本模版派生 current = min(page, maxPage)
//    不回头改 state（显示结果一致，避免渲染期 setState）
// 5. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换；本模版 useT() 订阅后整页
//    重渲染，rules/options/columns/标签随 locale 自动重算（dashboard 同款模式）
// 6. 表单：dialog/drawer 形态拆为 ./product-form.tsx；page 形态跳 /products/edit
//   （sessionStorage 键 product-edit-id 与 vanilla 逐字一致）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import '../styles/pages/products.css'
import { listCategories } from '../data/categories'
import {
  listProducts,
  removeProduct,
  stockLevel,
  toggleProductStatus,
  updateProduct,
} from '../data/products'
import type { ProductRow } from '../data/products'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { readFormMode, readPageSize } from '../settings-init'
import type { FormMode } from '../settings-init'
import { session } from '../store/session'
import {
  PRODUCT_COLUMN_KEYS,
  PRODUCT_COLUMN_MANDATORY,
  readProductColumns,
  writeProductColumns,
} from './product-columns'
import type { ProductColumnKey } from './product-columns'
import { ProductForm } from './product-form'
import type { Option } from './product-form'
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
  const { t } = useT()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Option[]>([])
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
  const batchDelPopRef = useRef<HTMLElement | null>(null)
  const columnsModalRef = useRef<HTMLElement | null>(null)
  const columnsResetRef = useRef<HTMLElement | null>(null)
  const columnsCloseRef = useRef<HTMLElement | null>(null)

  // vanilla refresh()：并发拉商品 + 分类；当前筛选分类失效时清空（applyCategoryOptions 语义）
  const refresh = useCallback(async () => {
    const [list, cats] = await Promise.all([listProducts(), listCategories()])
    setRows(list)
    const opts = cats.map((c) => ({ label: c.name, value: c.name }))
    setCategories(opts)
    setCategory((prev) => (prev && !opts.some((c) => c.value === prev) ? '' : prev))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // vanilla filtered()：关键字（小写包含）+ 分类精确匹配
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

  const batchEnabled = canMutate && selected.length > 0

  // vanilla openForm：page 模式写 sessionStorage 跳编辑页；其余就地开表单容器
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

  // vanilla grid/table 开关切换段（共用）
  const toggleStatus = async (id: number) => {
    const updated = await toggleProductStatus(id)
    if (!updated) {
      appMessage.error(t('products.notFound'))
      return
    }
    appMessage.success(updated.status === 'on' ? t('products.status.on') : t('products.status.off'))
    void refresh()
  }

  // vanilla oas-edit 行内编辑持久化段
  const inlineEdit = (id: number, column: 'price' | 'stock', value: number) => {
    void updateProduct(id, { [column]: value }).then((updated) => {
      if (!updated) appMessage.error(t('products.notFound'))
      else appMessage.success(t('common.saved'))
      void refresh()
    })
  }

  // vanilla clearSelection：清空选中 + 摘掉表格 selected 属性（组件受控集合外的人工复位）
  const clearSelection = () => {
    setSelected([])
    tableRef.current?.removeAttribute('selected')
  }

  // vanilla batchStatus：逐项 toggle 至目标态，统计变更数
  const batchStatus = async (target: 'on' | 'off') => {
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    let changed = 0
    for (const id of selected) {
      const row = rows.find((r) => r.id === id)
      if (!row || row.status === target) continue
      if (await toggleProductStatus(id)) changed++
    }
    clearSelection()
    appMessage.success(t('products.batch.statusDone', { count: changed }))
    void refresh()
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

  // 卡片视图开关（vanilla grid oas-change 段：composedPath 源头取 data-id）
  useOasEvent(gridRef, 'oas-change', (_d, ev) => {
    const sw = ev.composedPath()[0] as HTMLElement
    const id = Number(sw.getAttribute('data-id'))
    if (!id) return
    void toggleStatus(id)
  })

  // 批量删除（vanilla popconfirm oas-ok 段）
  useOasEvent(batchDelPopRef, 'oas-ok', async () => {
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    let removed = 0
    for (const id of selected) {
      if (await removeProduct(id)) removed++
    }
    clearSelection()
    appMessage.success(t('products.batch.deleted', { count: removed }))
    void refresh()
  })

  // 列设置：checkbox 勾选写偏好（vanilla columnsModal oas-change 段）；oas-close 回写受控 visible
  useOasEvent<{ checked: boolean; value: string }>(columnsModalRef, 'oas-change', (detail) => {
    if (!detail) return
    const key = detail.value as ProductColumnKey
    if (!PRODUCT_COLUMN_KEYS.includes(key) || PRODUCT_COLUMN_MANDATORY.includes(key)) return
    setColumnKeys((prev) => {
      const next = detail.checked
        ? prev.includes(key)
          ? prev
          : [...prev, key]
        : prev.filter((k) => k !== key)
      writeProductColumns(next)
      return next
    })
  })
  useOasEvent(columnsModalRef, 'oas-close', () => setColumnsOpen(false))

  // 列设置弹窗内按钮（panel 原生 click 例外直绑）：重置=恢复默认并持久化；完成=关闭
  useEffect(() => {
    const reset = columnsResetRef.current
    const close = columnsCloseRef.current
    const onReset = () => {
      const next = [...PRODUCT_COLUMN_KEYS]
      setColumnKeys(next)
      writeProductColumns(next)
    }
    const onClose = () => setColumnsOpen(false)
    reset?.addEventListener('click', onReset)
    close?.addEventListener('click', onClose)
    return () => {
      reset?.removeEventListener('click', onReset)
      close?.removeEventListener('click', onClose)
    }
  }, [])

  // 卡片视图编辑按钮：light DOM 子节点，React onClick 委托（vanilla closest 匹配同款）
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
      <div
        className="product-batch-bar"
        data-testid="product-batch-bar"
        hidden={view !== 'table' || selected.length === 0}
      >
        <span className="product-batch-count" data-testid="product-batch-count">
          {selected.length > 0 ? t('products.batch.selected', { count: selected.length }) : ''}
        </span>
        <oas-space className="product-batch-actions" justify="end">
          <oas-button
            data-testid="product-batch-unlist"
            size="small"
            disabled={!batchEnabled || undefined}
            onClick={() => void batchStatus('off')}
          >
            {t('products.batch.unlist')}
          </oas-button>
          <oas-button
            data-testid="product-batch-list"
            size="small"
            disabled={!batchEnabled || undefined}
            onClick={() => void batchStatus('on')}
          >
            {t('products.batch.list')}
          </oas-button>
          <oas-popconfirm
            ref={batchDelPopRef}
            data-testid="product-batch-del-pop"
            id="product-batch-del-pop"
            title={t('products.batch.confirmDelete', { count: selected.length })}
          >
            <oas-button
              data-testid="product-batch-delete"
              size="small"
              type="danger"
              disabled={!batchEnabled || undefined}
            >
              {t('products.batch.delete')}
            </oas-button>
          </oas-popconfirm>
        </oas-space>
      </div>
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
      <oas-pagination
        ref={pagerRef}
        data-testid="product-pager"
        hidden={view !== 'table' || filtered.length === 0}
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
          onSaved={() => {
            setSurfaceOpen(false)
            void refresh()
          }}
        />
      )}
      <oas-modal
        ref={columnsModalRef}
        data-testid="product-columns-modal"
        id="product-columns-modal"
        title={t('products.columns.title')}
        no-footer
        visible={columnsOpen}
      >
        <div className="product-columns-list" data-testid="product-columns-list">
          {PRODUCT_COLUMN_KEYS.map((key) => {
            const title = key === 'category' ? t('products.category') : t(`products.th.${key}`)
            const mandatory = PRODUCT_COLUMN_MANDATORY.includes(key)
            return (
              <label key={key} className="product-column-check">
                <oas-checkbox
                  data-testid={`product-columns-${key}`}
                  value={key}
                  checked={mandatory || columnKeys.includes(key) || undefined}
                  disabled={mandatory || undefined}
                >
                  {title}
                </oas-checkbox>
              </label>
            )
          })}
        </div>
        <div className="form-actions">
          <oas-space justify="end">
            <oas-button ref={columnsResetRef} data-testid="product-columns-reset">
              {t('products.columns.reset')}
            </oas-button>
            <oas-button ref={columnsCloseRef} data-testid="product-columns-close" type="primary">
              {t('common.save')}
            </oas-button>
          </oas-space>
        </div>
      </oas-modal>
    </div>
  )
}
