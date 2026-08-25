import { message } from '@oas-ui/ui/feedback/message'
import { createDept, listDepts, removeDept, treeDepts, updateDept } from '../data/system'
import type { DeptNode, DeptTree } from '../data/system'
import '../styles/pages/dept.css'

interface DeptTreeNode {
  key: string
  label: string
  children: DeptTreeNode[]
  members: number
}

interface PageState {
  tree: DeptTree[]
  flat: DeptNode[]
  selectedId: number | null
  editingId: number | null
}

function findNode(nodes: DeptTree[], id: number): DeptTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

function descendants(nodes: DeptTree[], id: number): Set<number> {
  const set = new Set<number>()
  const node = findNode(nodes, id)
  const walk = (list: DeptTree[]) => {
    for (const n of list) {
      set.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  if (node) walk(node.children ?? [])
  return set
}

function flatten(nodes: DeptTree[]): DeptNode[] {
  const out: DeptNode[] = []
  const walk = (list: DeptTree[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function toTreeNodes(nodes: DeptTree[]): DeptTreeNode[] {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.name,
    members: n.members,
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

function expandKeys(nodes: DeptTree[]): string[] {
  const keys: string[] = []
  const walk = (list: DeptTree[]) => {
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

function buildParentOptions(
  nodes: DeptTree[],
  excludeId: number | null,
): Array<Record<string, unknown>> {
  const toOpt = (list: DeptTree[]): Array<Record<string, unknown>> =>
    list.map((n) => ({
      value: String(n.id),
      label: n.name,
      children: n.children?.length ? toOpt(n.children) : undefined,
    }))
  let filtered = nodes
  if (excludeId != null) {
    const excluded = descendants(nodes, excludeId)
    excluded.add(excludeId)
    filtered = nodes.map((n) => prune(n, excluded)).filter((n): n is DeptTree => n !== null)
  }
  return [{ value: '0', label: '顶级', children: toOpt(filtered) }]
}

function prune(node: DeptTree, excluded: Set<number>): DeptTree | null {
  if (excluded.has(node.id)) return null
  const children = (node.children ?? [])
    .map((c) => prune(c, excluded))
    .filter((c): c is DeptTree => c !== null)
  return { ...node, children }
}

export function render(el: HTMLElement): () => void {
  const state: PageState = {
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
          <h1 class="page-title">部门管理</h1>
          <p class="page-subtitle">维护组织架构与部门树</p>
        </div>
        <oas-button data-testid="dept-create" type="primary" icon="plus">新建部门</oas-button>
      </div>
      <div class="dept-layout">
        <oas-card class="dept-tree-card" title="部门树">
          <oas-tree data-testid="dept-tree" id="dept-tree" data="[]" expanded="">
            <template slot="node">
              <span class="tree-node-label">
                <span data-node-label></span>
                <span class="dept-member-badge"></span>
              </span>
            </template>
          </oas-tree>
        </oas-card>
        <oas-card class="dept-detail-card" title="部门详情">
          <div id="dept-detail" class="dept-detail"></div>
        </oas-card>
      </div>

      <oas-drawer data-testid="dept-form-drawer" id="dept-form-drawer" title="新建部门" placement="right" size="medium" no-footer>
        <oas-form id="dept-form" rules='{"name":[{"required":true,"message":"请输入部门名称"}]}'>
          <div class="dept-form-body">
            <div class="form-field">
              <label class="form-label">部门名称 <span class="req">*</span></label>
              <oas-input data-testid="df-name" name="name" placeholder="请输入部门名称"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">上级部门</label>
              <oas-tree-select data-testid="df-parent" id="df-parent" placeholder="顶级部门" options="[]" value="0"></oas-tree-select>
            </div>
            <div class="form-field">
              <label class="form-label">成员数</label>
              <oas-input-number data-testid="df-members" name="members" min="0" placeholder="0"></oas-input-number>
            </div>
            <div class="form-actions">
              <oas-space justify="end">
                <oas-button data-testid="df-cancel">取消</oas-button>
                <oas-button data-testid="df-save" type="primary">保存</oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>`

  const tree = el.querySelector<HTMLElement>('[data-testid="dept-tree"]')!
  const detailEl = el.querySelector<HTMLElement>('#dept-detail')!
  const drawer = el.querySelector<HTMLElement>('[data-testid="dept-form-drawer"]')!
  const form = el.querySelector<HTMLElement>('#dept-form')!
  const parentSelect = el.querySelector<HTMLElement>('[data-testid="df-parent"]')!

  function renderTree(): void {
    tree.setAttribute('data', JSON.stringify(toTreeNodes(state.tree)))
    tree.setAttribute('expanded', expandKeys(state.tree).join(','))
    if (state.selectedId != null) tree.setAttribute('selected', String(state.selectedId))
    else tree.removeAttribute('selected')
  }

  function memberCountOf(id: number): number {
    return state.flat.find((d) => d.id === id)?.members ?? 0
  }

  function renderSubTable(node: DeptTree): void {
    const children = node.children ?? []
    if (children.length === 0) {
      detailEl.querySelector<HTMLElement>('#dept-sub')!.innerHTML =
        `<div class="sub-dept-empty">暂无子部门</div>`
      return
    }
    const tbody = detailEl.querySelector<HTMLElement>('#dept-sub-body')!
    tbody.innerHTML = children
      .map(
        (c) => `<tr data-id="${c.id}">
          <td>${c.name}</td>
          <td class="num-cell mono">${c.members}</td>
          <td class="action-cell">
            <oas-button size="small" type="text" data-edit="${c.id}">编辑</oas-button>
            <oas-popconfirm title="确认删除该部门？" data-del="${c.id}">
              <oas-button size="small" type="danger">删除</oas-button>
            </oas-popconfirm>
          </td>
        </tr>`,
      )
      .join('')
    detailEl.querySelector<HTMLElement>('#dept-sub')!.hidden = false
    tbody.querySelectorAll<HTMLElement>('oas-button[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = Number(btn.getAttribute('data-edit'))
        const row = state.flat.find((d) => d.id === id)
        if (row) openForm(row)
      })
    })
    detailEl.querySelectorAll<HTMLElement>('oas-popconfirm[data-del]').forEach((pc) => {
      pc.addEventListener('oas-ok', async (e) => {
        e.stopPropagation()
        const id = Number(pc.getAttribute('data-del'))
        await doDelete(id)
      })
    })
  }

  function renderDetail(): void {
    const node = state.selectedId == null ? null : findNode(state.tree, state.selectedId)
    if (!node) {
      detailEl.innerHTML = `<oas-empty description="请选择左侧部门节点"></oas-empty>`
      return
    }
    detailEl.innerHTML = `
      <div class="dept-detail-head">
        <div class="dept-detail-title">${node.name}</div>
        <oas-tag type="primary" data-testid="dept-detail-members">${node.members} 人</oas-tag>
      </div>
      <oas-descriptions column="1">
        <oas-descriptions-item label="部门 ID"><span class="mono">${node.id}</span></oas-descriptions-item>
        <oas-descriptions-item label="上级部门"><span class="mono">${node.parentId == null ? '—' : node.parentId}</span></oas-descriptions-item>
        <oas-descriptions-item label="子部门数"><span class="mono">${(node.children ?? []).length}</span></oas-descriptions-item>
      </oas-descriptions>
      <div class="dept-detail-actions">
        <oas-button data-md-action="edit" type="primary">编辑</oas-button>
        <oas-button data-md-action="child">新增子部门</oas-button>
        <oas-popconfirm title="确认删除该部门？" id="md-del-pop">
          <oas-button data-md-action="delete" type="danger">删除</oas-button>
        </oas-popconfirm>
      </div>
      <div class="dept-detail-sub">
        <div class="dept-detail-sub-title">子部门</div>
        <div id="dept-sub">
          <table class="sub-dept-table" data-testid="dept-sub-table">
            <thead>
              <tr><th>名称</th><th class="num">成员数</th><th>操作</th></tr>
            </thead>
            <tbody id="dept-sub-body"></tbody>
          </table>
        </div>
      </div>`
    detailEl
      .querySelector<HTMLElement>('[data-md-action="edit"]')!
      .addEventListener('click', () => openForm(node))
    detailEl
      .querySelector<HTMLElement>('[data-md-action="child"]')!
      .addEventListener('click', () => openForm(null, node))
    detailEl.querySelector<HTMLElement>('#md-del-pop')!.addEventListener('oas-ok', () => {
      void doDelete(node.id)
    })
    renderSubTable(node)
  }

  async function doDelete(id: number): Promise<void> {
    const node = findNode(state.tree, id)
    if (!node) {
      message.error('该部门已不存在')
      return
    }
    if ((node.children ?? []).length > 0) {
      message.error('存在子部门，请先删除子级')
      return
    }
    const ok = await removeDept(id)
    if (!ok) {
      message.error('该部门已不存在')
      return
    }
    message.success('已删除')
    state.selectedId = null
    void refresh()
  }

  function refreshParentOptions(excludeId: number | null): void {
    parentSelect.setAttribute('options', JSON.stringify(buildParentOptions(state.tree, excludeId)))
    const expanded = expandKeys(state.tree)
    parentSelect.setAttribute('expanded', JSON.stringify(expanded))
  }

  function fillForm(node: DeptNode | null, parent?: DeptTree): void {
    state.editingId = node?.id ?? null
    el.querySelector<HTMLElement>('[data-testid="df-name"]')!.setAttribute(
      'value',
      node?.name ?? '',
    )
    el.querySelector<HTMLElement>('[data-testid="df-members"]')!.setAttribute(
      'value',
      node ? String(node.members) : '0',
    )
    const pid = node?.parentId ?? parent?.id ?? null
    parentSelect.setAttribute('value', String(pid ?? 0))
    refreshParentOptions(node?.id ?? null)
    drawer.setAttribute('title', node ? `编辑部门：${node.name}` : '新建部门')
  }

  function openForm(node: DeptNode | null, parent?: DeptTree): void {
    fillForm(node, parent)
    drawer.setAttribute('visible', '')
  }

  async function refresh(): Promise<void> {
    const [rows, tree] = await Promise.all([listDepts(), treeDepts()])
    state.tree = tree
    state.flat = rows
    if (state.selectedId == null || !findNode(state.tree, state.selectedId)) {
      state.selectedId = state.tree[0]?.id ?? null
    }
    renderTree()
    renderDetail()
  }

  tree.addEventListener('oas-node-render', (e) => {
    const { node, element } = (e as CustomEvent<{ node: DeptTreeNode; element: HTMLElement }>)
      .detail
    const badge = element.querySelector<HTMLElement>('.dept-member-badge')
    if (badge) badge.textContent = String(node.members)
  })

  tree.addEventListener('oas-select', (e) => {
    state.selectedId = Number((e as CustomEvent<{ key: string }>).detail.key)
    renderTree()
    renderDetail()
  })

  el.querySelector<HTMLElement>('[data-testid="dept-create"]')!.addEventListener('click', () => {
    openForm(null)
  })

  el.querySelector<HTMLElement>('[data-testid="df-cancel"]')!.addEventListener('click', () => {
    drawer.removeAttribute('visible')
  })

  el.querySelector<HTMLElement>('[data-testid="df-save"]')!.addEventListener('click', () => {
    ;(form.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  })

  form.addEventListener('oas-submit', async (e) => {
    if (saving) return
    saving = true
    try {
      const values = (e as CustomEvent<{ values: { name: string; members: string } }>).detail.values
      const name = values.name?.trim()
      if (!name) return
      const parentRaw = parentSelect.getAttribute('value') || '0'
      const parentId = parentRaw === '0' ? null : Number(parentRaw)
      const members = Number(values.members) || 0
      if (state.editingId != null && parentId === state.editingId) {
        message.error('上级部门不能选择自身')
        return
      }
      if (state.editingId == null) {
        await createDept({ name, parentId, members })
        message.success('已创建')
      } else {
        const updated = await updateDept(state.editingId, { name, parentId, members })
        if (!updated) message.error('该部门已不存在')
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
