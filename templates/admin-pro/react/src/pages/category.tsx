// src/pages/category.tsx —— 商品分类（表格 + 搜索 + modal 表单 + popconfirm 删除）
//    rows 来自 useCategories（TanStack Query 缓存），keyword/editingId/modalOpen 全部
//    useState，过滤/空态/弹窗标题全部由 state 派生；CRUD 走 mutation 失效后自动重取
// 2. 事件绑定：search 的 oas-input/oas-clear、form 的 oas-submit、popconfirm 的 oas-ok、
//    modal 的 oas-close 走 useOasEvent新建按钮为 light DOM 原生
//    click 直绑 onClick；弹窗面板内取消/保存按钮按第 2 条例外在元素上直绑 addEventListener
//   （panel 对原生事件 stopPropagation，React 根委托收不到）
// 3. columns 含 render 函数（cellTag/cellAction 返回真实 DOM 节点），走 property 通道
//    oas-close 回写 state（product-form 同款）
//    重渲染，rules/labels/placeholders/columns 随 locale 自动重算
//    已落地并复用本副本）
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import '../styles/pages/dict.css'
import type { CategoryRow } from '../data/categories'
import { useOasEvent } from '../hooks/use-oas-event'
import { useCategories, useCategoryMutations } from '../hooks/use-products'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla RULES：name/code 必填 */
function buildRules(t: TFunc): string {
  return JSON.stringify({
    name: [{ required: true, message: t('category.rule.name') }],
    code: [{ required: true, message: t('category.rule.code') }],
  })
}

function statusLabel(s: CategoryRow['status'], t: TFunc): string {
  return t(s === 'on' ? 'category.status.on' : 'category.status.off')
}

/** vanilla cellTag：行内状态标签 */
function cellTag(row: CategoryRow, t: TFunc): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', row.status === 'on' ? 'success' : 'default')
  tag.textContent = statusLabel(row.status, t)
  return tag
}

