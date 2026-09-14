import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { createRole, listRoles, removeRole, treeDepts, updateRole } from './data/system.js'

function boot() {
  document.title = `${t('nav.roles')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './roles.html' })
  // 面包屑：单级（当前页）
  window.OASShell.setBreadcrumb([{ label: 'nav.roles' }])
  renderRoles()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

// 数据权限 → 标签色（对齐 vanilla roles.ts）
const DATA_SCOPE_TAG = { 1: 'primary', 2: 'warning', 3: 'info', 4: 'info', 5: 'default' }

// 数据权限单选项（label/desc 随语言，JS 灌）
function scopeOptions() {
  return [1, 2, 3, 4, 5].map((v) => ({
    value: v,
    label: t(`roles.scopeOpt.${v}`),
    desc: t(`roles.scopeDesc.${v}`),
  }))
}

function rulesJSON() {
  return JSON.stringify({
    name: [{ required: true, message: t('roles.rule.name') }],
    code: [
      { required: true, message: t('roles.rule.code') },
      { pattern: '^[a-z][a-z0-9:_-]*$', message: t('roles.rule.codeFmt') },
    ],
  })
}

// 平铺树（transfer 用全量部门列表）
function flatten(roots) {
  const out = []
  const walk = (nodes) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return out
}

function renderRoles() {
  const state = { roles: [], editingId: null, dataScope: 1, deptIds: [] }
  let saving = false

  const table = document.querySelector('[data-testid="roles-table"]')
  const drawer = document.querySelector('[data-testid="role-form-drawer"]')
  const form = document.querySelector('#role-form')
  const scopeGroup = document.querySelector('#rf-scope')
  const customField = document.querySelector('#rf-custom')
  const transfer = document.querySelector('[data-testid="rf-transfer"]')

  function setRadioChecked(scope) {
    scopeGroup.querySelectorAll('oas-radio').forEach((radio) => {
      if (Number(radio.getAttribute('value')) === scope) radio.setAttribute('checked', '')
      else radio.removeAttribute('checked')
    })
  }

  function renderScopeRadios() {
    scopeGroup.replaceChildren(
      ...scopeOptions().map((o) => {
        const radio = document.createElement('oas-radio')
        radio.setAttribute('name', 'dataScope')
        radio.setAttribute('value', String(o.value))
        const item = document.createElement('span')
        item.className = 'radio-item'
        const label = document.createElement('span')
        label.className = 'radio-label'
        label.textContent = o.label
        const desc = document.createElement('span')
        desc.className = 'radio-desc'
        desc.textContent = o.desc
        item.appendChild(label)
        item.appendChild(desc)
        radio.appendChild(item)
        return radio
      }),
    )
    setRadioChecked(state.dataScope)
  }

  function fillForm(row) {
    document.querySelector('[data-testid="rf-name"]').setAttribute('value', row?.name ?? '')
    document.querySelector('[data-testid="rf-code"]').setAttribute('value', row?.code ?? '')
    state.dataScope = row?.dataScope ?? 1
    state.deptIds = row?.dataScope === 2 ? [...row.deptIds] : []
    setRadioChecked(state.dataScope)
    transfer.setAttribute('value', JSON.stringify(state.deptIds.map(String)))
    // [hidden] 怪癖保持 vanilla 同款：HTMLElement.hidden 属性驱动显隐
    customField.hidden = state.dataScope !== 2
    drawer.setAttribute('title', row ? tf('roles.editRole', { id: row.id }) : t('roles.new'))
  }

  function openForm(row) {
    state.editingId = row?.id ?? null
    fillForm(row)
    drawer.setAttribute('visible', '')
  }

  function columns() {
    return [
      { key: 'name', title: t('roles.th.name') },
      { key: 'code', title: t('roles.th.code') },
      {
        key: 'dataScope',
        title: t('roles.th.dataScope'),
        render: (r) => {
          const tag = document.createElement('oas-tag')
          tag.setAttribute('type', DATA_SCOPE_TAG[r.dataScope])
          tag.textContent = t(`roles.scope.${r.dataScope}`)
          return tag
        },
      },
      { key: 'userCount', title: t('roles.th.userCount'), align: 'right' },
      { key: 'created', title: t('roles.th.created') },
      {
        key: 'action',
        title: t('roles.th.action'),
        render: (r) => {
          const ctx = document.createElement('div')
          ctx.className = 'action-cell'
          const edit = document.createElement('oas-button')
          edit.setAttribute('data-edit', String(r.id))
          edit.setAttribute('size', 'small')
          edit.setAttribute('type', 'text')
          edit.textContent = t('common.edit')
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('data-del', String(r.id))
          pop.setAttribute('title', t('roles.confirmDelete'))
          const del = document.createElement('oas-button')
          del.setAttribute('size', 'small')
          del.setAttribute('type', 'danger')
          del.textContent = t('common.delete')
          pop.appendChild(del)
          ctx.appendChild(edit)
          ctx.appendChild(pop)
          return ctx
        },
      },
    ]
  }

  function renderTable() {
    table.columns = columns()
    table.setAttribute('data', JSON.stringify(state.roles))
  }

  async function refresh() {
    const [rows, deptTree] = await Promise.all([listRoles(), treeDepts()])
    state.roles = rows
    transfer.setAttribute(
      'data',
      JSON.stringify(flatten(deptTree).map((d) => ({ key: String(d.id), label: d.name }))),
    )
    renderTable()
  }

  document.querySelector('[data-testid="role-create"]').addEventListener('click', () => {
    openForm(null)
  })
  document.querySelector('[data-testid="rf-cancel"]').addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })
  // 保存：经 oas-form 内部原生 form 触发校验提交
  document.querySelector('[data-testid="rf-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  scopeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0]
    if (!radio.hasAttribute('checked')) return
    const val = Number(radio.getAttribute('value'))
    if (!Number.isFinite(val)) return
    state.dataScope = val
    if (state.dataScope === 2) {
      customField.hidden = false
    } else {
      state.deptIds = []
      customField.hidden = true
    }
  })

  transfer.addEventListener('oas-change', (e) => {
    state.deptIds = (e.detail?.value ?? []).map(Number)
  })

  table.addEventListener('click', (e) => {
    const editBtn = e.composedPath().find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const row = state.roles.find((r) => r.id === Number(editBtn.getAttribute('data-edit')))
      if (row) openForm(row)
    }
    // v2.2.8 起单元格内 popconfirm 原生自驱动，无需手动 open
  })
  table.addEventListener('oas-ok', (e) => {
    // popconfirm ok/cancel 事件带 detail.source，直接反查来源
    const pc = e.detail?.source
    if (!pc?.hasAttribute?.('data-del')) return
    const id = Number(pc.getAttribute('data-del'))
    removeRole(id).then((ok) => {
      if (!ok) OASUI.message.error(t('roles.notFound'))
      else OASUI.message.success(t('common.deleted'))
      refresh()
    })
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    const values = e.detail?.values ?? {}
    const name = values.name?.trim()
    const code = values.code?.trim()
    if (!name || !code) return
    saving = true
    try {
      const deptIds = state.dataScope === 2 ? state.deptIds : []
      if (state.editingId == null) {
        await createRole({ name, code, dataScope: state.dataScope, deptIds, userCount: 0 })
        OASUI.message.success(t('common.created'))
      } else {
        const updated = await updateRole(state.editingId, {
          name,
          code,
          dataScope: state.dataScope,
          deptIds,
        })
        if (!updated) OASUI.message.error(t('roles.notFound'))
        else OASUI.message.success(t('common.saved'))
      }
      drawer.removeAttribute('visible')
      await refresh()
    } finally {
      saving = false
    }
  })

  renderScopeRadios()
  form.setAttribute('rules', rulesJSON())
  refresh()
}

if (guard()) boot()
