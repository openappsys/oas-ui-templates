import { message } from '@oas-ui/ui/feedback/message'
import type { OASTable, TableColumn } from '@oas-ui/ui/data/table'
import { onLocaleChange, t } from '../i18n'
import { createCategory, listCategories, removeCategory, updateCategory } from '../data/categories'
import type { CategoryRow } from '../data/categories'
import '../styles/pages/dict.css'

const RULES = (): string =>
  JSON.stringify({
    name: [{ required: true, message: t('category.rule.name') }],
    code: [{ required: true, message: t('category.rule.code') }],
  })

function statusLabel(s: CategoryRow['status']): string {
  return t(s === 'on' ? 'category.status.on' : 'category.status.off')
}

function cellTag(row: CategoryRow): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', row.status === 'on' ? 'success' : 'default')
  tag.textContent = statusLabel(row.status)
  return tag
}

function cellAction(row: CategoryRow): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'cat-actions'
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

const TABLE_COLUMNS = (): TableColumn[] => [
  { key: 'name', title: t('category.th.name') },
  { key: 'code', title: t('category.th.code') },
  { key: 'sort', title: t('category.th.sort'), align: 'right' },
  {
    key: 'status',
    title: t('category.th.status'),
    render: (r) => cellTag(r as unknown as CategoryRow),
  },
  {
    key: 'action',
    title: t('category.th.action'),
    render: (r) => cellAction(r as unknown as CategoryRow),
  },
]

interface PageState {
  rows: CategoryRow[]
  keyword: string
  editingId: number | null
}

