/**
 * 角色管理页（自 vanilla src/pages/roles.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 列表 + 右侧抽屉表单：数据权限单选（自定义数据权限展开部门穿梭框）
 */
import { onLocaleChange, t } from './i18n.js'
import { createRole, listRoles, removeRole, treeDepts, updateRole } from './data/system.js'
import { flattenTree } from './tree-utils.js'

const DATA_SCOPE_TAG = { 1: 'primary', 2: 'warning', 3: 'info', 4: 'info', 5: 'default' }

const DATA_SCOPE_OPTIONS = () => [
  { value: 1, label: t('roles.scopeOpt.1'), desc: t('roles.scopeDesc.1') },
  { value: 2, label: t('roles.scopeOpt.2'), desc: t('roles.scopeDesc.2') },
  { value: 3, label: t('roles.scopeOpt.3'), desc: t('roles.scopeDesc.3') },
  { value: 4, label: t('roles.scopeOpt.4'), desc: t('roles.scopeDesc.4') },
  { value: 5, label: t('roles.scopeOpt.5'), desc: t('roles.scopeDesc.5') },
]

const RULES = () =>
  JSON.stringify({
    name: [{ required: true, message: t('roles.rule.name') }],
    code: [
      { required: true, message: t('roles.rule.code') },
      { pattern: '^[a-z][a-z0-9:_-]*$', message: t('roles.rule.codeFmt') },
    ],
  })

function scopeCell(row) {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', DATA_SCOPE_TAG[row.dataScope])
  tag.textContent = t(`roles.scope.${row.dataScope}`)
  return tag
}

