import { message } from '@oas-ui/ui/feedback/message'
import { treeMenus } from '../data/system'
import type { MenuTree, MenuType } from '../data/system'

const TYPE_TAG: Record<MenuType, string> = { M: 'default', C: 'primary', F: 'warning' }
const TYPE_ICON: Record<MenuType, string> = { M: 'more', C: 'menu', F: 'edit' }
const TYPE_LABEL: Record<MenuType, string> = { M: '目录', C: '菜单', F: '按钮' }
const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

interface PageState {
  tree: MenuTree[]
  selectedId: number | null
  editingId: number | null
  formType: MenuType
}

function flattenTree(nodes: MenuTree[]): MenuTree[] {
  const out: MenuTree[] = []
  const walk = (list: MenuTree[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function findNode(nodes: MenuTree[], id: number): MenuTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

function parentOf(nodes: MenuTree[], id: number): number | null {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n.id
    if (n.children?.length) {
      const p = parentOf(n.children, id)
      if (p !== null) return p
    }
  }
  return null
}

function removeNode(nodes: MenuTree[], id: number): boolean {
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

function descendants(nodes: MenuTree[], id: number): Set<number> {
  const set = new Set<number>()
  const node = findNode(nodes, id)
  const walk = (list: MenuTree[]) => {
    for (const n of list) {
      set.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  if (node) walk(node.children ?? [])
  return set
}

function toTreeNodes(nodes: MenuTree[]): Array<Record<string, unknown>> {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.title,
    type: n.type,
    perms: n.perms ?? '',
    path: n.path ?? '',
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

function autoPerms(type: MenuType, path: string): string {
  if (type !== 'C') return ''
  const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
  const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return mod ? `${mod}:list` : ''
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
    tree: [],
    selectedId: null,
    editingId: null,
    formType: 'C',
  }

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">权限管理</h1>
          <p class="page-subtitle">维护菜单结构与权限标识</p>
        </div>
        <oas-button data-testid="menu-create" type="primary" icon="plus">新增菜单</oas-button>
      </div>
      <div class="menu-layout">
        <oas-card class="menu-tree-card" title="权限树">
          <oas-tree data-testid="menu-tree" id="menu-tree" data="[]" expanded="" selected=""></oas-tree>
        </oas-card>
        <oas-card class="menu-detail-card" title="菜单详情">
          <div id="menu-detail" class="menu-detail"></div>
        </oas-card>
      </div>

      <oas-drawer data-testid="menu-form-drawer" id="menu-form-drawer" title="新增菜单" placement="right" size="medium" no-footer>
        <oas-form id="menu-form" rules='{"name":[{"required":true,"message":"请输入菜单名称"}]}'>
          <div class="menu-form-body">
            <div class="form-field">
              <label class="form-label">菜单名称 <span class="req">*</span></label>
              <oas-input data-testid="mf-name" name="name" placeholder="请输入菜单名称"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">类型</label>
              <div class="radio-group inline" id="mf-type">
                <oas-radio name="menuType" value="M"><span class="radio-label">${TYPE_LABEL.M}</span></oas-radio>
                <oas-radio name="menuType" value="C"><span class="radio-label">${TYPE_LABEL.C}</span></oas-radio>
                <oas-radio name="menuType" value="F"><span class="radio-label">${TYPE_LABEL.F}</span></oas-radio>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">上级菜单</label>
              <oas-tree-select data-testid="mf-parent" id="mf-parent" placeholder="顶级菜单" options="[]" value="0"></oas-tree-select>
            </div>
            <div class="form-field">
              <label class="form-label">权限标识 <span class="form-hint-inline" id="mf-perms-hint"></span></label>
              <oas-input data-testid="mf-perms" name="perms" placeholder="如 system:user:add"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">路由路径 <span class="req" id="mf-path-req"></span></label>
              <oas-input data-testid="mf-path" name="path" placeholder="如 /system/users"></oas-input>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="mf-cancel">取消</oas-button>
                <oas-button data-testid="mf-save" type="primary">保存</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>`

  const tree = el.querySelector<HTMLElement>('[data-testid="menu-tree"]')!
  const detailEl = el.querySelector<HTMLElement>('#menu-detail')!
  const drawer = el.querySelector<HTMLElement>('[data-testid="menu-form-drawer"]')!
  const form = el.querySelector<HTMLElement>('#menu-form')!
  const typeGroup = el.querySelector<HTMLElement>('#mf-type')!
  const parentSelect = el.querySelector<HTMLElement>('[data-testid="mf-parent"]')!
  const permsInput = el.querySelector<HTMLElement>('[data-testid="mf-perms"]')!
  const pathInput = el.querySelector<HTMLElement>('[data-testid="mf-path"]')!
  const permsHint = el.querySelector<HTMLElement>('#mf-perms-hint')!
  const pathReq = el.querySelector<HTMLElement>('#mf-path-req')!

  function expandKeys(): string[] {
    const keys: string[] = []
    const walk = (list: MenuTree[]) => {
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

  function buildParentOptions(): void {
    const toOpt = (list: MenuTree[]): Array<Record<string, unknown>> =>
      list.map((n) => ({
        value: String(n.id),
        label: n.title,
        children: n.children?.length ? toOpt(n.children) : undefined,
      }))
    parentSelect.setAttribute(
      'options',
      JSON.stringify([{ value: '0', label: '顶级', children: toOpt(state.tree) }]),
    )
    parentSelect.setAttribute('expanded', JSON.stringify(expandKeys()))
  }

  function renderTree(): void {
    const expanded = expandKeys()
    tree.setAttribute('data', JSON.stringify(toTreeNodes(state.tree)))
    tree.setAttribute('expanded', expanded.join(','))
    if (state.selectedId != null) tree.setAttribute('selected', String(state.selectedId))
    else tree.removeAttribute('selected')
  }

  function nextId(): number {
    const all = flattenTree(state.tree)
    return all.reduce((m, n) => Math.max(m, n.id), 0) + 1
  }

  function renderDetail(): void {
    const node = state.selectedId == null ? null : findNode(state.tree, state.selectedId)
    if (!node) {
      detailEl.innerHTML = `<oas-empty description="请选择左侧菜单节点"></oas-empty>`
      return
    }
    detailEl.innerHTML = `
      <div class="menu-detail-head">
        <div class="menu-detail-title">${node.title}</div>
        <oas-tag type="${TYPE_TAG[node.type]}">${TYPE_LABEL[node.type]}</oas-tag>
      </div>
      <oas-descriptions column="1">
        <oas-descriptions-item label="类型"><span class="mono">${node.type}</span></oas-descriptions-item>
        <oas-descriptions-item label="权限标识"><span class="mono" data-testid="menu-detail-perms">${node.perms ?? '—'}</span></oas-descriptions-item>
        <oas-descriptions-item label="路由路径"><span class="mono">${node.path ?? '—'}</span></oas-descriptions-item>
        <oas-descriptions-item label="子级数"><span class="mono">${(node.children ?? []).length}</span></oas-descriptions-item>
      </oas-descriptions>
      <div class="menu-detail-actions">
        <oas-button data-md-action="edit" type="primary">编辑</oas-button>
        <oas-button data-md-action="child">新增子级</oas-button>
        <oas-popconfirm title="确认删除该菜单？" id="md-del-pop">
          <oas-button data-md-action="delete" type="danger">删除</oas-button>
        </oas-popconfirm>
      </div>`
    detailEl
      .querySelector<HTMLElement>('[data-md-action="edit"]')!
      .addEventListener('click', () => {
        openForm(node)
      })
    detailEl
      .querySelector<HTMLElement>('[data-md-action="child"]')!
      .addEventListener('click', () => {
        openForm(null, node)
      })
    detailEl.querySelector<HTMLElement>('#md-del-pop')!.addEventListener('oas-ok', () => {
      if ((node.children ?? []).length > 0) {
        message.error('存在子菜单，请先删除子级')
        return
      }
      removeNode(state.tree, node.id)
      message.success('已删除')
      state.selectedId = null
      renderTree()
      renderDetail()
    })
  }

  function setTypeRadio(type: MenuType): void {
    typeGroup.querySelectorAll<HTMLElement>('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === type) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
  }

  function syncMenuType(): void {
    if (state.formType === 'C') {
      permsHint.textContent = '自动 模块:list'
      pathReq.textContent = '*'
      const cur = permsInput.getAttribute('value') ?? ''
      if (!cur) {
        const auto = autoPerms('C', pathInput.getAttribute('value') ?? '')
        if (auto) permsInput.setAttribute('value', auto)
      }
    } else if (state.formType === 'M') {
      permsHint.textContent = '目录无权限标识'
      pathReq.textContent = ''
    } else {
      permsHint.textContent = '必填'
      pathReq.textContent = ''
    }
  }

  function fillMenuForm(node: MenuTree | null, parent: MenuTree | null): void {
    state.editingId = node?.id ?? null
    state.formType = node?.type ?? 'C'
    el.querySelector<HTMLElement>('[data-testid="mf-name"]')!.setAttribute(
      'value',
      node?.title ?? '',
    )
    setTypeRadio(state.formType)
    parentSelect.setAttribute('value', String(parent?.id ?? 0))
    permsInput.setAttribute('value', node?.perms ?? '')
    pathInput.setAttribute('value', node?.path ?? '')
    syncMenuType()
    drawer.setAttribute('title', node ? `编辑菜单：${node.title}` : '新增菜单')
  }

  function openForm(node: MenuTree | null, parentOverride?: MenuTree): void {
    if (node) {
      const pid = parentOf(state.tree, node.id)
      fillMenuForm(node, pid == null ? null : findNode(state.tree, pid))
    } else {
      fillMenuForm(null, parentOverride ?? null)
    }
    drawer.setAttribute('visible', '')
  }

  async function init(): Promise<void> {
    state.tree = await treeMenus()
    buildParentOptions()
    state.selectedId = state.tree[0]?.id ?? null
    renderTree()
    renderDetail()
  }

  tree.addEventListener('oas-select', (e) => {
    const key = (e as CustomEvent<{ key: string }>).detail.key
    state.selectedId = Number(key)
    renderDetail()
  })

  tree.addEventListener('node-render', (e) => {
    const { node, element } = (e as CustomEvent<{ node: { type: MenuType }; element: HTMLElement }>)
      .detail
    element
      .querySelector<HTMLElement>('.tree-type-icon')
      ?.setAttribute('name', TYPE_ICON[node.type] ?? '')
    const tag = element.querySelector<HTMLElement>('.tree-type-tag')
    if (tag) {
      tag.textContent = node.type
      tag.setAttribute('type', TYPE_TAG[node.type] ?? 'default')
    }
  })

  el.querySelector<HTMLElement>('[data-testid="menu-create"]')!.addEventListener('click', () => {
    openForm(null)
  })

  el.querySelector<HTMLElement>('[data-testid="mf-cancel"]')!.addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector<HTMLElement>('[data-testid="mf-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  typeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0] as HTMLElement
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
      const auto = autoPerms('C', (e as CustomEvent<{ value: string }>).detail.value)
      if (auto) permsInput.setAttribute('value', auto)
    }
  })

  form.addEventListener('oas-submit', (e) => {
    const values = (e as CustomEvent<{ values: { name: string } }>).detail.values
    const name = values.name?.trim()
    if (!name) return
    const type = state.formType
    const parentRaw = parentSelect.getAttribute('value') || '0'
    const parentId = parentRaw === '0' ? null : Number(parentRaw)
    const perms = (permsInput.getAttribute('value') ?? '').trim()
    const path = (pathInput.getAttribute('value') ?? '').trim()

    if (type === 'F') {
      if (!perms) {
        message.error('按钮类型需填写权限标识')
        return
      }
      if (!PERM_RE.test(perms)) {
        message.error('权限标识格式不正确')
        return
      }
    } else if (type === 'C') {
      if (!path) {
        message.error('菜单类型需填写路由路径')
        return
      }
    }

    if (state.editingId != null && parentId != null) {
      const desc = descendants(state.tree, state.editingId)
      if (parentId === state.editingId || desc.has(parentId)) {
        message.error('上级菜单不能选择自身或其子级')
        return
      }
    }

    const finalPerms = type === 'C' ? perms || autoPerms('C', path) : perms || undefined

    if (state.editingId != null) {
      const node = findNode(state.tree, state.editingId)
      if (!node) {
        message.error('该菜单已不存在')
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
      message.success('已保存')
    } else {
      const newNode: MenuTree = {
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
      message.success('已创建')
    }
    drawer.removeAttribute('visible')
    buildParentOptions()
    renderTree()
    renderDetail()
  })

  void init()
  return () => {}
}

function insertChild(nodes: MenuTree[], parentId: number | null, child: MenuTree): void {
  if (parentId == null) {
    nodes.push(child)
    return
  }
  const parent = findNode(nodes, parentId)
  if (parent) {
    ;(parent.children ??= []).push(child)
  }
}
