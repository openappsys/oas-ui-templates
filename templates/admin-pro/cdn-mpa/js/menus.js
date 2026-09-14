import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'
import { treeMenus } from './data/system.js'

function boot() {
  document.title = `${t('nav.menus')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './menus.html' })
  window.OASShell.setBreadcrumb([{ label: 'nav.menus' }])
  renderMenus()
}

// 登录守卫 + 启动渲染（置于模块末尾，避免 TDZ）

const TYPE_TAG = { M: 'default', C: 'primary', F: 'warning' }
const TYPE_ICON = { M: 'more', C: 'menu', F: 'edit' }
const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

function typeLabel(type) {
  return t(`menus.type.${type}`)
}

function rulesJSON() {
  return JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] })
}

// 树工具：平铺 / 查找 / 父节点 / 摘除 / 后代集合
function flattenTree(nodes) {
  const out = []
  const walk = (list) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
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

function parentOf(nodes, id) {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n.id
    if (n.children?.length) {
      const p = parentOf(n.children, id)
      if (p !== null) return p
    }
  }
  return null
}

function removeNode(nodes, id) {
  const i = nodes.findIndex((n) => n.id === id)
  if (i !== -1) {
    nodes.splice(i, 1)
    return true
  }
  for (const n of nodes) {
    if (n.children?.length && removeNode(n.children, id)) return true
  }
  return false
}

function insertChild(nodes, parentId, child) {
  if (parentId == null) {
    nodes.push(child)
    return
  }
  const parent = findNode(nodes, parentId)
  if (parent) (parent.children ??= []).push(child)
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

// C 型菜单按路径首段自动生成 perms（mod:list）
function autoPerms(type, path) {
  if (type !== 'C') return ''
  const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
  const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return mod ? `${mod}:list` : ''
}

function renderMenus() {
  const state = { tree: [], selectedId: null, editingId: null, formType: 'C' }

  const tree = document.querySelector('[data-testid="menu-tree"]')
  const detailEl = document.querySelector('#menu-detail')
  const drawer = document.querySelector('[data-testid="menu-form-drawer"]')
  const form = document.querySelector('#menu-form')
  const typeGroup = document.querySelector('#mf-type')
  const parentSelect = document.querySelector('[data-testid="mf-parent"]')
  const permsInput = document.querySelector('[data-testid="mf-perms"]')
  const pathInput = document.querySelector('[data-testid="mf-path"]')
  const permsHint = document.querySelector('#mf-perms-hint')
  const pathReq = document.querySelector('#mf-path-req')

  // 展开键：全部有子节点的节点（树契约：expanded = JSON 字符串数组）
  function expandKeys() {
    const keys = []
    const walk = (list) => {
      for (const n of list) {
        if (n.children?.length) {
          keys.push(String(n.id))
          walk(n.children)
        }
      }
    }
    walk(state.tree)
    return keys
  }

  function toTreeNodes(nodes) {
    return nodes.map((n) => ({
      key: String(n.id),
      label: n.title,
      type: n.type,
      perms: n.perms ?? '',
      path: n.path ?? '',
      children: n.children?.length ? toTreeNodes(n.children) : [],
    }))
  }

  function buildParentOptions() {
    const toOpt = (list) =>
      list.map((n) => ({
        value: String(n.id),
        label: n.title,
        children: n.children?.length ? toOpt(n.children) : undefined,
      }))
    parentSelect.setAttribute(
      'options',
      JSON.stringify([{ value: '0', label: t('menus.option.top'), children: toOpt(state.tree) }]),
    )
    parentSelect.setAttribute('expanded', JSON.stringify(expandKeys()))
  }

  function renderTree() {
    tree.setAttribute('data', JSON.stringify(toTreeNodes(state.tree)))
    tree.setAttribute('expanded', JSON.stringify(expandKeys()))
    if (state.selectedId != null) tree.setAttribute('selected', String(state.selectedId))
    else tree.removeAttribute('selected')
  }

  function nextId() {
    return flattenTree(state.tree).reduce((m, n) => Math.max(m, n.id), 0) + 1
  }

  function renderDetail() {
    const node = state.selectedId == null ? null : findNode(state.tree, state.selectedId)
    if (!node) {
      detailEl.innerHTML = `<oas-empty description="${t('menus.empty.selectNode')}"></oas-empty>`
      return
    }
    detailEl.innerHTML = `
      <div class="menu-detail-head">
        <div class="menu-detail-title">${node.title}</div>
        <oas-tag type="${TYPE_TAG[node.type]}">${typeLabel(node.type)}</oas-tag>
      </div>
      <oas-descriptions column="1">
        <oas-descriptions-item label="${t('menus.form.type')}"><span class="mono">${node.type}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('menus.form.perms')}"><span class="mono" data-testid="menu-detail-perms">${node.perms ?? '—'}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('menus.form.path')}"><span class="mono">${node.path ?? '—'}</span></oas-descriptions-item>
        <oas-descriptions-item label="${t('menus.detail.childCount')}"><span class="mono">${(node.children ?? []).length}</span></oas-descriptions-item>
      </oas-descriptions>
      <div class="menu-detail-actions">
        <oas-button data-md-action="edit" type="primary">${t('common.edit')}</oas-button>
        <oas-button data-md-action="child">${t('menus.addChild')}</oas-button>
        <oas-popconfirm title="${t('menus.confirmDelete')}" id="md-del-pop">
          <oas-button data-md-action="delete" type="danger">${t('common.delete')}</oas-button>
        </oas-popconfirm>
      </div>`
    detailEl.querySelector('[data-md-action="edit"]').addEventListener('click', () => {
      openForm(node)
    })
    detailEl.querySelector('[data-md-action="child"]').addEventListener('click', () => {
      openForm(null, node)
    })
    detailEl.querySelector('#md-del-pop').addEventListener('oas-ok', () => {
      if ((node.children ?? []).length > 0) {
        OASUI.message.error(t('menus.hasChildren'))
        return
      }
      removeNode(state.tree, node.id)
      OASUI.message.success(t('common.deleted'))
      state.selectedId = null
      renderTree()
      renderDetail()
    })
  }

  function setTypeRadio(type) {
    typeGroup.querySelectorAll('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === type) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
  }

  function renderTypeRadios() {
    typeGroup.replaceChildren(
      ...['M', 'C', 'F'].map((v) => {
        const radio = document.createElement('oas-radio')
        radio.setAttribute('name', 'menuType')
        radio.setAttribute('value', v)
        const label = document.createElement('span')
        label.className = 'radio-label'
        label.textContent = typeLabel(v)
        radio.appendChild(label)
        return radio
      }),
    )
    setTypeRadio(state.formType)
  }

  // 类型切换联动：权限标识提示 / 路由必填标记 / C 型自动补 perms
  function syncMenuType() {
    if (state.formType === 'C') {
      permsHint.textContent = t('menus.hint.autoPerms')
      pathReq.textContent = '*'
      const cur = permsInput.getAttribute('value') ?? ''
      if (!cur) {
        const auto = autoPerms('C', pathInput.getAttribute('value') ?? '')
        if (auto) permsInput.setAttribute('value', auto)
      }
    } else if (state.formType === 'M') {
      permsHint.textContent = t('menus.hint.noPermForDir')
      pathReq.textContent = ''
    } else {
      permsHint.textContent = t('menus.hint.required')
      pathReq.textContent = ''
    }
  }

  function fillMenuForm(node, parent) {
    state.editingId = node?.id ?? null
    state.formType = node?.type ?? 'C'
    document.querySelector('[data-testid="mf-name"]').setAttribute('value', node?.title ?? '')
    setTypeRadio(state.formType)
    parentSelect.setAttribute('value', String(parent?.id ?? 0))
    permsInput.setAttribute('value', node?.perms ?? '')
    pathInput.setAttribute('value', node?.path ?? '')
    syncMenuType()
    drawer.setAttribute(
      'title',
      node ? tf('menus.editMenu', { title: node.title }) : t('menus.new'),
    )
  }

  function openForm(node, parentOverride) {
    if (node) {
      const pid = parentOf(state.tree, node.id)
      fillMenuForm(node, pid == null ? null : findNode(state.tree, pid))
    } else {
      fillMenuForm(null, parentOverride ?? null)
    }
    drawer.setAttribute('visible', '')
  }

  tree.addEventListener('oas-select', (e) => {
    state.selectedId = Number(e.detail?.key)
    renderDetail()
  })

  // 节点渲染：按 type 换图标与类型标签（oas-tree 默认节点结构内约定类名）
  tree.addEventListener('node-render', (e) => {
    const { node, element } = e.detail
    element.querySelector('.tree-type-icon')?.setAttribute('name', TYPE_ICON[node.type] ?? '')
    const tag = element.querySelector('.tree-type-tag')
    if (tag) {
      tag.textContent = node.type
      tag.setAttribute('type', TYPE_TAG[node.type] ?? 'default')
    }
  })

  document.querySelector('[data-testid="menu-create"]').addEventListener('click', () => {
    openForm(null)
  })
  document.querySelector('[data-testid="mf-cancel"]').addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })
  document.querySelector('[data-testid="mf-save"]').addEventListener('click', () => {
    form.shadowRoot?.querySelector('form')?.requestSubmit()
  })

  typeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0]
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (v === 'M' || v === 'C' || v === 'F') {
      state.formType = v
      syncMenuType()
    }
  })

  // C 型：路由输入时权限标识留空则自动补全
  pathInput.addEventListener('oas-input', (e) => {
    if (state.formType !== 'C') return
    const cur = permsInput.getAttribute('value') ?? ''
    if (!cur) {
      const auto = autoPerms('C', e.detail?.value ?? '')
      if (auto) permsInput.setAttribute('value', auto)
    }
  })

  form.addEventListener('oas-submit', (e) => {
    const values = e.detail?.values ?? {}
    const name = values.name?.trim()
    if (!name) return
    const type = state.formType
    const parentRaw = parentSelect.getAttribute('value') || '0'
    const parentId = parentRaw === '0' ? null : Number(parentRaw)
    const perms = (permsInput.getAttribute('value') ?? '').trim()
    const path = (pathInput.getAttribute('value') ?? '').trim()

    // 类型级校验（对齐 vanilla：F 必填 perms 且格式、C 必填 path）
    if (type === 'F') {
      if (!perms) {
        OASUI.message.error(t('menus.err.permRequired'))
        return
      }
      if (!PERM_RE.test(perms)) {
        OASUI.message.error(t('menus.err.permFormat'))
        return
      }
    } else if (type === 'C') {
      if (!path) {
        OASUI.message.error(t('menus.err.pathRequired'))
        return
      }
    }

    // 父节点不可选自身或其后代
    if (state.editingId != null && parentId != null) {
      const desc = descendants(state.tree, state.editingId)
      if (parentId === state.editingId || desc.has(parentId)) {
        OASUI.message.error(t('menus.err.parentInvalid'))
        return
      }
    }

    const finalPerms = type === 'C' ? perms || autoPerms('C', path) : perms || undefined

    if (state.editingId != null) {
      const node = findNode(state.tree, state.editingId)
      if (!node) {
        OASUI.message.error(t('menus.notFound'))
        return
      }
      const oldParent = parentOf(state.tree, node.id)
      node.title = name
      node.type = type
      node.perms = finalPerms
      node.path = type === 'C' ? path : undefined
      if (parentId !== oldParent) {
        removeNode(state.tree, node.id)
        insertChild(state.tree, parentId, node)
      }
      OASUI.message.success(t('common.saved'))
    } else {
      const newNode = {
        id: nextId(),
        title: name,
        type,
        perms: finalPerms,
        path: type === 'C' ? path : undefined,
        parentId,
        children: [],
      }
      insertChild(state.tree, parentId, newNode)
      state.selectedId = newNode.id
      OASUI.message.success(t('common.created'))
    }
    drawer.removeAttribute('visible')
    buildParentOptions()
    renderTree()
    renderDetail()
  })

  renderTypeRadios()
  form.setAttribute('rules', rulesJSON())

  async function init() {
    state.tree = await treeMenus()
    buildParentOptions()
    state.selectedId = state.tree[0]?.id ?? null
    renderTree()
    renderDetail()
  }
  init()
}

if (guard()) boot()
