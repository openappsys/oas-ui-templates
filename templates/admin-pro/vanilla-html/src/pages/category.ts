import { message } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'
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
          <table class="dict-items-table" data-testid="category-table">
            <thead>
              <tr>
                <th>${t('category.th.name')}</th>
                <th>${t('category.th.code')}</th>
                <th class="num">${t('category.th.sort')}</th>
                <th>${t('category.th.status')}</th>
                <th>${t('category.th.action')}</th>
              </tr>
            </thead>
            <tbody id="category-body"></tbody>
          </table>
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
  const body = el.querySelector<HTMLElement>('#category-body')!
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

  function esc(v: string): string {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function renderTable(): void {
    const kw = state.keyword.trim()
    const list = state.rows.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
    tableWrap.classList.toggle('table-hidden', list.length === 0)
    body.innerHTML = list
      .map(
        (r) => `<tr data-id="${r.id}" data-testid="category-row">
          <td>${esc(r.name)}</td>
          <td class="mono">${esc(r.code)}</td>
          <td class="num">${r.sort}</td>
          <td><oas-tag type="${r.status === 'on' ? 'success' : 'default'}">${statusLabel(r.status)}</oas-tag></td>
          <td class="cat-actions">
            <oas-button size="small" icon="edit" data-testid="category-edit" data-id="${r.id}" aria-label="${t('common.edit')}"></oas-button>
            <oas-popconfirm title="${t('category.confirmDelete')}" data-testid="category-del-pop">
              <oas-button size="small" icon="trash" type="danger" data-testid="category-delete" data-id="${r.id}" aria-label="${t('common.delete')}"></oas-button>
            </oas-popconfirm>
          </td>
        </tr>`,
      )
      .join('')
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

  body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const editBtn = target.closest<HTMLElement>('[data-testid="category-edit"]')
    if (editBtn) {
      const row = state.rows.find((r) => r.id === Number(editBtn.getAttribute('data-id')))
      if (row) {
        fillForm(row)
        openModal()
      }
      return
    }
    const delBtn = target.closest<HTMLElement>('[data-testid="category-delete"]')
    if (delBtn) {
      const id = Number(delBtn.getAttribute('data-id'))
      if (Number.isFinite(id)) state.editingId = id
    }
  })

  body.addEventListener('oas-ok', (e) => {
    const btn = (e.target as HTMLElement)?.closest<HTMLElement>('[data-testid="category-del-pop"]')
    void (async () => {
      const id = btn
        ? Number(btn.querySelector('[data-testid="category-delete"]')?.getAttribute('data-id'))
        : state.editingId
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

  void refresh()

  return () => {}
}
