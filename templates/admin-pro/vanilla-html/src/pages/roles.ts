import { message } from '@oas-ui/ui/feedback/message'
import { createRole, listRoles, removeRole, treeDepts, updateRole } from '../data/system'
import type { DataScope, DeptTree, RoleRow } from '../data/system'

const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  1: '全部',
  2: '自定义',
  3: '本部门',
  4: '本部门及以下',
  5: '仅本人',
}

const DATA_SCOPE_TAG: Record<DataScope, string> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'info',
  5: 'default',
}

const DATA_SCOPE_OPTIONS: Array<{ value: DataScope; label: string; desc: string }> = [
  { value: 1, label: '全部数据', desc: '可访问系统内全部数据' },
  { value: 2, label: '自定义数据', desc: '手动勾选可见的部门数据' },
  { value: 3, label: '本部门数据', desc: '仅本部门成员的数据' },
  { value: 4, label: '本部门及以下', desc: '本部门及所有子部门的数据' },
  { value: 5, label: '仅本人数据', desc: '仅本人创建的数据' },
]

const RULES =
  '{"name":[{"required":true,"message":"请输入角色名"}],"code":[{"required":true,"message":"请输入角色标识"},{"pattern":"^[a-z][a-z0-9:_-]*$","message":"标识需以小写字母开头，仅含小写字母/数字/冒号/下划线/连字符"}]}'

interface PageState {
  roles: RoleRow[]
  deptList: DeptTree[]
  editingId: number | null
  dataScope: DataScope
  deptIds: number[]
}

