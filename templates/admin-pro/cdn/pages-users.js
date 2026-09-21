/**
 * 用户管理页（自 vanilla src/pages/users.ts 去 TS 移植，DOM/类名/testid 逐字对齐）
 * 列表（ID/角色可筛选/状态可筛选/创建时间可排序）+ 新建/编辑表单（oas-form rules）+
 * 行点击详情弹窗（头像 + descriptions + 权限标识对照）+ viewer 只读权限提示
 * 纯函数助手在 user-shared.js；详情弹窗在 user-detail.js
 */
import { onLocaleChange, t } from './i18n.js'
import { createUser, listUsers, removeUser, updateUser } from './data/users.js'
import { listRoles, treeMenus } from './data/system.js'
import {
  COLUMNS,
  RULES,
  canMutate,
  fromPath,
  pageSize,
  roleEnumFor,
  roleLabel,
  statusLabel,
} from './user-shared.js'
import { detailModalHtml, fillDetail } from './user-detail.js'

export function renderUsers(el) {
  const state = {
    rows: [],
    roles: [],
    roleMap: new Map(),
    menuTree: [],
    keyword: '',
    editingId: null,
  }
  let saving = false

  document.title = `${t('users.title')} · ${t('app.title')}`
  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('users.title')}</h1>
          <p class="page-subtitle">${t('users.subtitle')}</p>
        </div>
        <oas-button data-testid="user-create" type="primary" icon="plus">${t('users.new')}</oas-button>
      </div>
      <oas-card class="list-card" title="${t('users.list')}">
        <div class="users-toolbar" slot="extra">
          <oas-input data-testid="user-search" placeholder="${t('users.search')}" clearable prefix-icon="search"></oas-input>
          <oas-button id="users-refresh" icon="refresh" title="${t('common.refresh')}"></oas-button>
        </div>
        <div class="table-wrap" id="table-wrap">
          <oas-table data-testid="users-table" row-key="id" data="[]" pagination page-size="${pageSize()}"></oas-table>
          <div class="empty-overlay" id="empty-overlay" hidden>
            <oas-empty description="${t('users.empty')}"></oas-empty>
            <oas-button id="clear-filters" type="primary">${t('common.clearFilter')}</oas-button>
          </div>
        </div>
      </oas-card>

      <oas-modal data-testid="user-form-modal" no-footer>
        <div class="modal-body">
          <h2 id="form-title">${t('users.new')}</h2>
          <oas-form id="user-form" rules='${RULES()}'>
            <div class="form-grid">
              <oas-input data-testid="field-name" name="name" placeholder="${t('users.name')}"></oas-input>
              <oas-input data-testid="field-email" name="email" placeholder="${t('users.email')}"></oas-input>
              <oas-select data-testid="field-role" name="roleId" options="[]"></oas-select>
              <oas-select data-testid="field-status" name="status" options='${JSON.stringify([
                { label: statusLabel('active'), value: 'active' },
                { label: statusLabel('disabled'), value: 'disabled' },
              ])}'></oas-select>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="form-cancel">${t('common.cancel')}</oas-button>
                <oas-button data-testid="form-save" type="primary">${t('common.save')}</oas-button>
              </oas-space>
            </div>
          </oas-form>
        </div>
      </oas-modal>

      <oas-modal data-testid="user-detail-modal" no-footer>${detailModalHtml()}</oas-modal>
    </div>`

  const table = el.querySelector('[data-testid="users-table"]')
  const search = el.querySelector('[data-testid="user-search"]')
  const formModal = el.querySelector('[data-testid="user-form-modal"]')
  const detailModal = el.querySelector('[data-testid="user-detail-modal"]')
  const form = el.querySelector('#user-form')
  const tableWrap = el.querySelector('#table-wrap')
  const emptyOverlay = el.querySelector('#empty-overlay')
  const fieldRole = el.querySelector('[data-testid="field-role"]')
  const createBtn = el.querySelector('[data-testid="user-create"]')

  // viewer 只读：禁用新建入口并以 title 提示（vanilla 同款）
  if (!canMutate()) {
    createBtn.setAttribute('disabled', '')
    createBtn.setAttribute('title', t('common.noPerm'))
    createBtn.setAttribute('aria-disabled', 'true')
  }

  function roleName(target) {
    if (target.roleId != null) {
      const r = state.roleMap.get(target.roleId)
      if (r) return r.name
    }
    return roleLabel(target.role)
  }

  function toDisplay(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: roleName(row),
      status: statusLabel(row.status),
      created: row.created,
    }
  }

  function filtered() {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (kw && !(r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)))
        return false
      return true
    })
  }

  function setEmpty(empty) {
    if (empty) {
      table.setAttribute('data', '[]')
      table.classList.add('table-hidden')
      emptyOverlay.hidden = false
      tableWrap.classList.add('is-empty')
    } else {
      table.classList.remove('table-hidden')
      emptyOverlay.hidden = true
      tableWrap.classList.remove('is-empty')
    }
  }

  function renderTable() {
    const list = filtered()
    table.columns = COLUMNS(state.roles.map((r) => ({ label: r.name, value: r.name })))
    if (list.length === 0) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    table.setAttribute('data', JSON.stringify(list.map(toDisplay)))
  }

  async function refresh() {
    table.setAttribute('loading', '')
    const [rows, roles, menuTree] = await Promise.all([listUsers(), listRoles(), treeMenus()])
    // stale 守卫：等待期间导航离开后 el 已脱离文档，不再续写
    if (!el.isConnected) return
    state.rows = rows
    state.roles = roles
    state.roleMap = new Map(roles.map((r) => [r.id, r]))
    state.menuTree = menuTree
    fieldRole.setAttribute(
      'options',
      JSON.stringify(roles.map((r) => ({ label: r.name, value: String(r.id) }))),
    )
    table.removeAttribute('loading')
    renderTable()
  }

  function openModal(target) {
    target.setAttribute('visible', '')
  }
  function closeModal(target) {
    target.removeAttribute('visible')
  }

  function fillForm(row) {
    el.querySelector('[data-testid="field-name"]').setAttribute('value', row?.name ?? '')
    el.querySelector('[data-testid="field-email"]').setAttribute('value', row?.email ?? '')
    fieldRole.setAttribute(
      'value',
      row?.roleId != null ? String(row.roleId) : String(state.roles[0]?.id ?? ''),
    )
    el.querySelector('[data-testid="field-status"]').setAttribute('value', row?.status ?? 'active')
    el.querySelector('#form-title').textContent = row
      ? t('users.editUser').replace('#{id}', String(row.id))
      : t('users.new')
  }

  createBtn.addEventListener('click', () => {
    if (!canMutate()) return
    state.editingId = null
    fillForm(null)
    openModal(formModal)
  })

  table.addEventListener('click', (e) => {
    const btn = fromPath(e.composedPath(), '.user-row-edit')
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    const row = state.rows.find((r) => r.id === id)
    if (!row) return
    if (!canMutate()) {
      OASUI.message.error(t('common.noPerm'))
      return
    }
    state.editingId = id
    fillForm(row)
    openModal(formModal)
  })

  // 行点击 → 详情弹窗（行内编辑按钮会连带派发 oas-row-click，vanilla 同款边界）
  table.addEventListener('oas-row-click', (e) => {
    const row = e.detail?.row
    const target = state.rows.find((r) => r.id === Number(row.id))
    if (!target) return
    fillDetail(el, target, { state, openModal, canMutate })
  })

  el.querySelector('[data-testid="detail-edit"]').addEventListener('click', () => {
    const target = state.rows.find((r) => r.id === state.editingId)
    if (!target) return
    closeModal(detailModal)
    fillForm(target)
    openModal(formModal)
  })

  el.querySelector('#delete-popconfirm').addEventListener('oas-ok', async () => {
    if (state.editingId == null) return
    if (!canMutate()) {
      OASUI.message.error(t('common.noPerm'))
      return
    }
    await removeUser(state.editingId)
    state.editingId = null
    closeModal(detailModal)
    OASUI.message.success(t('common.deleted'))
    await refresh()
  })

  el.querySelector('[data-testid="form-cancel"]').addEventListener('click', () =>
    closeModal(formModal),
  )

  el.querySelector('[data-testid="form-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = e.detail.values
      const roleId = values.roleId ? Number(values.roleId) : null
      const roleRow = roleId != null ? state.roleMap.get(roleId) : undefined
      const role = roleEnumFor(roleRow)
      if (state.editingId == null) {
        await createUser({
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status || 'active',
        })
        OASUI.message.success(t('common.created'))
      } else {
        const updated = await updateUser(state.editingId, {
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status,
        })
        if (!updated) {
          OASUI.message.error(t('users.notFound'))
        } else {
          OASUI.message.success(t('common.saved'))
        }
      }
      closeModal(formModal)
      await refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = e.detail.value
    table.setAttribute('current', '1')
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    table.setAttribute('current', '1')
    renderTable()
  })

  el.querySelector('#clear-filters').addEventListener('click', () => {
    state.keyword = ''
    table.setAttribute('current', '1')
    table.removeAttribute('filter-values')
    search.setAttribute('value', '')
    renderTable()
  })

  el.querySelector('#users-refresh').addEventListener('click', () => {
    void refresh()
  })

  function refreshText() {
    el.querySelector('h1.page-title').textContent = t('users.title')
    el.querySelector('p.page-subtitle').textContent = t('users.subtitle')
    el.querySelector('[data-testid="user-create"]').textContent = t('users.new')
    el.querySelector('oas-card.list-card').setAttribute('title', t('users.list'))
    search.setAttribute('placeholder', t('users.search'))
    el.querySelector('#users-refresh').setAttribute('title', t('common.refresh'))
    el.querySelector('#empty-overlay oas-empty').setAttribute('description', t('users.empty'))
    el.querySelector('#clear-filters').textContent = t('common.clearFilter')
    // 表单弹窗（标题随新建/编辑态；占位/选项/规则/按钮文案刷新）
    const titleEl = el.querySelector('#form-title')
    if (titleEl)
      titleEl.textContent =
        state.editingId == null
          ? t('users.new')
          : t('users.editUser').replace('#{id}', String(state.editingId))
    el.querySelector('[data-testid="field-name"]').setAttribute('placeholder', t('users.name'))
    el.querySelector('[data-testid="field-email"]').setAttribute('placeholder', t('users.email'))
    el.querySelector('[data-testid="field-status"]').setAttribute(
      'options',
      JSON.stringify([
        { label: statusLabel('active'), value: 'active' },
        { label: statusLabel('disabled'), value: 'disabled' },
      ]),
    )
    el.querySelector('#user-form').setAttribute('rules', RULES())
    el.querySelector('[data-testid="form-cancel"]').textContent = t('common.cancel')
    el.querySelector('[data-testid="form-save"]').textContent = t('common.save')
    // 详情弹窗静态文案
    el.querySelector('.detail-perms-title').textContent = t('users.perm')
    el.querySelector('[data-testid="detail-edit"]').textContent = t('common.edit')
    el.querySelector('[data-testid="detail-delete"]').textContent = t('common.delete')
    el.querySelector('#delete-popconfirm').setAttribute('title', t('users.confirmDelete'))
    // 表格：列定义（t 文案）+ 行数据标签（statusLabel）随语言重建；分页/筛选/搜索状态不动
    renderTable()
  }

  void refresh()
  return onLocaleChange(refreshText)
}
