import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'
import {
  createCategory,
  listCategories,
  removeCategory,
  updateCategory,
} from './data/categories.js'

function boot() {
  document.title = `${t('nav.category')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './category.html' })
  window.OASShell.setBreadcrumb([{ label: 'nav.category' }])
  renderCategory()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

function rulesJSON() {
  return JSON.stringify({
    name: [{ required: true, message: t('category.rule.name') }],
    code: [{ required: true, message: t('category.rule.code') }],
  })
}

function renderCategory() {
  const state = { rows: [], keyword: '', editingId: null }
  let saving = false

  const tableWrap = document.querySelector('#category-items-wrap')
  const table = document.querySelector('[data-testid="category-table"]')
  const empty = document.querySelector('[data-testid="category-empty"]')
  const search = document.querySelector('[data-testid="category-search"]')
  const modal = document.querySelector('[data-testid="category-modal"]')
  const form = document.querySelector('#category-form')
  const modalTitle = document.querySelector('#category-modal-title')

  function openModal() {
    modal.setAttribute('visible', '')
  }
  function closeModal() {
    modal.removeAttribute('visible')
  }

  function columns() {
    return [
      { key: 'name', title: t('category.th.name') },
      { key: 'code', title: t('category.th.code') },
      { key: 'sort', title: t('category.th.sort'), align: 'right' },
      {
        key: 'status',
        title: t('category.th.status'),
        render: (r) => {
          const tag = document.createElement('oas-tag')
          tag.setAttribute('type', r.status === 'on' ? 'success' : 'default')
          tag.textContent = t(r.status === 'on' ? 'category.status.on' : 'category.status.off')
          return tag
        },
      },
      {
        key: 'action',
        title: t('category.th.action'),
        render: (r) => {
          const ctx = document.createElement('div')
          ctx.className = 'cat-actions'
          ctx.style.cssText = 'display:flex;align-items:center;gap:var(--oas-space-2,8px)'
          const edit = document.createElement('oas-button')
          edit.className = 'category-edit'
          edit.setAttribute('data-testid', 'category-edit')
          edit.setAttribute('data-id', String(r.id))
          edit.setAttribute('size', 'small')
          edit.setAttribute('icon', 'edit')
          edit.setAttribute('aria-label', t('common.edit'))
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('data-testid', 'category-del-pop')
          pop.setAttribute('data-del-id', String(r.id))
          pop.setAttribute('title', t('category.confirmDelete'))
          const del = document.createElement('oas-button')
          del.className = 'category-delete'
          del.setAttribute('data-testid', 'category-delete')
          del.setAttribute('data-id', String(r.id))
          del.setAttribute('size', 'small')
          del.setAttribute('icon', 'trash')
          del.setAttribute('type', 'danger')
          del.setAttribute('aria-label', t('common.delete'))
          pop.appendChild(del)
          ctx.appendChild(edit)
          ctx.appendChild(pop)
          return ctx
        },
      },
    ]
  }

  function renderTable() {
    const kw = state.keyword.trim()
    const list = state.rows.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
    table.columns = columns()
    table.setAttribute('data', JSON.stringify(list))
    empty.hidden = list.length !== 0
    tableWrap.classList.toggle('table-hidden', list.length === 0)
  }

  function fillForm(row) {
    state.editingId = row?.id ?? null
    document.querySelector('[data-testid="cf-name"]').setAttribute('value', row?.name ?? '')
    document.querySelector('[data-testid="cf-code"]').setAttribute('value', row?.code ?? '')
    document.querySelector('[data-testid="cf-sort"]').setAttribute('value', String(row?.sort ?? 1))
    const status = document.querySelector('[data-testid="cf-status"]')
    if (row) {
      if (row.status === 'on') status.setAttribute('checked', '')
      else status.removeAttribute('checked')
    } else {
      status.setAttribute('checked', '')
    }
    document.querySelector('[data-testid="cf-desc"]').setAttribute('value', row?.desc ?? '')
    modalTitle.textContent = row ? t('category.edit') : t('category.new')
  }

  document.querySelector('[data-testid="category-create"]').addEventListener('click', () => {
    fillForm(null)
    openModal()
  })
  document.querySelector('[data-testid="cf-cancel"]').addEventListener('click', closeModal)
  document.querySelector('[data-testid="cf-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  table.addEventListener('click', (e) => {
    const editBtn = e.composedPath().find((n) => n.matches?.('[data-testid="category-edit"]'))
    if (editBtn) {
      const row = state.rows.find((r) => r.id === Number(editBtn.getAttribute('data-id')))
      if (row) {
        fillForm(row)
        openModal()
      }
    }
    // v2.2.8 起单元格内 popconfirm 原生自驱动，无需手动 open
  })

  table.addEventListener('oas-ok', (e) => {
    // popconfirm ok 事件带 detail.source，反查 data-del-id
    const src = e.detail?.source
    const id = Number(
      src?.hasAttribute?.('data-del-id') ? src.getAttribute('data-del-id') : state.editingId,
    )
    if (!Number.isFinite(id)) return
    removeCategory(id).then(() => {
      state.editingId = null
      OASUI.message.success(t('common.deleted'))
      refresh()
    })
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = e.detail?.values ?? {}
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      const sort = Number(values.sort) || 1
      const status = values.status === 'off' ? 'off' : 'on'
      const desc = values.desc?.trim() ?? ''
      if (state.editingId == null) {
        await createCategory({ name, code, sort, status, desc })
        OASUI.message.success(t('common.created'))
      } else {
        await updateCategory(state.editingId, { name, code, sort, status, desc })
        OASUI.message.success(t('common.saved'))
      }
      state.editingId = null
      closeModal()
      await refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = e.detail?.value ?? ''
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    renderTable()
  })

  form.setAttribute('rules', rulesJSON())

  async function refresh() {
    state.rows = await listCategories()
    renderTable()
  }
  refresh()
}

if (guard()) boot()