function flatten(roots: DeptTree[]): DeptTree[] {
  const out: DeptTree[] = []
  const walk = (nodes: DeptTree[]) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return out
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    roles: [],
    deptList: [],
    editingId: null,
    dataScope: 1,
    deptIds: [],
  }
  let saving = false

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">角色管理</h1>
          <p class="page-subtitle">维护角色及其数据权限范围</p>
        </div>
        <oas-button data-testid="role-create" type="primary" icon="plus">新建角色</oas-button>
      </div>
      <oas-card class="list-card" title="角色列表">
        <div class="table-wrap" id="roles-wrap">
          <table class="roles-table" data-testid="roles-table">
            <thead>
              <tr>
                <th>角色名</th>
                <th>标识</th>
                <th>数据范围</th>
                <th class="num">用户数</th>
                <th>创建日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="roles-body"></tbody>
          </table>
        </div>
      </oas-card>

      <oas-drawer data-testid="role-form-drawer" id="role-form-drawer" title="新建角色" placement="right" size="medium" no-footer>
        <oas-form id="role-form" rules='${RULES}'>
          <div class="role-form-body">
            <div class="form-field">
              <label class="form-label">角色名 <span class="req">*</span></label>
              <oas-input data-testid="rf-name" name="name" placeholder="请输入角色名"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">标识 <span class="req">*</span></label>
              <oas-input data-testid="rf-code" name="code" placeholder="如 ops_manager"></oas-input>
              <div class="form-hint">小写字母开头，可含数字、下划线、冒号、连字符</div>
            </div>
            <div class="form-field">
              <label class="form-label">数据范围</label>
              <div class="radio-group" id="rf-scope">
                ${DATA_SCOPE_OPTIONS.map(
                  (o) =>
                    `<oas-radio name="dataScope" value="${o.value}"><span class="radio-item"><span class="radio-label">${o.label}</span><span class="radio-desc">${o.desc}</span></span></oas-radio>`,
                ).join('')}
              </div>
            </div>
            <div class="form-field" id="rf-custom" hidden>
              <label class="form-label">自定义数据范围（部门）</label>
              <oas-transfer data-testid="rf-transfer" id="rf-transfer" source-title="全部部门" target-title="已选部门" searchable data="[]" value="[]"></oas-transfer>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="rf-cancel">取消</oas-button>
                <oas-button data-testid="rf-save" type="primary">保存</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>`

  const tbody = el.querySelector<HTMLElement>('#roles-body')!
  const drawer = el.querySelector<HTMLElement>('[data-testid="role-form-drawer"]')!
  const form = el.querySelector<HTMLElement>('#role-form')!
  const scopeGroup = el.querySelector<HTMLElement>('#rf-scope')!
  const customField = el.querySelector<HTMLElement>('#rf-custom')!
  const transfer = el.querySelector<HTMLElement>('[data-testid="rf-transfer"]')!

  function setRadioChecked(scope: DataScope): void {
    scopeGroup.querySelectorAll<HTMLElement>('oas-radio').forEach((radio) => {
      if (Number(radio.getAttribute('value')) === scope) radio.setAttribute('checked', '')
      else radio.removeAttribute('checked')
    })
  }

  function fillForm(row: RoleRow | null): void {
    el.querySelector<HTMLElement>('[data-testid="rf-name"]')!.setAttribute('value', row?.name ?? '')
    el.querySelector<HTMLElement>('[data-testid="rf-code"]')!.setAttribute('value', row?.code ?? '')
    state.dataScope = (row?.dataScope ?? 1) as DataScope
    state.deptIds = row?.dataScope === 2 ? [...row.deptIds] : []
    setRadioChecked(state.dataScope)
    transfer.setAttribute('value', JSON.stringify(state.deptIds.map(String)))
    customField.hidden = state.dataScope !== 2
    drawer.setAttribute('title', row ? `编辑角色 #${row.id}` : '新建角色')
  }

  function openForm(row: RoleRow | null): void {
    state.editingId = row?.id ?? null
    fillForm(row)
    drawer.setAttribute('visible', '')
  }

  function renderTable(): void {
    if (state.roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="roles-empty"><oas-empty description="暂无角色"></oas-empty></td></tr>`
      return
    }
    tbody.innerHTML = state.roles
      .map(
        (r) => `<tr data-id="${r.id}">
          <td class="name-cell">${r.name}</td>
          <td><span class="mono code-cell">${r.code}</span></td>
          <td><oas-tag type="${DATA_SCOPE_TAG[r.dataScope]}">${DATA_SCOPE_LABEL[r.dataScope]}</oas-tag></td>
          <td class="num-cell mono">${r.userCount}</td>
          <td><span class="mono date-cell">${r.created}</span></td>
          <td class="action-cell">
            <oas-button size="small" type="text" data-edit="${r.id}">编辑</oas-button>
            <oas-popconfirm title="确认删除该角色？" data-del="${r.id}">
              <oas-button size="small" type="danger">删除</oas-button>
            </oas-popconfirm>
          </td>
        </tr>`,
      )
      .join('')
    tbody.querySelectorAll<HTMLElement>('oas-button[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-edit'))
        const row = state.roles.find((r) => r.id === id)
        if (row) openForm(row)
      })
    })
    tbody.querySelectorAll<HTMLElement>('oas-popconfirm[data-del]').forEach((pc) => {
      pc.addEventListener('oas-ok', () => {
        const id = Number(pc.getAttribute('data-del'))
        void removeRole(id).then((ok) => {
          if (!ok) message.error('该角色已不存在')
          else message.success('已删除')
          void refresh()
        })
      })
    })
  }

  async function refresh(): Promise<void> {
    const [rows, deptTree] = await Promise.all([listRoles(), treeDepts()])
    state.roles = rows
    state.deptList = flatten(deptTree)
    transfer.setAttribute(
      'data',
      JSON.stringify(state.deptList.map((d) => ({ key: String(d.id), label: d.name }))),
    )
    renderTable()
  }

  el.querySelector<HTMLElement>('[data-testid="role-create"]')!.addEventListener('click', () => {
    openForm(null)
  })

  el.querySelector<HTMLElement>('[data-testid="rf-cancel"]')!.addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector<HTMLElement>('[data-testid="rf-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  scopeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return
    const val = Number(radio.getAttribute('value'))
    if (!Number.isFinite(val)) return
    state.dataScope = val as DataScope
    if (state.dataScope === 2) {
      customField.hidden = false
    } else {
      state.deptIds = []
      customField.hidden = true
    }
  })

  transfer.addEventListener('oas-change', (e) => {
    state.deptIds = (e as CustomEvent<{ value: string[] }>).detail.value.map(Number)
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    const values = (e as CustomEvent<{ values: { name: string; code: string } }>).detail.values
    const name = values.name?.trim()
    const code = values.code?.trim()
    if (!name || !code) return
    saving = true
    try {
      const deptIds = state.dataScope === 2 ? state.deptIds : []
      if (state.editingId == null) {
        await createRole({ name, code, dataScope: state.dataScope, deptIds, userCount: 0 })
        message.success('已创建')
      } else {
        const updated = await updateRole(state.editingId, {
          name,
          code,
          dataScope: state.dataScope,
          deptIds,
        })
        if (!updated) message.error('该角色已不存在')
        else message.success('已保存')
      }
      drawer.removeAttribute('visible')
      void refresh()
    } finally {
      saving = false
    }
  })

  void refresh()
  return () => {}
}
