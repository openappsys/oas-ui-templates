import { message } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'
import { createRole, listRoles, removeRole, treeDepts, updateRole } from '../data/system'
import type { DataScope, DeptTree, RoleRow } from '../data/system'

function dataScopeLabel(scope: DataScope): string {
  return t(`roles.scope.${scope}`)
}

const DATA_SCOPE_TAG: Record<DataScope, string> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'info',
  5: 'default',
}

const DATA_SCOPE_OPTIONS = (): Array<{ value: DataScope; label: string; desc: string }> => [
  { value: 1, label: t('roles.scopeOpt.1'), desc: t('roles.scopeDesc.1') },
  { value: 2, label: t('roles.scopeOpt.2'), desc: t('roles.scopeDesc.2') },
  { value: 3, label: t('roles.scopeOpt.3'), desc: t('roles.scopeDesc.3') },
  { value: 4, label: t('roles.scopeOpt.4'), desc: t('roles.scopeDesc.4') },
  { value: 5, label: t('roles.scopeOpt.5'), desc: t('roles.scopeDesc.5') },
]

const RULES = (): string =>
  JSON.stringify({
    name: [{ required: true, message: t('roles.rule.name') }],
    code: [
      { required: true, message: t('roles.rule.code') },
      { pattern: '^[a-z][a-z0-9:_-]*$', message: t('roles.rule.codeFmt') },
    ],
  })

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
          <h1 class="page-title">${t('nav.roles')}</h1>
          <p class="page-subtitle">${t('roles.subtitle')}</p>
        </div>
        <oas-button data-testid="role-create" type="primary" icon="plus">${t('roles.new')}</oas-button>
      </div>
      <oas-card class="list-card" title="${t('roles.list')}">
        <div class="table-wrap" id="roles-wrap">
          <table class="roles-table" data-testid="roles-table">
            <thead>
              <tr>
                <th>${t('roles.th.name')}</th>
                <th>${t('roles.th.code')}</th>
                <th>${t('roles.th.dataScope')}</th>
                <th class="num">${t('roles.th.userCount')}</th>
                <th>${t('roles.th.created')}</th>
                <th>${t('roles.th.action')}</th>
              </tr>
            </thead>
            <tbody id="roles-body"></tbody>
          </table>
        </div>
      </oas-card>

      <oas-drawer data-testid="role-form-drawer" id="role-form-drawer" title="${t('roles.new')}" placement="right" size="medium" no-footer>
        <oas-form id="role-form" rules='${RULES()}'>
          <div class="role-form-body">
            <div class="form-field">
              <label class="form-label">${t('roles.form.name')} <span class="req">*</span></label>
              <oas-input data-testid="rf-name" name="name" placeholder="${t('roles.rule.name')}"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">${t('roles.form.code')} <span class="req">*</span></label>
              <oas-input data-testid="rf-code" name="code" placeholder="${t('roles.placeholder.code')}"></oas-input>
              <div class="form-hint">${t('roles.hint.code')}</div>
            </div>
            <div class="form-field">
              <label class="form-label">${t('roles.form.dataScope')}</label>
              <div class="radio-group" id="rf-scope">
                ${DATA_SCOPE_OPTIONS().map(
                  (o) =>
                    `<oas-radio name="dataScope" value="${o.value}"><span class="radio-item"><span class="radio-label">${o.label}</span><span class="radio-desc">${o.desc}</span></span></oas-radio>`,
                ).join('')}
              </div>
            </div>
            <div class="form-field" id="rf-custom" hidden>
              <label class="form-label">${t('roles.form.customScope')}</label>
              <oas-transfer data-testid="rf-transfer" id="rf-transfer" source-title="${t('roles.transfer.source')}" target-title="${t('roles.transfer.target')}" searchable data="[]" value="[]"></oas-transfer>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="rf-cancel">${t('common.cancel')}</oas-button>
                <oas-button data-testid="rf-save" type="primary">${t('common.save')}</oas-button>
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
    drawer.setAttribute(
      'title',
      row ? t('roles.editRole').replace('#{id}', String(row.id)) : t('roles.new'),
    )
  }

  function openForm(row: RoleRow | null): void {
    state.editingId = row?.id ?? null
    fillForm(row)
    drawer.setAttribute('visible', '')
  }

  function renderTable(): void {
    if (state.roles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="roles-empty"><oas-empty description="${t('roles.empty')}"></oas-empty></td></tr>`
      return
    }
    tbody.innerHTML = state.roles
      .map(
        (r) => `<tr data-id="${r.id}">
          <td class="name-cell">${r.name}</td>
          <td><span class="mono code-cell">${r.code}</span></td>
          <td><oas-tag type="${DATA_SCOPE_TAG[r.dataScope]}">${dataScopeLabel(r.dataScope)}</oas-tag></td>
          <td class="num-cell mono">${r.userCount}</td>
          <td><span class="mono date-cell">${r.created}</span></td>
          <td class="action-cell">
            <oas-button size="small" type="text" data-edit="${r.id}">${t('common.edit')}</oas-button>
            <oas-popconfirm title="${t('roles.confirmDelete')}" data-del="${r.id}">
              <oas-button size="small" type="danger">${t('common.delete')}</oas-button>
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
          if (!ok) message.error(t('roles.notFound'))
          else message.success(t('common.deleted'))
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
        message.success(t('common.created'))
      } else {
        const updated = await updateRole(state.editingId, {
          name,
          code,
          dataScope: state.dataScope,
          deptIds,
        })
        if (!updated) message.error(t('roles.notFound'))
        else message.success(t('common.saved'))
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