export function render(el: HTMLElement): () => void {
  const state: PageState = { rows: [], keyword: '', editingId: null }
  let saving = false

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.category')}</h1>
          <p class="page-subtitle">${t('category.subtitle')}</p>
        </div>
        <oas-button data-testid="category-create" type="primary" icon="plus">${t('category.new')}</oas-button>
      </div>
      <div class="dict-items-card">
        <div class="dict-pane-head">
          <oas-input data-testid="category-search" placeholder="${t('category.search')}" prefix-icon="search" clearable class="category-search"></oas-input>
        </div>
        <div id="category-items-wrap">
          <oas-table data-testid="category-table" row-key="id"></oas-table>
          <div class="table-empty" data-testid="category-empty" hidden>
            <oas-empty description="${t('category.empty')}"></oas-empty>
          </div>
        </div>
      </div>

      <oas-modal data-testid="category-modal" no-footer>
        <div class="modal-body">
          <h2 id="category-modal-title">${t('category.new')}</h2>
          <oas-form id="category-form" rules='${RULES()}'>
            <div class="dict-form-body">
              <div class="form-field">
                <label class="form-label">${t('category.form.name')} <span class="req">*</span></label>
                <oas-input data-testid="cf-name" name="name" placeholder="${t('category.placeholder.name')}"></oas-input>
              </div>
              <div class="form-field">
                <label class="form-label">${t('category.form.code')} <span class="req">*</span></label>
                <oas-input data-testid="cf-code" name="code" placeholder="${t('category.placeholder.code')}"></oas-input>
              </div>
              <div class="form-field">
                <label class="form-label">${t('category.form.sort')}</label>
                <oas-input-number data-testid="cf-sort" name="sort" min="0" placeholder="1"></oas-input-number>
              </div>
              <div class="form-field">
                <label class="form-label">${t('category.form.status')}</label>
                <oas-switch data-testid="cf-status" name="status" checked></oas-switch>
              </div>
              <div class="form-field">
                <label class="form-label">${t('category.form.desc')}</label>
                <oas-input data-testid="cf-desc" name="desc" placeholder="${t('category.placeholder.desc')}"></oas-input>
              </div>
              <div class="form-actions">
                <oas-space justify="end">
                  <oas-button data-testid="cf-cancel">${t('common.cancel')}</oas-button>
                  <oas-button data-testid="cf-save" type="primary">${t('common.save')}</oas-button>
                </oas-space>
              </div>
            </div>
          </oas-form>
        </div>
      </oas-modal>
    </div>`

  const tableWrap = el.querySelector<HTMLElement>('#category-items-wrap')!
  const table = el.querySelector<OASTable>('[data-testid="category-table"]')!
  const empty = el.querySelector<HTMLElement>('[data-testid="category-empty"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="category-search"]')!
  const modal = el.querySelector<HTMLElement>('[data-testid="category-modal"]')!
  const form = el.querySelector<HTMLElement>('#category-form')!
  const modalTitle = el.querySelector<HTMLElement>('#category-modal-title')!

  function openModal(): void {
    modal.setAttribute('visible', '')
  }
  function closeModal(): void {
    modal.removeAttribute('visible')
  }

  function renderTable(): void {
    const kw = state.keyword.trim()
    const list = state.rows.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
    table.columns = TABLE_COLUMNS()
    table.setAttribute('data', JSON.stringify(list))
    empty.hidden = list.length !== 0
    tableWrap.classList.toggle('table-hidden', list.length === 0)
  }

  async function refresh(): Promise<void> {
    state.rows = await listCategories()
    renderTable()
  }

  function fillForm(row: CategoryRow | null): void {
    state.editingId = row?.id ?? null
    el.querySelector<HTMLElement>('[data-testid="cf-name"]')!.setAttribute('value', row?.name ?? '')
    el.querySelector<HTMLElement>('[data-testid="cf-code"]')!.setAttribute('value', row?.code ?? '')
    el.querySelector<HTMLElement>('[data-testid="cf-sort"]')!.setAttribute(
      'value',
      String(row?.sort ?? 1),
    )
    const status = el.querySelector<HTMLElement>('[data-testid="cf-status"]')!
    if (row) {
      if (row.status === 'on') status.setAttribute('checked', '')
      else status.removeAttribute('checked')
    } else {
      status.setAttribute('checked', '')
    }
    el.querySelector<HTMLElement>('[data-testid="cf-desc"]')!.setAttribute('value', row?.desc ?? '')
    modalTitle.textContent = row ? t('category.edit') : t('category.new')
  }

  el.querySelector<HTMLElement>('[data-testid="category-create"]')!.addEventListener(
    'click',
    () => {
      fillForm(null)
      openModal()
    },
  )

  el.querySelector<HTMLElement>('[data-testid="cf-cancel"]')!.addEventListener('click', closeModal)

  el.querySelector<HTMLElement>('[data-testid="cf-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  table.addEventListener('click', (e) => {
    const path = e.composedPath() as HTMLElement[]
    const editBtn = path.find((n) => n.matches?.('[data-testid="category-edit"]'))
    if (editBtn) {
      const row = state.rows.find((r) => r.id === Number(editBtn.getAttribute('data-id')))
      if (row) {
        fillForm(row)
        openModal()
      }
      return
    }
    // v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open
  })

  table.addEventListener('oas-ok', (e) => {
    // v2.2.8 起 popconfirm 的 ok/cancel 事件带 detail.source，直接反查来源
    const src = (e as CustomEvent<{ source: HTMLElement }>).detail.source
    const id = Number(
      src?.hasAttribute?.('data-del-id') ? src.getAttribute('data-del-id') : state.editingId,
    )
    void (async () => {
      if (id == null || !Number.isFinite(id)) return
      await removeCategory(id)
      state.editingId = null
      message.success(t('common.deleted'))
      void refresh()
    })()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = (
        e as CustomEvent<{
          values: { name: string; code: string; sort: string; status?: string; desc?: string }
        }>
      ).detail.values
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      const sort = Number(values.sort) || 1
      const status = values.status === 'off' ? 'off' : 'on'
      const desc = values.desc?.trim() ?? ''
      if (state.editingId == null) {
        await createCategory({ name, code, sort, status, desc })
        message.success(t('common.created'))
      } else {
        await updateCategory(state.editingId, { name, code, sort, status, desc })
        message.success(t('common.saved'))
      }
      state.editingId = null
      closeModal()
      void refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value ?? ''
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    renderTable()
  })

  function refreshText(): void {
    el.querySelector<HTMLElement>('h1.page-title')!.textContent = t('nav.category')
    el.querySelector<HTMLElement>('p.page-subtitle')!.textContent = t('category.subtitle')
    el.querySelector<HTMLElement>('[data-testid="category-create"]')!.textContent =
      t('category.new')
    search.setAttribute('placeholder', t('category.search'))
    el.querySelector<HTMLElement>('[data-testid="category-empty"] oas-empty')!.setAttribute(
      'description',
      t('category.empty'),
    )
    // 表单弹窗：标题随新建/编辑态 + 字段 label/占位/规则/按钮
    el.querySelector<HTMLElement>('#category-modal-title')!.textContent =
      state.editingId == null ? t('category.new') : t('category.edit')
    const LABEL_KEYS = [
      'category.form.name',
      'category.form.code',
      'category.form.sort',
      'category.form.status',
      'category.form.desc',
    ]
    el.querySelectorAll<HTMLElement>('#category-form .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (k) {
        const req = n.querySelector('.req')
        n.textContent = t(k)
        if (req) n.append(' ', req)
      }
    })
    el.querySelector<HTMLElement>('[data-testid="cf-name"]')!.setAttribute(
      'placeholder',
      t('category.placeholder.name'),
    )
    el.querySelector<HTMLElement>('[data-testid="cf-code"]')!.setAttribute(
      'placeholder',
      t('category.placeholder.code'),
    )
    el.querySelector<HTMLElement>('[data-testid="cf-desc"]')!.setAttribute(
      'placeholder',
      t('category.placeholder.desc'),
    )
    form.setAttribute('rules', RULES())
    el.querySelector<HTMLElement>('[data-testid="cf-cancel"]')!.textContent = t('common.cancel')
    el.querySelector<HTMLElement>('[data-testid="cf-save"]')!.textContent = t('common.save')
    // 表格列定义（t 文案）+ 行内状态标签随语言重建；搜索词不动
    renderTable()
  }

  void refresh()

  return onLocaleChange(refreshText)
}
