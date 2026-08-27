import { message } from '@oas-ui/ui/feedback/message'
import type { OASTable, TableColumn } from '@oas-ui/ui/data/table'
import { t } from '../i18n'
import { createDept, listDepts, removeDept, treeDepts, updateDept } from '../data/system'
import type { DeptNode, DeptTree } from '../data/system'
import '../styles/pages/dept.css'

const RULES = (): string =>
  JSON.stringify({ name: [{ required: true, message: t('dept.rule.name') }] })

function subActionCell(node: DeptTree): HTMLElement {
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

const SUB_COLUMNS = (): TableColumn[] => [
  { key: 'name', title: t('dept.th.name') },
  { key: 'members', title: t('dept.th.members'), align: 'right' },
  {
    key: 'action',
    title: t('dept.th.action'),
    render: (r) => subActionCell(r as unknown as DeptTree),
  },
]

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
  return [{ value: '0', label: t('dept.option.top'), children: toOpt(filtered) }]
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
          <h1 class="page-title">${t('nav.dept')}</h1>
          <p class="page-subtitle">${t('dept.subtitle')}</p>
        </div>
        <oas-button data-testid="dept-create" type="primary" icon="plus">${t('dept.new')}</oas-button>
      </div>
      <div class="dept-layout">
        <oas-card class="dept-tree-card" title="${t('dept.treeTitle')}">
          <oas-tree data-testid="dept-tree" id="dept-tree" data="[]" expanded="">
            <template slot="node">
              <span class="tree-node-label">
                <span data-node-label></span>
                <span class="dept-member-badge"></span>
              </span>
            </template>
          </oas-tree>
        </oas-card>
        <oas-card class="dept-detail-card" title="${t('dept.detailTitle')}">
          <div id="dept-detail" class="dept-detail"></div>
        </oas-card>
      </div>

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
        `<div class="sub-dept-empty">${t('dept.empty.noChildren')}</div>`
      return
    }
    const sub = detailEl.querySelector<OASTable>('[data-testid="dept-sub-table"]')!
    sub.columns = SUB_COLUMNS()
    sub.setAttribute('data', JSON.stringify(children))
    detailEl.querySelector<HTMLElement>('#dept-sub')!.hidden = false
  }

  function onSubClick(e: Event): void {
    e.stopPropagation()
    const path = e.composedPath() as HTMLElement[]
    const editBtn = path.find((n) => n.matches?.('[data-edit]'))
    if (editBtn) {
      const id = Number(editBtn.getAttribute('data-edit'))
      const row = state.flat.find((d) => d.id === id)
      if (row) openForm(row)
      return
    }
    // v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open
  }

  function onSubDelete(e: Event): void {
    // v2.2.8 起 popconfirm 的 ok/cancel 事件带 detail.source，直接反查来源
    const pc = (e as CustomEvent<{ source: HTMLElement }>).detail.source
    if (!pc?.hasAttribute?.('data-del')) return
    const id = Number(pc.getAttribute('data-del'))
    void doDelete(id)
  }

  function renderDetail(): void {
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
      message.error(t('dept.notFound'))
      return
    }
    if ((node.children ?? []).length > 0) {
      message.error(t('dept.hasChildren'))
      return
    }
    const ok = await removeDept(id)
    if (!ok) {
      message.error(t('dept.notFound'))
      return
    }
    message.success(t('common.deleted'))
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
    drawer.setAttribute('title', node ? t('dept.editDept', { name: node.name }) : t('dept.new'))
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
        message.error(t('dept.err.parentSelf'))
        return
      }
      if (state.editingId == null) {
        await createDept({ name, parentId, members })
        message.success(t('common.created'))
      } else {
        const updated = await updateDept(state.editingId, { name, parentId, members })
        if (!updated) message.error(t('dept.notFound'))
        else message.success(t('common.saved'))
      }
      drawer.removeAttribute('visible')
      void refresh()
    } finally {
      saving = false
    }
  })

  detailEl.addEventListener('click', onSubClick)
  detailEl.addEventListener('oas-ok', onSubDelete)

  void refresh()
  return () => {}
}
