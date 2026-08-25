import { message } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'
import { createUser, listUsers, removeUser, updateUser } from '../data/users'
import type { UserRow, UserRole, UserStatus } from '../data/users'
import { listRoles, treeMenus } from '../data/system'
import type { MenuTree, RoleRow } from '../data/system'
import { session } from '../store/session'

const PAGE_SIZE = 5
const ALLOWED: Record<UserRole, string[]> = {
  admin: ['user:list', 'user:add', 'user:edit', 'user:delete'],
  editor: ['user:list', 'user:add', 'user:edit'],
  viewer: ['user:list'],
}

function roleLabel(role: UserRole): string {
  return t(`users.role.${role}`)
}

function statusLabel(status: UserStatus): string {
  return t(`users.status.${status}`)
}

const COLUMNS = () =>
  JSON.stringify([
    { key: 'id', title: 'ID', width: '60px' },
    { key: 'name', title: t('users.name') },
    { key: 'email', title: t('users.email') },
    { key: 'role', title: t('users.role') },
    { key: 'status', title: t('users.status') },
    { key: 'created', title: t('users.created'), sortable: true },
  ])

const RULES = () =>
  JSON.stringify({
    name: [{ required: true, message: t('users.rule.name') }],
    email: [
      { required: true, message: t('users.rule.email') },
      { pattern: '^\\S+@\\S+$', message: t('users.rule.emailFmt') },
    ],
  })

const STATUS_OPTIONS = () => [
  { label: t('users.allStatus'), value: '' },
  { label: statusLabel('active'), value: 'active' },
  { label: statusLabel('disabled'), value: 'disabled' },
]

interface PageState {
  rows: UserRow[]
  roles: RoleRow[]
  roleMap: Map<number, RoleRow>
  menuTree: MenuTree[]
  keyword: string
  page: number
  editingId: number | null
  roleFilter: number | ''
  statusFilter: UserStatus | ''
}

function findMenu(nodes: MenuTree[], title: string): MenuTree | null {
  for (const n of nodes) {
    if (n.title === title && n.type === 'C') return n
    if (n.children?.length) {
      const f = findMenu(n.children, title)
      if (f) return f
    }
  }
  return null
}

function roleEnumFor(roleRow: RoleRow | undefined): UserRole {
  if (!roleRow) return 'viewer'
  if (roleRow.code === 'super_admin') return 'admin'
  if (roleRow.code === 'viewer') return 'viewer'
  return 'editor'
}