function actionCell(row) {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = t('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(row.id))
  pop.setAttribute('title', t('roles.confirmDelete'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = t('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

const TABLE_COLUMNS = () => [
  { key: 'name', title: t('roles.th.name') },
  { key: 'code', title: t('roles.th.code') },
  { key: 'dataScope', title: t('roles.th.dataScope'), render: scopeCell },
  { key: 'userCount', title: t('roles.th.userCount'), align: 'right' },
  { key: 'created', title: t('roles.th.created') },
  { key: 'action', title: t('roles.th.action'), render: actionCell },
]

export function renderRoles(el) {
  const state = {
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
          <oas-table data-testid="roles-table" row-key="id" empty-text="${t('roles.empty')}"></oas-table>
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
                ${DATA_SCOPE_OPTIONS()
                  .map(
                    (o) =>
                      `<oas-radio name="dataScope" value="${o.value}"><span class="radio-item"><span class="radio-label">${o.label}</span><span class="radio-desc">${o.desc}</span></span></oas-radio>`,
                  )
                  .join('')}
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

  const table = el.querySelector('[data-testid="roles-table"]')
  const drawer = el.querySelector('[data-testid="role-form-drawer"]')
  const form = el.querySelector('#role-form')
  const scopeGroup = el.querySelector('#rf-scope')
  const customField = el.querySelector('#rf-custom')
  const transfer = el.querySelector('[data-testid="rf-transfer"]')

  function setRadioChecked(scope) {
    scopeGroup.querySelectorAll('oas-radio').forEach((radio) => {
      if (Number(radio.getAttribute('value')) === scope) radio.setAttribute('checked', '')
      else radio.removeAttribute('checked')
    })
  }

  function fillForm(row) {
    el.querySelector('[data-testid="rf-name"]').setAttribute('value', row?.name ?? '')
    el.querySelector('[data-testid="rf-code"]').setAttribute('value', row?.code ?? '')
    state.dataScope = row?.dataScope ?? 1
    state.deptIds = row?.dataScope === 2 ? [...row.deptIds] : []
    setRadioChecked(state.dataScope)
    transfer.setAttribute('value', JSON.stringify(state.deptIds.map(String)))
    // vanilla 同款怪癖：hidden 属性赋 false 仍序列化为 hidden=""，保持不修（vanilla 同款）
    customField.hidden = state.dataScope !== 2
    drawer.setAttribute(
      'title',
      row ? t('roles.editRole').replace('#{id}', String(row.id)) : t('roles.new'),
    )
  }

  function openForm(row) {
    state.editingId = row?.id ?? null
    fillForm(row)
    drawer.setAttribute('visible', '')
  }

  function renderTable() {
    table.columns = TABLE_COLUMNS()
    table.setAttribute('data', JSON.stringify(state.roles))
  }

  function onTableClick(e) {
    const path = e.composedPath()
    const editBtn = path.find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const id = Number(editBtn.getAttribute('data-edit'))
      const row = state.roles.find((r) => r.id === id)
      if (row) openForm(row)
    }
    // v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动（点击触发即开合），无需模板手动 open
  }

  function onDeleteOk(e) {
    // v2.2.8 起 popconfirm 的 ok/cancel 事件带 detail.source，直接反查来源，不再扫 open 态
    const pc = e.detail.source
    if (!pc?.hasAttribute?.('data-del')) return
    const id = Number(pc.getAttribute('data-del'))
    removeRole(id).then((ok) => {
      if (!ok) OASUI.message.error(t('roles.notFound'))
      else OASUI.message.success(t('common.deleted'))
      refresh()
    })
  }

  async function refresh() {
    const [rows, deptTree] = await Promise.all([listRoles(), treeDepts()])
    // stale 守卫：等待期间导航离开后 el 已脱离文档，续体渲染只会写入陈旧 DOM，直接放弃
    if (!el.isConnected) return
    state.roles = rows
    state.deptList = flattenTree(deptTree)
    transfer.setAttribute(
      'data',
      JSON.stringify(state.deptList.map((d) => ({ key: String(d.id), label: d.name }))),
    )
    renderTable()
  }

  el.querySelector('[data-testid="role-create"]').addEventListener('click', () => {
    openForm(null)
  })

  el.querySelector('[data-testid="rf-cancel"]').addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector('[data-testid="rf-save"]').addEventListener('click', () => {
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
    state.deptIds = e.detail.value.map(Number)
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    const values = e.detail.values
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
      refresh()
    } finally {
      saving = false
    }
  })

  table.addEventListener('click', onTableClick)
  table.addEventListener('oas-ok', onDeleteOk)

  function refreshText() {
    document.title = `${t('nav.roles')} · ${t('app.title')}`
    el.querySelector('h1.page-title').textContent = t('nav.roles')
    el.querySelector('p.page-subtitle').textContent = t('roles.subtitle')
    el.querySelector('[data-testid="role-create"]').textContent = t('roles.new')
    el.querySelector('oas-card.list-card').setAttribute('title', t('roles.list'))
    table.setAttribute('empty-text', t('roles.empty'))
    // 抽屉表单：标题随新建/编辑态 + 字段 label/占位/提示/规则/按钮
    drawer.setAttribute(
      'title',
      state.editingId == null
        ? t('roles.new')
        : t('roles.editRole').replace('#{id}', String(state.editingId)),
    )
    const LABEL_KEYS = ['roles.form.name', 'roles.form.code', 'roles.form.dataScope']
    el.querySelectorAll('#role-form .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (k) {
        const req = n.querySelector('.req')
        n.textContent = t(k)
        if (req) n.append(' ', req)
      }
    })
    el.querySelector('#rf-custom > .form-label')?.replaceChildren(t('roles.form.customScope'))
    el.querySelector('[data-testid="rf-name"]').setAttribute('placeholder', t('roles.rule.name'))
    el
      .querySelector('[data-testid="rf-code"]')
      .setAttribute('placeholder', t('roles.placeholder.code'))
    el.querySelector('.form-hint').textContent = t('roles.hint.code')
    scopeGroup.innerHTML = DATA_SCOPE_OPTIONS()
      .map(
        (o) =>
          `<oas-radio name="dataScope" value="${o.value}"><span class="radio-item"><span class="radio-label">${o.label}</span><span class="radio-desc">${o.desc}</span></span></oas-radio>`,
      )
      .join('')
    setRadioChecked(state.dataScope)
    transfer.setAttribute('source-title', t('roles.transfer.source'))
    transfer.setAttribute('target-title', t('roles.transfer.target'))
    form.setAttribute('rules', RULES())
    el.querySelector('[data-testid="rf-cancel"]').textContent = t('common.cancel')
    el.querySelector('[data-testid="rf-save"]').textContent = t('common.save')
    // 表格列定义随语言重建；数据/勾选不动
    renderTable()
  }

  document.title = `${t('nav.roles')} · ${t('app.title')}`
  refresh()
  return onLocaleChange(refreshText)
}
