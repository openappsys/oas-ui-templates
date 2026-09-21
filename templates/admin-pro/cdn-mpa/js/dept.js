import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { createDept, listDepts, removeDept, treeDepts, updateDept } from './data/system.js'

function boot() {
  document.title = `${t('nav.dept')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './dept.html' })
  window.OASShell.setBreadcrumb([{ label: 'nav.dept' }])
  renderDept()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

function rulesJSON() {
  return JSON.stringify({ name: [{ required: true, message: t('dept.rule.name') }] })
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

function descendants(nodes, id) {
  const set = new Set()
  const node = findNode(nodes, id)
  const walk = (list) => {
    for (const n of list) {
      set.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  if (node) walk(node.children ?? [])
  return set
}

function toTreeNodes(nodes) {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.name,
    members: n.members,
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

function expandKeys(nodes) {
  const keys = []
  const walk = (list) => {
    for (const n of list) {
      if (n.children?.length) {
        keys.push(String(n.id))
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return keys
}

// 上级部门选项：排除自身与后代（防环）；0 = 顶级
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
    filtered = nodes.map((n) => prune(n, excluded)).filter(Boolean)
  }
  return [{ value: '0', label: t('dept.option.top'), children: toOpt(filtered) }]
}

function prune(node, excluded) {
  if (excluded.has(node.id)) return null
  const children = (node.children ?? []).map((c) => prune(c, excluded)).filter(Boolean)
  return { ...node, children }
}

function renderDept() {
  const state = { tree: [], flat: [], selectedId: null, editingId: null }
  let saving = false

  const tree = document.querySelector('[data-testid="dept-tree"]')
  const detailEl = document.querySelector('#dept-detail')
  const drawer = document.querySelector('[data-testid="dept-form-drawer"]')
  const form = document.querySelector('#dept-form')
  const parentSelect = document.querySelector('[data-testid="df-parent"]')

  function renderTree() {
    tree.setAttribute('data', JSON.stringify(toTreeNodes(state.tree)))
    // 树契约：expanded = JSON 字符串数组
    tree.setAttribute('expanded', JSON.stringify(expandKeys(state.tree)))
    if (state.selectedId != null) tree.setAttribute('selected', String(state.selectedId))
    else tree.removeAttribute('selected')
  }

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

  function subColumns() {
    return [
      { key: 'name', title: t('dept.th.name') },
      { key: 'members', title: t('dept.th.members'), align: 'right' },
      {
        key: 'action',
        title: t('dept.th.action'),
        render: (r) => subActionCell(r),
      },
    ]
  }

  function renderSubTable(node) {
    const children = node.children ?? []
    if (children.length === 0) {
      detailEl.querySelector('#dept-sub').innerHTML =
        `<div class="sub-dept-empty">${t('dept.empty.noChildren')}</div>`
      return
    }
    const sub = detailEl.querySelector('[data-testid="dept-sub-table"]')
    sub.columns = subColumns()
    sub.setAttribute('data', JSON.stringify(children))
    detailEl.querySelector('#dept-sub').hidden = false
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
        <oas-tag type="primary" data-testid="dept-detail-members">${tf('dept.memberCount', { n: node.members })}</oas-tag>
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
    detailEl
      .querySelector('[data-md-action="edit"]')
      .addEventListener('click', () => openForm(node))
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
    parentSelect.setAttribute('expanded', JSON.stringify(expandKeys(state.tree)))
  }

  function fillForm(node, parent) {
    state.editingId = node?.id ?? null
    document.querySelector('[data-testid="df-name"]').setAttribute('value', node?.name ?? '')
    document
      .querySelector('[data-testid="df-members"]')
      .setAttribute('value', node ? String(node.members) : '0')
    const pid = node?.parentId ?? parent?.id ?? null
    parentSelect.setAttribute('value', String(pid ?? 0))
    refreshParentOptions(node?.id ?? null)
    drawer.setAttribute('title', node ? tf('dept.editDept', { name: node.name }) : t('dept.new'))
  }

  function openForm(node, parent) {
    fillForm(node, parent)
    drawer.setAttribute('visible', '')
  }

  async function refresh() {
    const [rows, treeRows] = await Promise.all([listDepts(), treeDepts()])
    state.tree = treeRows
    state.flat = rows
    if (state.selectedId == null || !findNode(state.tree, state.selectedId)) {
      state.selectedId = state.tree[0]?.id ?? null
    }
    renderTree()
    renderDetail()
  }

  // 树节点渲染：往自定义模板槽里填人数徽标
  tree.addEventListener('oas-node-render', (e) => {
    const { node, element } = e.detail
    const badge = element.querySelector('.dept-member-badge')
    if (badge) badge.textContent = String(node.members)
  })

  tree.addEventListener('oas-select', (e) => {
    state.selectedId = Number(e.detail?.key)
    renderTree()
    renderDetail()
  })

  document.querySelector('[data-testid="dept-create"]').addEventListener('click', () => {
    openForm(null)
  })
  document.querySelector('[data-testid="df-cancel"]').addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })
  document.querySelector('[data-testid="df-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = e.detail?.values ?? {}
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
      await refresh()
    } finally {
      saving = false
    }
  })

  // 详情区子部门表：编辑 / 行内删除（popconfirm 事件带 detail.source）
  detailEl.addEventListener('click', (e) => {
    e.stopPropagation()
    const editBtn = e.composedPath().find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const row = state.flat.find((d) => d.id === Number(editBtn.getAttribute('data-edit')))
      if (row) openForm(row)
    }
  })
  detailEl.addEventListener('oas-ok', (e) => {
    const pc = e.detail?.source
    if (!pc?.hasAttribute?.('data-del')) return
    doDelete(Number(pc.getAttribute('data-del')))
  })

  form.setAttribute('rules', rulesJSON())
  refresh()
}

if (guard()) boot()