function canMutate(): boolean {
  return session.user?.role !== 'viewer'
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    rows: [],
    roles: [],
    roleMap: new Map(),
    menuTree: [],
    keyword: '',
    page: 1,
    editingId: null,
    roleFilter: '',
    statusFilter: '',
  }
  let saving = false

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
          <oas-select data-testid="role-filter" placeholder="${t('users.role')}" options="[]" value=""></oas-select>
          <oas-select data-testid="status-filter" placeholder="${t('users.status')}" options='${JSON.stringify(STATUS_OPTIONS())}' value=""></oas-select>
          <oas-button id="users-refresh" icon="refresh" title="${t('common.refresh')}"></oas-button>
        </div>
        <div class="table-wrap" id="table-wrap">
          <oas-table data-testid="users-table" row-key="id" columns='${COLUMNS()}' data="[]"></oas-table>
          <div class="empty-overlay" id="empty-overlay" hidden>
            <oas-empty description="${t('users.empty')}"></oas-empty>
            <oas-button id="clear-filters" type="primary">${t('common.clearFilter')}</oas-button>
          </div>
        </div>
        <oas-pagination data-testid="users-pager" total="0" page-size="${PAGE_SIZE}" current="1" show-total></oas-pagination>
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

      <oas-modal data-testid="user-detail-modal" no-footer>
        <div class="modal-body">
          <div class="detail-header">
            <oas-avatar id="detail-avatar" size="48"><span slot="fallback" id="detail-avatar-text"></span></oas-avatar>
            <div>
              <div id="detail-name" class="detail-name"></div>
              <oas-tag id="detail-role-tag" type="primary"></oas-tag>
            </div>
          </div>
          <oas-descriptions id="detail-desc" column="1"></oas-descriptions>
          <oas-divider></oas-divider>
          <div class="detail-perms-title form-label">${t('users.perm')}</div>
          <div id="detail-perms-list" class="detail-perms-list"></div>
          <oas-space justify="end">
            <oas-button data-testid="detail-edit" type="primary">${t('common.edit')}</oas-button>
            <oas-popconfirm title="${t('users.confirmDelete')}" id="delete-popconfirm">
              <oas-button data-testid="detail-delete" type="danger">${t('common.delete')}</oas-button>
            </oas-popconfirm>
          </oas-space>
        </div>
      </oas-modal>
    </div>`

  const table = el.querySelector<HTMLElement>('[data-testid="users-table"]')!
  const pager = el.querySelector<HTMLElement>('[data-testid="users-pager"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="user-search"]')!
  const roleFilter = el.querySelector<HTMLElement>('[data-testid="role-filter"]')!
  const statusFilter = el.querySelector<HTMLElement>('[data-testid="status-filter"]')!
  const formModal = el.querySelector<HTMLElement>('[data-testid="user-form-modal"]')!
  const detailModal = el.querySelector<HTMLElement>('[data-testid="user-detail-modal"]')!
  const form = el.querySelector<HTMLElement>('#user-form')!
  const tableWrap = el.querySelector<HTMLElement>('#table-wrap')!
  const emptyOverlay = el.querySelector<HTMLElement>('#empty-overlay')!
  const fieldRole = el.querySelector<HTMLElement>('[data-testid="field-role"]')!
  const createBtn = el.querySelector<HTMLElement>('[data-testid="user-create"]')!

  if (!canMutate()) {
    createBtn.setAttribute('disabled', '')
    createBtn.setAttribute('title', t('common.noPerm'))
    createBtn.setAttribute('aria-disabled', 'true')
  }

  function roleName(target: UserRow): string {
    if (target.roleId != null) {
      const r = state.roleMap.get(target.roleId)
      if (r) return r.name
    }
    return roleLabel(target.role)
  }

  function toDisplay(row: UserRow) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: roleName(row),
      status: statusLabel(row.status),
      created: row.created,
    }
  }

  function filtered(): UserRow[] {
    const kw = state.keyword.trim().toLowerCase()
    return state.rows.filter((r) => {
      if (kw && !(r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)))
        return false
      if (state.roleFilter !== '' && r.roleId !== state.roleFilter) return false
      if (state.statusFilter && r.status !== state.statusFilter) return false
      return true
    })
  }

  function setEmpty(empty: boolean): void {
    if (empty) {
      table.setAttribute('data', '[]')
      table.classList.add('table-hidden')
      pager.classList.add('table-hidden')
      emptyOverlay.hidden = false
      tableWrap.classList.add('is-empty')
    } else {
      table.classList.remove('table-hidden')
      pager.classList.remove('table-hidden')
      emptyOverlay.hidden = true
      tableWrap.classList.remove('is-empty')
    }
  }

  function renderTable(): void {
    const list = filtered()
    if (list.length === 0) {
      pager.setAttribute('total', '0')
      pager.setAttribute('current', '1')
      setEmpty(true)
      return
    }
    setEmpty(false)
    const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
    table.setAttribute('data', JSON.stringify(slice.map(toDisplay)))
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
  }

  async function refresh(): Promise<void> {
    table.setAttribute('loading', '')
    const [rows, roles, menuTree] = await Promise.all([listUsers(), listRoles(), treeMenus()])
    state.rows = rows
    state.roles = roles
    state.roleMap = new Map(roles.map((r) => [r.id, r]))
    state.menuTree = menuTree
    roleFilter.setAttribute(
      'options',
      JSON.stringify([
        { label: t('users.allRole'), value: '' },
        ...roles.map((r) => ({ label: r.name, value: String(r.id) })),
      ]),
    )
    fieldRole.setAttribute(
      'options',
      JSON.stringify(roles.map((r) => ({ label: r.name, value: String(r.id) }))),
    )
    table.removeAttribute('loading')
    renderTable()
  }

  function openModal(target: HTMLElement): void {
    target.setAttribute('visible', '')
  }
  function closeModal(target: HTMLElement): void {
    target.removeAttribute('visible')
  }

  function fillForm(row: UserRow | null): void {
    el.querySelector<HTMLElement>('[data-testid="field-name"]')!.setAttribute(
      'value',
      row?.name ?? '',
    )
    el.querySelector<HTMLElement>('[data-testid="field-email"]')!.setAttribute(
      'value',
      row?.email ?? '',
    )
    fieldRole.setAttribute(
      'value',
      row?.roleId != null ? String(row.roleId) : String(state.roles[0]?.id ?? ''),
    )
    el.querySelector<HTMLElement>('[data-testid="field-status"]')!.setAttribute(
      'value',
      row?.status ?? 'active',
    )
    el.querySelector<HTMLElement>('#form-title')!.textContent = row
      ? t('users.editUser').replace('#{id}', String(row.id))
      : t('users.new')
  }

  function userPerms(): string[] {
    const node = findMenu(state.menuTree, '用户管理')
    if (!node) return []
    return (node.children ?? [])
      .filter((c) => c.type === 'F')
      .map((c) => c.perms ?? '')
      .filter(Boolean)
  }

  function renderPerms(role: UserRole): void {
    const listEl = el.querySelector<HTMLElement>('#detail-perms-list')!
    const perms = userPerms()
    if (perms.length === 0) {
      listEl.innerHTML = '<oas-tag type="default">' + t('users.nonePerm') + '</oas-tag>'
      return
    }
    const allowed = new Set(ALLOWED[role])
    listEl.innerHTML = perms
      .map(
        (p) =>
          `<oas-tag class="mono" type="${allowed.has(p) ? 'success' : 'default'}">${p}</oas-tag>`,
      )
      .join('')
  }

  function tagTypeForStatus(status: UserStatus): string {
    return status === 'active' ? 'success' : 'danger'
  }

  function tagTypeForRole(role: UserRole): string {
    if (role === 'admin') return 'primary'
    if (role === 'editor') return 'warning'
    return 'default'
  }

  createBtn.addEventListener('click', () => {
    if (!canMutate()) return
    state.editingId = null
    fillForm(null)
    openModal(formModal)
  })

  table.addEventListener('oas-row-click', (e) => {
    const row = (e as CustomEvent<{ row: Record<string, unknown> }>).detail.row
    const id = Number(row.id)
    const target = state.rows.find((r) => r.id === id)
    if (!target) return
    el.querySelector<HTMLElement>('#detail-avatar-text')!.textContent = target.name.charAt(0)
    el.querySelector<HTMLElement>('#detail-name')!.textContent = target.name
    const roleTag = el.querySelector<HTMLElement>('#detail-role-tag')!
    roleTag.textContent = roleName(target)
    roleTag.setAttribute(
      'type',
      target.roleId != null ? roleTagType(target) : tagTypeForRole(target.role),
    )
    const desc = el.querySelector<HTMLElement>('#detail-desc')!
    desc.innerHTML = `
      <oas-descriptions-item label="ID"><span id="detail-id"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.name')}"><span id="detail-name2"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.email')}"><span id="detail-email"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.role')}"><span id="detail-role"></span></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.status')}"><oas-tag id="detail-status-tag"></oas-tag></oas-descriptions-item>
      <oas-descriptions-item label="${t('users.created')}"><span id="detail-created"></span></oas-descriptions-item>`
    const text = (sel: string, v: string) => {
      desc.querySelector<HTMLElement>(sel)!.textContent = v
    }
    text('#detail-id', String(target.id))
    text('#detail-name2', target.name)
    text('#detail-email', target.email)
    text('#detail-role', roleName(target))
    const statusTag = desc.querySelector<HTMLElement>('#detail-status-tag')!
    statusTag.textContent = statusLabel(target.status)
    statusTag.setAttribute('type', tagTypeForStatus(target.status))
    text('#detail-created', target.created)
    renderPerms(target.role)
    const delBtn = el.querySelector<HTMLElement>('[data-testid="detail-delete"]')!
    if (!canMutate()) {
      delBtn.setAttribute('disabled', '')
      delBtn.setAttribute('title', t('common.noPerm'))
    } else {
      delBtn.removeAttribute('disabled')
      delBtn.removeAttribute('title')
    }
    state.editingId = target.id
    openModal(detailModal)
  })

  el.querySelector('[data-testid="detail-edit"]')!.addEventListener('click', () => {
    const target = state.rows.find((r) => r.id === state.editingId)
    if (!target) return
    closeModal(detailModal)
    fillForm(target)
    openModal(formModal)
  })

  el.querySelector<HTMLElement>('#delete-popconfirm')!.addEventListener('oas-ok', async () => {
    if (state.editingId == null) return
    if (!canMutate()) {
      message.error(t('common.noPerm'))
      return
    }
    await removeUser(state.editingId)
    state.editingId = null
    closeModal(detailModal)
    message.success(t('common.deleted'))
    void refresh()
  })

  el.querySelector('[data-testid="form-cancel"]')!.addEventListener('click', () =>
    closeModal(formModal),
  )

  el.querySelector('[data-testid="form-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = (
        e as CustomEvent<{
          values: { name: string; email: string; roleId: string; status: UserStatus }
        }>
      ).detail.values
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
        message.success(t('common.created'))
      } else {
        const updated = await updateUser(state.editingId, {
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status,
        })
        if (!updated) {
          message.error(t('users.notFound'))
        } else {
          message.success(t('common.saved'))
        }
      }
      closeModal(formModal)
      void refresh()
    } finally {
      saving = false
    }
  })

  search.addEventListener('oas-input', (e) => {
    state.keyword = (e as CustomEvent<{ value: string }>).detail.value
    state.page = 1
    renderTable()
  })
  search.addEventListener('oas-clear', () => {
    state.keyword = ''
    state.page = 1
    renderTable()
  })

  roleFilter.addEventListener('oas-change', (e) => {
    const v = (e as CustomEvent<{ value: string }>).detail.value
    state.roleFilter = v === '' ? '' : Number(v)
    state.page = 1
    renderTable()
  })

  statusFilter.addEventListener('oas-change', (e) => {
    state.statusFilter = (e as CustomEvent<{ value: string }>).detail.value as UserStatus | ''
    state.page = 1
    renderTable()
  })

  el.querySelector<HTMLElement>('#clear-filters')!.addEventListener('click', () => {
    state.keyword = ''
    state.roleFilter = ''
    state.statusFilter = ''
    state.page = 1
    search.setAttribute('value', '')
    roleFilter.setAttribute('value', '')
    statusFilter.setAttribute('value', '')
    renderTable()
  })

  el.querySelector<HTMLElement>('#users-refresh')!.addEventListener('click', () => {
    void refresh()
  })

  pager.addEventListener('oas-change', (e) => {
    state.page = (e as CustomEvent<{ page: number }>).detail.page
    renderTable()
  })

  void refresh()
  return () => {}
}

function roleTagType(target: UserRow): string {
  return target.roleId === 1 ? 'primary' : target.roleId === 4 ? 'default' : 'warning'
}
