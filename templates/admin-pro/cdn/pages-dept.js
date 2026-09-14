/**
 * 部门管理页（自 vanilla src/pages/dept.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 左右分栏（oas-splitter）+ 成员徽章树 + 详情子部门表 + 抽屉表单
 * 树 expanded 用 JSON 字符串数组契约（oas-ui 2.5.0）
 */
import { onLocaleChange, t } from './i18n.js'
import { createDept, listDepts, removeDept, treeDepts, updateDept } from './data/system.js'
import { descendants, expandKeys, findNode } from './tree-utils.js'

const RULES = () => JSON.stringify({ name: [{ required: true, message: t('dept.rule.name') }] })

function subActionCell(node) {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(node.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = t('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(node.id))
  pop.setAttribute('title', t('dept.confirmDelete'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = t('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

const SUB_COLUMNS = () => [
  { key: 'name', title: t('dept.th.name') },
  { key: 'members', title: t('dept.th.members'), align: 'right' },
  { key: 'action', title: t('dept.th.action'), render: subActionCell },
]

function toTreeNodes(nodes) {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.name,
    members: n.members,
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

function buildParentOptions(nodes, excludeId) {
  const toOpt = (list) =>
    list.map((n) => ({
      value: String(n.id),
      label: n.name,
      children: n.children?.length ? toOpt(n.children) : undefined,
    }))
  let filtered = nodes
  if (excludeId != null) {
    const excluded = descendants(nodes, excludeId)
    excluded.add(excludeId)
    filtered = nodes.map((n) => prune(n, excluded)).filter((n) => n !== null)
  }
  return [{ value: '0', label: t('dept.option.top'), children: toOpt(filtered) }]
}

function prune(node, excluded) {
  if (excluded.has(node.id)) return null
  const children = (node.children ?? []).map((c) => prune(c, excluded)).filter((c) => c !== null)
  return { ...node, children }
}

export function renderDept(el) {
  const state = {
    tree: [],
    flat: [],
    selectedId: null,
    editingId: null,
  }
  let saving = false

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.dept')}</h1>
          <p class="page-subtitle">${t('dept.subtitle')}</p>
        </div>
        <oas-button data-testid="dept-create" type="primary" icon="plus">${t('dept.new')}</oas-button>
      </div>
      <oas-splitter class="dept-layout" percent="30" min="20" max="45">
        <oas-card slot="left" class="dept-tree-card" title="${t('dept.treeTitle')}">
          <oas-tree data-testid="dept-tree" id="dept-tree" data="[]" expanded="">
            <template slot="node">
              <span class="tree-node-label">
                <span data-node-label></span>
                <span class="dept-member-badge"></span>
              </span>
            </template>
          </oas-tree>
        </oas-card>
        <oas-card slot="right" class="dept-detail-card" title="${t('dept.detailTitle')}">
          <div id="dept-detail" class="dept-detail"></div>
        </oas-card>
      </oas-splitter>

      <oas-drawer data-testid="dept-form-drawer" id="dept-form-drawer" title="${t('dept.new')}" placement="right" size="medium" no-footer>
        <oas-form id="dept-form" rules='${RULES()}'>
          <div class="dept-form-body">
            <div class="form-field">
              <label class="form-label">${t('dept.form.name')} <span class="req">*</span></label>
              <oas-input data-testid="df-name" name="name" placeholder="${t('dept.rule.name')}"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">${t('dept.form.parent')}</label>
              <oas-tree-select data-testid="df-parent" id="df-parent" placeholder="${t('dept.placeholder.top')}" options="[]" value="0"></oas-tree-select>
            </div>
            <div class="form-field">
              <label class="form-label">${t('dept.form.members')}</label>
              <oas-input-number data-testid="df-members" name="members" min="0" placeholder="0"></oas-input-number>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="df-cancel">${t('common.cancel')}</oas-button>
                <oas-button data-testid="df-save" type="primary">${t('common.save')}</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>`

  const tree = el.querySelector('[data-testid="dept-tree"]')
  const detailEl = el.querySelector('#dept-detail')
  const drawer = el.querySelector('[data-testid="dept-form-drawer"]')
  const form = el.querySelector('#dept-form')
  const parentSelect = el.querySelector('[data-testid="df-parent"]')

  function renderTree() {
    tree.setAttribute('data', JSON.stringify(toTreeNodes(state.tree)))
    tree.setAttribute('expanded', JSON.stringify(expandKeys(state.tree)))
    if (state.selectedId != null) tree.setAttribute('selected', String(state.selectedId))
    else tree.removeAttribute('selected')
  }

  function renderSubTable(node) {
    const children = node.children ?? []
    if (children.length === 0) {
      detailEl.querySelector('#dept-sub').innerHTML =
        `<div class="sub-dept-empty">${t('dept.empty.noChildren')}</div>`
      return
    }
    const sub = detailEl.querySelector('[data-testid="dept-sub-table"]')
    sub.columns = SUB_COLUMNS()
    sub.setAttribute('data', JSON.stringify(children))
    detailEl.querySelector('#dept-sub').hidden = false
  }

  function onSubClick(e) {
    e.stopPropagation()
    const path = e.composedPath()
    const editBtn = path.find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const id = Number(editBtn.getAttribute('data-edit'))
      const row = state.flat.find((d) => d.id === id)
      if (row) openForm(row)
    }
    // v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open
  }

  function onSubDelete(e) {
    // v2.2.8 起 popconfirm 的 ok/cancel 事件带 detail.source，直接反查来源
    const pc = e.detail.source
    if (!pc?.hasAttribute?.('data-del')) return
    doDelete(Number(pc.getAttribute('data-del')))
  }

  function renderDetail() {
    const node = state.selectedId == null ? null : findNode(state.tree, state.selectedId)
    if (!node) {
      detailEl.innerHTML = `<oas-empty description="${t('dept.empty.selectNode')}"></oas-empty>`
      return
    }
    detailEl.innerHTML = `
      <div class="dept-detail-head">
        <div class="dept-detail-title">${node.name}</div>
        <oas-tag type="primary" data-testid="dept-detail-members">${t('dept.memberCount', { n: node.members })}</oas-tag>
      </div>
      <oas-descriptions column="1">
        <oas-descriptions-item label="${t('dept.detail.id')}"><span class="mono">${node.id}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('dept.form.parent')}"><span class="mono">${node.parentId == null ? '—' : node.parentId}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('dept.detail.childCount')}"><span class="mono">${(node.children ?? []).length}</span></oas-descriptions-item>
      </oas-descriptions>
      <div class="dept-detail-actions">
        <oas-button data-md-action="edit" type="primary">${t('common.edit')}</oas-button>
        <oas-button data-md-action="child">${t('dept.addChild')}</oas-button>
        <oas-popconfirm title="${t('dept.confirmDelete')}" id="md-del-pop">
          <oas-button data-md-action="delete" type="danger">${t('common.delete')}</oas-button>
        </oas-popconfirm>
      </div>
      <div class="dept-detail-sub">
        <div class="dept-detail-sub-title">${t('dept.subTitle')}</div>
        <div id="dept-sub">
          <oas-table data-testid="dept-sub-table" row-key="id"></oas-table>
        </div>
      </div>`
    detailEl.querySelector('[data-md-action="edit"]').addEventListener('click', () => openForm(node))
    detailEl
      .querySelector('[data-md-action="child"]')
      .addEventListener('click', () => openForm(null, node))
    detailEl.querySelector('#md-del-pop').addEventListener('oas-ok', () => {
      doDelete(node.id)
    })
    renderSubTable(node)
  }

  async function doDelete(id) {
    const node = findNode(state.tree, id)
    if (!node) {
      OASUI.message.error(t('dept.notFound'))
      return
    }
    if ((node.children ?? []).length > 0) {
      OASUI.message.error(t('dept.hasChildren'))
      return
    }
    const ok = await removeDept(id)
    if (!ok) {
      OASUI.message.error(t('dept.notFound'))
      return
    }
    OASUI.message.success(t('common.deleted'))
    state.selectedId = null
    refresh()
  }

  function refreshParentOptions(excludeId) {
    parentSelect.setAttribute('options', JSON.stringify(buildParentOptions(state.tree, excludeId)))
    // expanded 契约：JSON 字符串数组（oas-ui 2.5.0）
    parentSelect.setAttribute('expanded', JSON.stringify(expandKeys(state.tree)))
  }

  function fillForm(node, parent) {
    state.editingId = node?.id ?? null
    el.querySelector('[data-testid="df-name"]').setAttribute('value', node?.name ?? '')
    el.querySelector('[data-testid="df-members"]').setAttribute(
      'value',
      node ? String(node.members) : '0',
    )
    const pid = node?.parentId ?? parent?.id ?? null
    parentSelect.setAttribute('value', String(pid ?? 0))
    refreshParentOptions(node?.id ?? null)
    drawer.setAttribute('title', node ? t('dept.editDept', { name: node.name }) : t('dept.new'))
  }

  function openForm(node, parent) {
    fillForm(node, parent)
    drawer.setAttribute('visible', '')
  }

  async function refresh() {
    const [rows, deptTree] = await Promise.all([listDepts(), treeDepts()])
    state.tree = deptTree
    state.flat = rows
    if (state.selectedId == null || !findNode(state.tree, state.selectedId)) {
      state.selectedId = state.tree[0]?.id ?? null
    }
    renderTree()
    renderDetail()
  }

  tree.addEventListener('oas-node-render', (e) => {
    const { node, element } = e.detail
    const badge = element.querySelector('.dept-member-badge')
    if (badge) badge.textContent = String(node.members)
  })

  tree.addEventListener('oas-select', (e) => {
    state.selectedId = Number(e.detail.key)
    renderTree()
    renderDetail()
  })

  el.querySelector('[data-testid="dept-create"]').addEventListener('click', () => {
    openForm(null)
  })

  el.querySelector('[data-testid="df-cancel"]').addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector('[data-testid="df-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = e.detail.values
      const name = values.name?.trim()
      if (!name) return
      const parentRaw = parentSelect.getAttribute('value') || '0'
      const parentId = parentRaw === '0' ? null : Number(parentRaw)
      const members = Number(values.members) || 0
      if (state.editingId != null && parentId === state.editingId) {
        OASUI.message.error(t('dept.err.parentSelf'))
        return
      }
      if (state.editingId == null) {
        await createDept({ name, parentId, members })
        OASUI.message.success(t('common.created'))
      } else {
        const updated = await updateDept(state.editingId, { name, parentId, members })
        if (!updated) OASUI.message.error(t('dept.notFound'))
        else OASUI.message.success(t('common.saved'))
      }
      drawer.removeAttribute('visible')
      refresh()
    } finally {
      saving = false
    }
  })

  detailEl.addEventListener('click', onSubClick)
  detailEl.addEventListener('oas-ok', onSubDelete)

  function refreshText() {
    document.title = `${t('nav.dept')} · ${t('app.title')}`
    el.querySelector('h1.page-title').textContent = t('nav.dept')
    el.querySelector('p.page-subtitle').textContent = t('dept.subtitle')
    el.querySelector('[data-testid="dept-create"]').textContent = t('dept.new')
    el.querySelector('.dept-tree-card').setAttribute('title', t('dept.treeTitle'))
    el.querySelector('.dept-detail-card').setAttribute('title', t('dept.detailTitle'))
    // 抽屉表单：标题随新建/编辑态 + 字段 label/占位/规则/按钮
    const editingNode = state.editingId == null ? null : findNode(state.tree, state.editingId)
    drawer.setAttribute(
      'title',
      editingNode ? t('dept.editDept', { name: editingNode.name }) : t('dept.new'),
    )
    const LABEL_KEYS = ['dept.form.name', 'dept.form.parent', 'dept.form.members']
    el.querySelectorAll('#dept-form .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (k) {
        const req = n.querySelector('.req')
        n.textContent = t(k)
        if (req) n.append(' ', req)
      }
    })
    el.querySelector('[data-testid="df-name"]').setAttribute('placeholder', t('dept.rule.name'))
    parentSelect.setAttribute('placeholder', t('dept.placeholder.top'))
    form.setAttribute('rules', RULES())
    el.querySelector('[data-testid="df-cancel"]').textContent = t('common.cancel')
    el.querySelector('[data-testid="df-save"]').textContent = t('common.save')
    // 详情区（含空态/描述/按钮文案）随语言重渲；树选中状态由 renderDetail 内部按 selectedId 恢复
    renderDetail()
  }

  document.title = `${t('nav.dept')} · ${t('app.title')}`
  refresh()
  return onLocaleChange(refreshText)
}
