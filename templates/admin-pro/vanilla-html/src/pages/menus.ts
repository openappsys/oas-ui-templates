import { message } from '@oas-ui/ui/feedback/message'
import { t } from '../i18n'
import { treeMenus } from '../data/system'
import type { MenuTree, MenuType } from '../data/system'

const TYPE_TAG: Record<MenuType, string> = { M: 'default', C: 'primary', F: 'warning' }
const TYPE_ICON: Record<MenuType, string> = { M: 'more', C: 'menu', F: 'edit' }
function typeLabel(type: MenuType): string {
  return t(`menus.type.${type}`)
}
const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

const RULES = (): string =>
  JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] })

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
              <label class="form-label">${t('menus.form.name')} <span class="req">*</span></label>
              <oas-input data-testid="mf-name" name="name" placeholder="${t('menus.rule.name')}"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">${t('menus.form.type')}</label>
              <div class="radio-group inline" id="mf-type">
                <oas-radio name="menuType" value="M"><span class="radio-label">${typeLabel('M')}</span></oas-radio>
                <oas-radio name="menuType" value="C"><span class="radio-label">${typeLabel('C')}</span></oas-radio>
                <oas-radio name="menuType" value="F"><span class="radio-label">${typeLabel('F')}</span></oas-radio>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label">${t('menus.form.parent')}</label>
              <oas-tree-select data-testid="mf-parent" id="mf-parent" placeholder="${t('menus.placeholder.top')}" options="[]" value="0"></oas-tree-select>
            </div>
            <div class="form-field">
              <label class="form-label">${t('menus.form.perms')} <span class="form-hint-inline" id="mf-perms-hint"></span></label>
              <oas-input data-testid="mf-perms" name="perms" placeholder="${t('menus.placeholder.perms')}"></oas-input>
            </div>
            <div class="form-field">
              <label class="form-label">${t('menus.form.path')} <span class="req" id="mf-path-req"></span></label>
              <oas-input data-testid="mf-path" name="path" placeholder="${t('menus.placeholder.path')}"></oas-input>
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
      JSON.stringify([{ value: '0', label: t('menus.option.top'), children: toOpt(state.tree) }]),
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
        message.error(t('menus.hasChildren'))
        return
      }
      removeNode(state.tree, node.id)
      message.success(t('common.deleted'))
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
    drawer.setAttribute(
      'title',
      node ? t('menus.editMenu', { title: node.title }) : t('menus.new'),
    )
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
        message.error(t('menus.err.permRequired'))
        return
      }
      if (!PERM_RE.test(perms)) {
        message.error(t('menus.err.permFormat'))
        return
      }
    } else if (type === 'C') {
      if (!path) {
        message.error(t('menus.err.pathRequired'))
        return
      }
    }

    if (state.editingId != null && parentId != null) {
      const desc = descendants(state.tree, state.editingId)
      if (parentId === state.editingId || desc.has(parentId)) {
        message.error(t('menus.err.parentInvalid'))
        return
      }
    }

    const finalPerms = type === 'C' ? perms || autoPerms('C', path) : perms || undefined

    if (state.editingId != null) {
      const node = findNode(state.tree, state.editingId)
      if (!node) {
        message.error(t('menus.notFound'))
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
      message.success(t('common.saved'))
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
      message.success(t('common.created'))
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
