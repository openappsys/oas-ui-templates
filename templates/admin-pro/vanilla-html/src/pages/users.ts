import { message } from '@oas-ui/ui/feedback/message'
import { createUser, listUsers, removeUser, updateUser } from '../data/users'
import type { UserRow, UserRole, UserStatus } from '../data/users'

const PAGE_SIZE = 5
const ROLE_LABEL: Record<UserRole, string> = { admin: '管理员', editor: '编辑', viewer: '访客' }
const STATUS_LABEL: Record<UserStatus, string> = { active: '启用', disabled: '禁用' }

const COLUMNS =
  '[{"key":"id","title":"ID","width":"60px"},{"key":"name","title":"姓名"},{"key":"email","title":"邮箱"},{"key":"role","title":"角色"},{"key":"status","title":"状态"},{"key":"created","title":"创建日期","sortable":true}]'

const RULES =
  '{"name":[{"required":true,"message":"请输入姓名"}],"email":[{"required":true,"message":"请输入邮箱"},{"pattern":"^\\\\S+@\\\\S+$","message":"邮箱格式不正确"}]}'

interface PageState {
  rows: UserRow[]
  keyword: string
  page: number
  editingId: number | null
}

export function render(el: HTMLElement): () => void {
  const state: PageState = { rows: [], keyword: '', page: 1, editingId: null }
  let saving = false

  el.innerHTML = `
    <div class="page">
      <div class="table-toolbar">
        <h1 class="page-title">用户管理</h1>
        <div class="toolbar-actions">
          <oas-input data-testid="user-search" placeholder="搜索姓名 / 邮箱" clearable></oas-input>
          <oas-button data-testid="user-create" type="primary">新建用户</oas-button>
        </div>
      </div>
      <oas-table data-testid="users-table" row-key="id" columns='${COLUMNS}' data="[]"></oas-table>
      <oas-pagination data-testid="users-pager" total="0" page-size="${PAGE_SIZE}" current="1" show-total></oas-pagination>

      <oas-modal data-testid="user-form-modal" no-footer>
        <div class="modal-body">
          <h2 id="form-title">新建用户</h2>
          <oas-form id="user-form" rules='${RULES}'>
            <oas-space direction="vertical" style="width: 100%">
              <oas-input data-testid="field-name" name="name" placeholder="姓名"></oas-input>
              <oas-input data-testid="field-email" name="email" placeholder="邮箱"></oas-input>
              <oas-select data-testid="field-role" name="role" options='[{"label":"管理员","value":"admin"},{"label":"编辑","value":"editor"},{"label":"访客","value":"viewer"}]'></oas-select>
              <oas-select data-testid="field-status" name="status" options='[{"label":"启用","value":"active"},{"label":"禁用","value":"disabled"}]'></oas-select>
              <oas-space>
                <oas-button data-testid="form-cancel">取消</oas-button>
                <oas-button data-testid="form-save" type="primary">保存</oas-button>
              </oas-space>
            </oas-space>
          </oas-form>
        </div>
      </oas-modal>

      <oas-modal data-testid="user-detail-modal" no-footer>
        <div class="modal-body">
          <h2>用户详情</h2>
          <oas-descriptions id="detail-desc" column="1"></oas-descriptions>
          <oas-space>
            <oas-button data-testid="detail-edit">编辑</oas-button>
            <oas-button data-testid="detail-delete" type="danger">删除</oas-button>
          </oas-space>
        </div>
      </oas-modal>
    </div>`

  const table = el.querySelector<HTMLElement>('[data-testid="users-table"]')!
  const pager = el.querySelector<HTMLElement>('[data-testid="users-pager"]')!
  const search = el.querySelector<HTMLElement>('[data-testid="user-search"]')!
  const formModal = el.querySelector<HTMLElement>('[data-testid="user-form-modal"]')!
  const detailModal = el.querySelector<HTMLElement>('[data-testid="user-detail-modal"]')!
  const form = el.querySelector<HTMLElement>('#user-form')!

  function toDisplay(row: UserRow) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: ROLE_LABEL[row.role],
      status: STATUS_LABEL[row.status],
      created: row.created,
    }
  }

  function filtered(): UserRow[] {
    const kw = state.keyword.trim().toLowerCase()
    if (!kw) return state.rows
    return state.rows.filter(
      (r) => r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw),
    )
  }

  function renderTable(): void {
    const list = filtered()
    const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    if (state.page > maxPage) state.page = maxPage
    const slice = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE)
    table.setAttribute('data', JSON.stringify(slice.map(toDisplay)))
    pager.setAttribute('total', String(list.length))
    pager.setAttribute('current', String(state.page))
  }

  async function refresh(): Promise<void> {
    table.setAttribute('loading', '')
    state.rows = await listUsers()
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
    el.querySelector<HTMLElement>('[data-testid="field-role"]')!.setAttribute(
      'value',
      row?.role ?? 'viewer',
    )
    el.querySelector<HTMLElement>('[data-testid="field-status"]')!.setAttribute(
      'value',
      row?.status ?? 'active',
    )
    el.querySelector<HTMLElement>('#form-title')!.textContent = row
      ? `编辑用户 #${row.id}`
      : '新建用户'
  }

  el.querySelector('[data-testid="user-create"]')!.addEventListener('click', () => {
    state.editingId = null
    fillForm(null)
    openModal(formModal)
  })

  table.addEventListener('oas-row-click', (e) => {
    const row = (e as CustomEvent<{ row: Record<string, unknown> }>).detail.row
    const id = Number(row.id)
    const target = state.rows.find((r) => r.id === id)
    if (!target) return
    const desc = el.querySelector<HTMLElement>('#detail-desc')!
    desc.innerHTML = `
      <oas-descriptions-item label="ID"><span id="detail-id"></span></oas-descriptions-item>
      <oas-descriptions-item label="姓名"><span id="detail-name"></span></oas-descriptions-item>
      <oas-descriptions-item label="邮箱"><span id="detail-email"></span></oas-descriptions-item>
      <oas-descriptions-item label="角色"><span id="detail-role"></span></oas-descriptions-item>
      <oas-descriptions-item label="状态"><span id="detail-status"></span></oas-descriptions-item>
      <oas-descriptions-item label="创建日期"><span id="detail-created"></span></oas-descriptions-item>`
    const text = (sel: string, v: string) => {
      desc.querySelector<HTMLElement>(sel)!.textContent = v
    }
    text('#detail-id', String(target.id))
    text('#detail-name', target.name)
    text('#detail-email', target.email)
    text('#detail-role', ROLE_LABEL[target.role])
    text('#detail-status', STATUS_LABEL[target.status])
    text('#detail-created', target.created)
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

  el.querySelector('[data-testid="detail-delete"]')!.addEventListener('click', async () => {
    if (state.editingId == null) return
    await removeUser(state.editingId)
    state.editingId = null
    closeModal(detailModal)
    message.success('已删除')
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
          values: { name: string; email: string; role: UserRole; status: UserStatus }
        }>
      ).detail.values
      if (state.editingId == null) {
        await createUser({
          name: values.name,
          email: values.email,
          role: values.role || 'viewer',
          status: values.status || 'active',
        })
        message.success('已创建')
      } else {
        await updateUser(state.editingId, {
          name: values.name,
          email: values.email,
          role: values.role,
          status: values.status,
        })
        message.success('已保存')
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

  pager.addEventListener('oas-change', (e) => {
    state.page = (e as CustomEvent<{ page: number }>).detail.page
    renderTable()
  })

  void refresh()
  return () => {}
}
