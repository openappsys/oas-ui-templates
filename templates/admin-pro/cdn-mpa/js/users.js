// 用户管理页脚本（自 vanilla src/pages/users.ts 去 TS 移植，MPA 适配版）
// 差异：无 onLocaleChange 订阅（MPA 切语言 = reload）；数据层走 js/data/ 同名模块；
// 详情弹窗域拆分至 users-detail.js（对齐 react user-detail.tsx 拆分）
import { guard, readSession } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t } from './i18n.js'
import { createUser, listUsers, removeUser, updateUser } from './data/users.js'
import { listRoles, treeMenus } from './data/system.js'
import { renderDetail } from './users-detail.js'

// 每页条数跟随设置中心（settings 页 page-size，默认 5，vanilla users 同默认）
function pageSize() {
  const raw = localStorage.getItem('oas-admin-cdn-mpa.settings.page-size')
  const n = raw ? Number(raw) : 0
  return n > 0 ? n : 5
}

function roleLabel(role) {
  return t(`users.role.${role}`)
}

function statusLabel(status) {
  return t(`users.status.${status}`)
}

// 行内编辑按钮（class/data-testid/data-id 逐字对齐 vanilla cellAction）
function cellAction(row) {
  const edit = document.createElement('oas-button')
  edit.className = 'user-row-edit'
  edit.setAttribute('data-testid', 'user-row-edit')
  edit.setAttribute('data-id', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('icon', 'edit')
  edit.setAttribute('aria-label', t('common.edit'))
  return edit
}

function fromPath(path, selector) {
  for (const item of path) {
    if (item instanceof HTMLElement && item.matches(selector)) return item
  }
  return null
}

// 按角色 code 映射 UserRole 枚举（vanilla roleEnumFor 逐字对齐）
function roleEnumFor(roleRow) {
  if (!roleRow) return 'viewer'
  if (roleRow.code === 'super_admin') return 'admin'
  if (roleRow.code === 'viewer') return 'viewer'
  return 'editor'
}

// mpa 会话暂无角色字段（session.js 仅存 name/loginAt），与 orders.js 同款约定：
// 分支保留（登录态一旦带 role=viewer 即整体只读），当前演示恒为可编辑
function canMutate() {
  return readSession()?.role !== 'viewer'
}

function columns(roleFilters) {
  return [
    { key: 'id', title: 'ID', width: '60px' },
    { key: 'name', title: t('users.name') },
    { key: 'email', title: t('users.email') },
    { key: 'role', title: t('users.role'), filterable: true, filters: roleFilters },
    {
      key: 'status',
      title: t('users.status'),
      filterable: true,
      filters: [
        { label: statusLabel('active'), value: statusLabel('active') },
        { label: statusLabel('disabled'), value: statusLabel('disabled') },
      ],
    },
    { key: 'created', title: t('users.created'), sortable: true },
    {
      key: 'action',
      title: t('users.th.action'),
      width: '80px',
      render: (r) => cellAction(r),
    },
  ]
}

function rulesJSON() {
  return JSON.stringify({
    name: [{ required: true, message: t('users.rule.name') }],
    email: [
      { required: true, message: t('users.rule.email') },
      { pattern: '^\\S+@\\S+$', message: t('users.rule.emailFmt') },
    ],
  })
}

if (guard()) boot()

function boot() {
  document.title = `${t('users.title')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './users.html' })
  renderUsers()
}

function renderUsers() {
  const state = {
    rows: [],
    roles: [],
    roleMap: new Map(),
    menuTree: [],
    keyword: '',
    editingId: null,
  }
  let saving = false

  const table = document.querySelector('[data-testid="users-table"]')
  const search = document.querySelector('[data-testid="user-search"]')
  const formModal = document.querySelector('[data-testid="user-form-modal"]')
  const detailModal = document.querySelector('[data-testid="user-detail-modal"]')
  const form = document.querySelector('#user-form')
  const tableWrap = document.querySelector('#table-wrap')
  const emptyOverlay = document.querySelector('#empty-overlay')
  const fieldRole = document.querySelector('[data-testid="field-role"]')
  const fieldStatus = document.querySelector('[data-testid="field-status"]')
  const createBtn = document.querySelector('[data-testid="user-create"]')

  table.setAttribute('page-size', String(pageSize()))
  form.setAttribute('rules', rulesJSON())
  fieldStatus.setAttribute(
    'options',
    JSON.stringify([
      { label: statusLabel('active'), value: 'active' },
      { label: statusLabel('disabled'), value: 'disabled' },
    ]),
  )

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
    table.columns = columns(state.roles.map((r) => ({ label: r.name, value: r.name })))
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
    document.querySelector('[data-testid="field-name"]').setAttribute('value', row?.name ?? '')
    document.querySelector('[data-testid="field-email"]').setAttribute('value', row?.email ?? '')
    fieldRole.setAttribute(
      'value',
      row?.roleId != null ? String(row.roleId) : String(state.roles[0]?.id ?? ''),
    )
    fieldStatus.setAttribute('value', row?.status ?? 'active')
    document.querySelector('#form-title').textContent = row
      ? t('users.editUser').replace('#{id}', String(row.id))
      : t('users.new')
  }

  // 菜单树「用户管理」下 F 类按钮节点的权限标识 + 对照渲染在 users-detail.js（detail 域）

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

  // 行点击 → 详情弹窗（头像 + descriptions + 权限标识对照；填充逻辑在 users-detail.js）
  table.addEventListener('oas-row-click', (e) => {
    const row = e.detail?.row
    const id = Number(row?.id)
    const target = state.rows.find((r) => r.id === id)
    if (!target) return
    renderDetail(target, { roleName, canMutate, menuTree: state.menuTree })
    state.editingId = target.id
    openModal(detailModal)
  })

  document.querySelector('[data-testid="detail-edit"]').addEventListener('click', () => {
    const target = state.rows.find((r) => r.id === state.editingId)
    if (!target) return
    closeModal(detailModal)
    fillForm(target)
    openModal(formModal)
  })

  document.querySelector('#delete-popconfirm').addEventListener('oas-ok', async () => {
    if (state.editingId == null) return
    if (!canMutate()) {
      OASUI.message.error(t('common.noPerm'))
      return
    }
    await removeUser(state.editingId)
    state.editingId = null
    closeModal(detailModal)
    OASUI.message.success(t('common.deleted'))
    void refresh()
  })

  document.querySelector('[data-testid="form-cancel"]').addEventListener('click', () =>
    closeModal(formModal),
  )

  document.querySelector('[data-testid="form-save"]').addEventListener('click', () => {
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
      void refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = e.detail.value ?? ''
    table.setAttribute('current', '1')
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    table.setAttribute('current', '1')
    renderTable()
  })

  document.querySelector('#clear-filters').addEventListener('click', () => {
    state.keyword = ''
    table.setAttribute('current', '1')
    table.removeAttribute('filter-values')
    search.setAttribute('value', '')
    renderTable()
  })

  document.querySelector('#users-refresh').addEventListener('click', () => {
    void refresh()
  })

  void refresh()
}
