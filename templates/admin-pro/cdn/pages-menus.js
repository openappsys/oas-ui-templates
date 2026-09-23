/**
 * 菜单管理页（自 vanilla src/pages/menus.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 左树右详情 + 抽屉表单（类型单选 / 上级树选择 / 权限标识自动推导）
 * 树 expanded 用 JSON 字符串数组契约（oas-ui 2.5.0）
 */
import { onLocaleChange, t } from './i18n.js'
import { treeMenus } from './data/system.js'
import {
  autoPerms,
  descendants,
  expandKeys,
  findNode,
  flattenTree,
  insertChild,
  parentOf,
  removeNode,
  toMenuTreeNodes,
} from './tree-utils.js'

const TYPE_TAG = { M: 'default', C: 'primary', F: 'warning' }
const TYPE_ICON = { M: 'more', C: 'menu', F: 'edit' }
const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

const RULES = () => JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] })

export function renderMenus(el) {
  const state = {
    tree: [],
    selectedId: null,
    editingId: null,
    formType: 'C',
  }

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.menus')}</h1>
          <p class="page-subtitle">${t('menus.subtitle')}</p>
        </div>
        <oas-button data-testid="menu-create" type="primary" icon="plus">${t('menus.new')}</oas-button>
      </div>
      <div class="menu-layout">
        <oas-card class="menu-tree-card" title="${t('menus.treeTitle')}">
          <oas-tree data-testid="menu-tree" id="menu-tree" data="[]" expanded="" selected=""></oas-tree>
        </oas-card>
        <oas-card class="menu-detail-card" title="${t('menus.detailTitle')}">
          <div id="menu-detail" class="menu-detail"></div>
        </oas-card>
      </div>

      <oas-drawer data-testid="menu-form-drawer" id="menu-form-drawer" title="${t('menus.new')}" placement="right" size="medium" no-footer>
        <oas-form id="menu-form" rules='${RULES()}'>
          <div class="menu-form-body">
            <div class="form-field">
              <label class="form-label" for="mf-name">${t('menus.form.name')} <span class="req">*</span></label>
              <oas-input id="mf-name" data-testid="mf-name" name="name" placeholder="${t('menus.rule.name')}"></oas-input>
            </div>
            <div class="form-field">
              <div class="form-label">${t('menus.form.type')}</div>
              <div class="radio-group inline" id="mf-type">
                <oas-radio name="menuType" value="M"><span class="radio-label">${t('menus.type.M')}</span></oas-radio>
                <oas-radio name="menuType" value="C"><span class="radio-label">${t('menus.type.C')}</span></oas-radio>
                <oas-radio name="menuType" value="F"><span class="radio-label">${t('menus.type.F')}</span></oas-radio>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label" for="mf-parent">${t('menus.form.parent')}</label>
              <oas-tree-select data-testid="mf-parent" id="mf-parent" placeholder="${t('menus.placeholder.top')}" options="[]" value="0"></oas-tree-select>
            </div>
            <div class="form-field">
              <label class="form-label" for="mf-perms">${t('menus.form.perms')} <span class="form-hint-inline" id="mf-perms-hint"></span></label>
              <oas-input id="mf-perms" data-testid="mf-perms" name="perms" placeholder="${t('menus.placeholder.perms')}"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label" for="mf-path">${t('menus.form.path')} <span class="req" id="mf-path-req"></span></label>
              <oas-input id="mf-path" data-testid="mf-path" name="path" placeholder="${t('menus.placeholder.path')}"></oas-input>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="mf-cancel">${t('common.cancel')}</oas-button>
                <oas-button data-testid="mf-save" type="primary">${t('common.save')}</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>`

  const tree = el.querySelector('[data-testid="menu-tree"]')
  const detailEl = el.querySelector('#menu-detail')
  const drawer = el.querySelector('[data-testid="menu-form-drawer"]')
  const form = el.querySelector('#menu-form')
  const typeGroup = el.querySelector('#mf-type')
  const parentSelect = el.querySelector('[data-testid="mf-parent"]')
  const permsInput = el.querySelector('[data-testid="mf-perms"]')
  const pathInput = el.querySelector('[data-testid="mf-path"]')
  const permsHint = el.querySelector('#mf-perms-hint')
  const pathReq = el.querySelector('#mf-path-req')

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
    // expanded 契约：JSON 字符串数组（oas-ui 2.5.0）
    parentSelect.setAttribute('expanded', JSON.stringify(expandKeys(state.tree)))
  }

  function renderTree() {
    tree.setAttribute('data', JSON.stringify(toMenuTreeNodes(state.tree)))
    tree.setAttribute('expanded', JSON.stringify(expandKeys(state.tree)))
    if (state.selectedId != null) tree.setAttribute('selected', String(state.selectedId))
    else tree.removeAttribute('selected')
  }

  function nextId() {
    const all = flattenTree(state.tree)
    return all.reduce((m, n) => Math.max(m, n.id), 0) + 1
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
        <oas-tag type="${TYPE_TAG[node.type]}">${t(`menus.type.${node.type}`)}</oas-tag>
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
    el.querySelector('[data-testid="mf-name"]').setAttribute('value', node?.title ?? '')
    setTypeRadio(state.formType)
    parentSelect.setAttribute('value', String(parent?.id ?? 0))
    permsInput.setAttribute('value', node?.perms ?? '')
    pathInput.setAttribute('value', node?.path ?? '')
    syncMenuType()
    drawer.setAttribute('title', node ? t('menus.editMenu', { title: node.title }) : t('menus.new'))
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

  async function init() {
    state.tree = await treeMenus()
    // stale 守卫：等待期间导航离开后 el 已脱离文档，续体渲染只会写入陈旧 DOM，直接放弃
    if (!el.isConnected) return
    buildParentOptions()
    state.selectedId = state.tree[0]?.id ?? null
    renderTree()
    renderDetail()
  }

  tree.addEventListener('oas-select', (e) => {
    state.selectedId = Number(e.detail.key)
    renderDetail()
  })

  // vanilla 同款事件名（node-render），emit 实际派发 oas-node-render——vanilla 死代码怪癖，保持不修
  tree.addEventListener('node-render', (e) => {
    const { node, element } = e.detail
    element.querySelector('.tree-type-icon')?.setAttribute('name', TYPE_ICON[node.type] ?? '')
    const tag = element.querySelector('.tree-type-tag')
    if (tag) {
      tag.textContent = node.type
      tag.setAttribute('type', TYPE_TAG[node.type] ?? 'default')
    }
  })

  el.querySelector('[data-testid="menu-create"]').addEventListener('click', () => {
    openForm(null)
  })

  el.querySelector('[data-testid="mf-cancel"]').addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector('[data-testid="mf-save"]').addEventListener('click', () => {
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

  pathInput.addEventListener('oas-input', (e) => {
    if (state.formType !== 'C') return
    const cur = permsInput.getAttribute('value') ?? ''
    if (!cur) {
      const auto = autoPerms('C', e.detail.value)
      if (auto) permsInput.setAttribute('value', auto)
    }
  })

  form.addEventListener('oas-submit', (e) => {
    const values = e.detail.values
    const name = values.name?.trim()
    if (!name) return
    const type = state.formType
    const parentRaw = parentSelect.getAttribute('value') || '0'
    const parentId = parentRaw === '0' ? null : Number(parentRaw)
    const perms = (permsInput.getAttribute('value') ?? '').trim()
    const path = (pathInput.getAttribute('value') ?? '').trim()

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

  function refreshText() {
    document.title = `${t('nav.menus')} · ${t('app.title')}`
    el.querySelector('h1.page-title').textContent = t('nav.menus')
    el.querySelector('p.page-subtitle').textContent = t('menus.subtitle')
    el.querySelector('[data-testid="menu-create"]').textContent = t('menus.new')
    el.querySelector('.menu-tree-card').setAttribute('title', t('menus.treeTitle'))
    el.querySelector('.menu-detail-card').setAttribute('title', t('menus.detailTitle'))
    // 抽屉表单：标题随新建/编辑态 + 字段 label/占位/类型单选/规则/按钮
    const editingNode = state.editingId == null ? null : findNode(state.tree, state.editingId)
    drawer.setAttribute(
      'title',
      editingNode ? t('menus.editMenu', { title: editingNode.title }) : t('menus.new'),
    )
    const LABEL_KEYS = [
      'menus.form.name',
      'menus.form.type',
      'menus.form.parent',
      'menus.form.perms',
      'menus.form.path',
    ]
    el.querySelectorAll('#menu-form .form-field > .form-label').forEach((n, i) => {
      const k = LABEL_KEYS[i]
      if (!k) return
      const req = n.querySelector('.req')
      const hint = n.querySelector('.form-hint-inline')
      n.textContent = t(k)
      if (hint) n.append(' ', hint)
      if (req) n.append(' ', req)
    })
    el.querySelector('[data-testid="mf-name"]').setAttribute('placeholder', t('menus.rule.name'))
    parentSelect.setAttribute('placeholder', t('menus.placeholder.top'))
    permsInput.setAttribute('placeholder', t('menus.placeholder.perms'))
    pathInput.setAttribute('placeholder', t('menus.placeholder.path'))
    el.querySelectorAll('#mf-type .radio-label').forEach((n, i) => {
      n.textContent = t(`menus.type.${['M', 'C', 'F'][i] ?? 'C'}`)
    })
    form.setAttribute('rules', RULES())
    el.querySelector('[data-testid="mf-cancel"]').textContent = t('common.cancel')
    el.querySelector('[data-testid="mf-save"]').textContent = t('common.save')
    syncMenuType()
    // 详情区（空态/描述/类型标签/按钮文案）随语言重渲；选中态由内部状态恢复
    renderDetail()
  }

  document.title = `${t('nav.menus')} · ${t('app.title')}`
  init()
  return onLocaleChange(refreshText)
}