/** vanilla cellAction：编辑按钮 + popconfirm 包裹的删除按钮（testid/data-id 逐字对齐） */
function cellAction(row: CategoryRow, t: TFunc): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'cat-actions'
  ctx.style.cssText = 'display:flex;align-items:center;gap:var(--oas-space-2,8px)'
  const edit = document.createElement('oas-button')
  edit.className = 'category-edit'
  edit.setAttribute('data-testid', 'category-edit')
  edit.setAttribute('data-id', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('icon', 'edit')
  edit.setAttribute('aria-label', t('common.edit'))
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-testid', 'category-del-pop')
  pop.setAttribute('data-del-id', String(row.id))
  pop.setAttribute('title', t('category.confirmDelete'))
  const del = document.createElement('oas-button')
  del.className = 'category-delete'
  del.setAttribute('data-testid', 'category-delete')
  del.setAttribute('data-id', String(row.id))
  del.setAttribute('size', 'small')
  del.setAttribute('icon', 'trash')
  del.setAttribute('type', 'danger')
  del.setAttribute('aria-label', t('common.delete'))
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

/** vanilla TABLE_COLUMNS */
function buildColumns(t: TFunc): TableColumn[] {
  return [
    { key: 'name', title: t('category.th.name') },
    { key: 'code', title: t('category.th.code') },
    { key: 'sort', title: t('category.th.sort'), align: 'right' },
    {
      key: 'status',
      title: t('category.th.status'),
      render: (r) => cellTag(r as unknown as CategoryRow, t),
    },
    {
      key: 'action',
      title: t('category.th.action'),
      render: (r) => cellAction(r as unknown as CategoryRow, t),
    },
  ]
}

interface FormValues {
  name: string
  code: string
  sort: string
  status?: string
  desc?: string
}

export default function CategoryPage() {
  const { t, locale } = useT()
  const [keyword, setKeyword] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const tableRef = useRef<HTMLElement | null>(null)
  const searchRef = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const codeRef = useRef<HTMLElement | null>(null)
  const sortRef = useRef<HTMLElement | null>(null)
  const statusRef = useRef<HTMLElement | null>(null)
  const descRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)
  const savingRef = useRef(false)

  // 列表走 query 缓存，CRUD 走 mutation（成功失效后自动重取）
  const { data } = useCategories()
  const rows = data ?? []
  const { create, update, remove } = useCategoryMutations()

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    return rows.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
  }, [rows, keyword])

  const dataJson = useMemo(() => JSON.stringify(filtered), [filtered])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  const editing = editingId != null ? (rows.find((r) => r.id === editingId) ?? null) : null

  useEffect(() => {
    if (!modalOpen) return
    nameRef.current?.setAttribute('value', editing?.name ?? '')
    codeRef.current?.setAttribute('value', editing?.code ?? '')
    sortRef.current?.setAttribute('value', String(editing?.sort ?? 1))
    const status = statusRef.current
    if (status) {
      if (editing) {
        if (editing.status === 'on') status.setAttribute('checked', '')
        else status.removeAttribute('checked')
      } else {
        status.setAttribute('checked', '')
      }
    }
    descRef.current?.setAttribute('value', editing?.desc ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editingId])

  // panel 内原生 click 例外直绑：取消=关闭；保存=触发内部原生 form 提交
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => setModalOpen(false)
    const onSave = () => {
      ;(
        formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null
      )?.requestSubmit()
    }
    cancel?.addEventListener('click', onCancel)
    save?.addEventListener('click', onSave)
    return () => {
      cancel?.removeEventListener('click', onCancel)
      save?.removeEventListener('click', onSave)
    }
  }, [])

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(modalRef, 'oas-close', () => setModalOpen(false))

  const onWrapClick = (e: React.MouseEvent) => {
    const btn = e.nativeEvent
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.matches('[data-testid="category-edit"]'),
      )
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    if (rows.some((r) => r.id === id)) {
      setEditingId(id)
      setModalOpen(true)
    }
  }

  useOasEvent<{ source: HTMLElement }>(tableRef, 'oas-ok', (detail) => {
    const src = detail.source
    const id = Number(
      src?.hasAttribute?.('data-del-id') ? src.getAttribute('data-del-id') : editingId,
    )
    if (id == null || !Number.isFinite(id)) return
    void (async () => {
      await remove.mutateAsync(id)
      setEditingId(null)
      appMessage.success(t('common.deleted'))
    })()
  })

  useOasEvent<{ values: FormValues }>(formRef, 'oas-submit', async (detail) => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const values = detail.values
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      const sort = Number(values.sort) || 1
      const status = values.status === 'off' ? 'off' : 'on'
      const desc = values.desc?.trim() ?? ''
      if (editingId == null) {
        await create.mutateAsync({ name, code, sort, status, desc })
        appMessage.success(t('common.created'))
      } else {
        await update.mutateAsync({ id: editingId, data: { name, code, sort, status, desc } })
        appMessage.success(t('common.saved'))
      }
      setEditingId(null)
      setModalOpen(false)
    } finally {
      savingRef.current = false
    }
  })

  useOasEvent<{ value: string }>(searchRef, 'oas-input', (d) => {
    setKeyword(d.value ?? '')
  })
  useOasEvent(searchRef, 'oas-clear', () => {
    setKeyword('')
  })

  const rules = buildRules(t)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.category')}</h1>
          <p className="page-subtitle">{t('category.subtitle')}</p>
        </div>
        <oas-button
          data-testid="category-create"
          type="primary"
          icon="plus"
          onClick={() => {
            setEditingId(null)
            setModalOpen(true)
          }}
        >
          {t('category.new')}
        </oas-button>
      </div>
      <div className="dict-items-card">
        <div className="dict-pane-head">
          <oas-input
            ref={searchRef}
            data-testid="category-search"
            placeholder={t('category.search')}
            prefix-icon="search"
            clearable
            className="category-search"
          />
        </div>
        <div
          id="category-items-wrap"
          className={filtered.length === 0 ? 'table-hidden' : undefined}
          onClick={onWrapClick}
        >
          <oas-table
            ref={tableRef}
            data-testid="category-table"
            row-key="id"
            columns={columns}
            data={dataJson}
          />
          <div
            className="table-empty"
            data-testid="category-empty"
            hidden={filtered.length !== 0 || undefined}
          >
            <oas-empty description={t('category.empty')} />
          </div>
        </div>
      </div>

      <oas-modal ref={modalRef} data-testid="category-modal" no-footer visible={modalOpen}>
        <div className="modal-body">
          <h2 id="category-modal-title">
            {editingId == null ? t('category.new') : t('category.edit')}
          </h2>
          <oas-form ref={formRef} id="category-form" rules={rules}>
            <div className="dict-form-body">
              <div className="form-field">
                <label className="form-label">
                  {t('category.form.name')} <span className="req">*</span>
                </label>
                <oas-input
                  ref={nameRef}
                  data-testid="cf-name"
                  name="name"
                  placeholder={t('category.placeholder.name')}
                />
              </div>
              <div className="form-field">
                <label className="form-label">
                  {t('category.form.code')} <span className="req">*</span>
                </label>
                <oas-input
                  ref={codeRef}
                  data-testid="cf-code"
                  name="code"
                  placeholder={t('category.placeholder.code')}
                />
              </div>
              <div className="form-field">
                <label className="form-label">{t('category.form.sort')}</label>
                <oas-input-number
                  ref={sortRef}
                  data-testid="cf-sort"
                  name="sort"
                  min="0"
                  placeholder="1"
                />
              </div>
              <div className="form-field">
                <label className="form-label">{t('category.form.status')}</label>
                <oas-switch ref={statusRef} data-testid="cf-status" name="status" />
              </div>
              <div className="form-field">
                <label className="form-label">{t('category.form.desc')}</label>
                <oas-input
                  ref={descRef}
                  data-testid="cf-desc"
                  name="desc"
                  placeholder={t('category.placeholder.desc')}
                />
              </div>
              <div className="form-actions">
                <oas-space justify="end">
                  <oas-button ref={cancelRef} data-testid="cf-cancel">
                    {t('common.cancel')}
                  </oas-button>
                  <oas-button ref={saveRef} data-testid="cf-save" type="primary">
                    {t('common.save')}
                  </oas-button>
                </oas-space>
              </div>
            </div>
          </oas-form>
        </div>
      </oas-modal>
    </div>
  )
}
