/**
 * 商品分类页（自 vanilla src/pages/category.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 搜索 + 表格 + 弹窗表单（名称/编码必填、排序、状态开关、描述）
 */
import { onLocaleChange, t } from './i18n.js'
import { createCategory, listCategories, removeCategory, updateCategory } from './data/categories.js'

const RULES = () =>
  JSON.stringify({
    name: [{ required: true, message: t('category.rule.name') }],
    code: [{ required: true, message: t('category.rule.code') }],
  })

function cellTag(row) {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', row.status === 'on' ? 'success' : 'default')
  tag.textContent = t(row.status === 'on' ? 'category.status.on' : 'category.status.off')
  return tag
}

function cellAction(row) {
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

const TABLE_COLUMNS = () => [
  { key: 'name', title: t('category.th.name') },
  { key: 'code', title: t('category.th.code') },
  { key: 'sort', title: t('category.th.sort'), align: 'right' },
  { key: 'status', title: t('category.th.status'), render: cellTag },
  { key: 'action', title: t('category.th.action'), render: cellAction },
]

export function renderCategory(el) {
  const state = { rows: [], keyword: '', editingId: null }
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

  const tableWrap = el.querySelector('#category-items-wrap')
  const table = el.querySelector('[data-testid="category-table"]')
  const empty = el.querySelector('[data-testid="category-empty"]')
  const search = el.querySelector('[data-testid="category-search"]')
  const modal = el.querySelector('[data-testid="category-modal"]')
  const form = el.querySelector('#category-form')
  const modalTitle = el.querySelector('#category-modal-title')

  function renderTable() {
    const kw = state.keyword.trim()
    const list = state.rows.filter((r) => !kw || r.name.includes(kw) || r.code.includes(kw))
    table.columns = TABLE_COLUMNS()
    table.setAttribute('data', JSON.stringify(list))
    empty.hidden = list.length !== 0
    tableWrap.classList.toggle('table-hidden', list.length === 0)
  }

  async function refresh() {
    state.rows = await listCategories()
    // stale 守卫：等待期间导航离开后 el 已脱离文档，renderTable 只会写入陈旧 DOM，直接放弃
    if (!el.isConnected) return
    renderTable()
  }

  function fillForm(row) {
    state.editingId = row?.id ?? null
    el.querySelector('[data-testid="cf-name"]').setAttribute('value', row?.name ?? '')
    el.querySelector('[data-testid="cf-code"]').setAttribute('value', row?.code ?? '')
    el.querySelector('[data-testid="cf-sort"]').setAttribute('value', String(row?.sort ?? 1))
    const status = el.querySelector('[data-testid="cf-status"]')
    if (row) {
      if (row.status === 'on') status.setAttribute('checked', '')
      else status.removeAttribute('checked')
    } else {
      status.setAttribute('checked', '')
    }
    el.querySelector('[data-testid="cf-desc"]').setAttribute('value', row?.desc ?? '')
    modalTitle.textContent = row ? t('category.edit') : t('category.new')
  }

  el.querySelector('[data-testid="category-create"]').addEventListener('click', () => {
    fillForm(null)
    modal.setAttribute('visible', '')
  })

  el.querySelector('[data-testid="cf-cancel"]').addEventListener('click', () => {
    modal.removeAttribute('visible')
  })

  el.querySelector('[data-testid="cf-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  table.addEventListener('click', (e) => {
    const path = e.composedPath()
    const editBtn = path.find((n) => n.matches?.('[data-testid="category-edit"]'))
    if (editBtn) {
      const row = state.rows.find((r) => r.id === Number(editBtn.getAttribute('data-id')))
      if (row) {
        fillForm(row)
        modal.setAttribute('visible', '')
      }
    }
    // v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open
  })

  table.addEventListener('oas-ok', (e) => {
    // v2.2.8 起 popconfirm 的 ok/cancel 事件带 detail.source，直接反查来源
    const src = e.detail.source
    const id = Number(
      src?.hasAttribute?.('data-del-id') ? src.getAttribute('data-del-id') : state.editingId,
    )
    ;(async () => {
      if (id == null || !Number.isFinite(id)) return
      await removeCategory(id)
      state.editingId = null
      OASUI.message.success(t('common.deleted'))
      refresh()
    })()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = e.detail.values
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
      modal.removeAttribute('visible')
      refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = e.detail.value ?? ''
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    renderTable()
  })

  function refreshText() {
    document.title = `${t('nav.category')} · ${t('app.title')}`
    el.querySelector('h1.page-title').textContent = t('nav.category')
    el.querySelector('p.page-subtitle').textContent = t('category.subtitle')
    el.querySelector('[data-testid="category-create"]').textContent = t('category.new')
    search.setAttribute('placeholder', t('category.search'))
    el.querySelector('[data-testid="category-empty"] oas-empty').setAttribute(
      'description',
      t('category.empty'),
    )
    // 表单弹窗：标题随新建/编辑态 + 字段 label/占位/规则/按钮
    el.querySelector('#category-modal-title').textContent =
      state.editingId == null ? t('category.new') : t('category.edit')
    const LABEL_KEYS = [
      'category.form.name',
      'category.form.code',
      'category.form.sort',
      'category.form.status',
      'category.form.desc',
    ]
    el.querySelectorAll('#category-form .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (k) {
        const req = n.querySelector('.req')
        n.textContent = t(k)
        if (req) n.append(' ', req)
      }
    })
    el
      .querySelector('[data-testid="cf-name"]')
      .setAttribute('placeholder', t('category.placeholder.name'))
    el
      .querySelector('[data-testid="cf-code"]')
      .setAttribute('placeholder', t('category.placeholder.code'))
    el
      .querySelector('[data-testid="cf-desc"]')
      .setAttribute('placeholder', t('category.placeholder.desc'))
    form.setAttribute('rules', RULES())
    el.querySelector('[data-testid="cf-cancel"]').textContent = t('common.cancel')
    el.querySelector('[data-testid="cf-save"]').textContent = t('common.save')
    // 表格列定义（t 文案）+ 行内状态标签随语言重建；搜索词不动
    renderTable()
  }

  document.title = `${t('nav.category')} · ${t('app.title')}`
  refresh()
  return onLocaleChange(refreshText)
}
