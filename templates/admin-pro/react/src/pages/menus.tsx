// src/pages/menus.tsx —— 权限管理（左树右详情 + 抽屉表单，纯内存树）
//    刷文案）；本模版声明式——tree/selectedId/editingId/formType/drawerOpen 全部 useState，
//    树的 data/expanded/selected、详情区、抽屉标题全部由 state 派生；useT() 订阅后整页重渲染
// 2. 事件绑定：oas-tree 的 oas-select、radio 组的 oas-change、path 输入的 oas-input、oas-form
//    的 oas-submit、oas-drawer 的 oas-close 走 useOasEvent（AGENTS.md 第 1 条）；页头新建按钮
//    为 light DOM 原生 click 直绑 onClick；抽屉面板内取消/保存按钮按第 2 条例外直绑
//    addEventListener（panel 对原生事件 stopPropagation，React 根委托收不到）
//    定制；本模版不加该定制，可观察结果一致
//    value）；本模版在 open 边沿的 useEffect 做同样的事（「新增子菜单」的父级预置经
//    在 init 与每次提交后重建（buildParentOptions），本模版改为 open 边沿重建——选项内容
// 5. syncMenuType 拆解：提示文案（perms-hint/path 必填星号）由 formType state 派生声明式
//    渲染；C 类型 perms 自动补全（autoPerms）保持命令式（open 边沿/类型切换/path 输入，
//    回写 state（product-form 同款）；radio 的 checked 属性在 effect 里命令式同步
//   （setTypeRadio/setRadioChecked 同款通道，避免与组件 excludeSameName 的命令式互斥打架）
//    以 setTree([...tree]) 触发重渲染
// 8. 子组件拆分（单文件 ≤400 行纪律）：详情卡 ./menus-detail.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { treeMenus } from '../data/system'
import type { MenuTree, MenuType } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { MenusDetail } from './menus-detail'

const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** vanilla PERM_RE/autoPerms：C 类型按 path 首段自动生成 perms */
function autoPerms(type: MenuType, path: string): string {
  if (type !== 'C') return ''
  const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
  const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return mod ? `${mod}:list` : ''
}

/** vanilla findNode */
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

/** vanilla parentOf */
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

/** vanilla removeNode */
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

/** vanilla descendants */
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

/** vanilla toTreeNodes */
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

/** vanilla insertChild */
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

function isMenuType(v: string | null): v is MenuType {
  return v === 'M' || v === 'C' || v === 'F'
}

export default function MenusPage() {
  const { t, locale } = useT()
  const [tree, setTree] = useState<MenuTree[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formType, setFormType] = useState<MenuType>('C')
  const [formParentId, setFormParentId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const treeRef = useRef<HTMLElement | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const typeGroupRef = useRef<HTMLDivElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const parentRef = useRef<HTMLElement | null>(null)
  const permsRef = useRef<HTMLElement | null>(null)
  const pathRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)

  // vanilla init：拉树 + 选中首个根节点
  useEffect(() => {
    void treeMenus().then((rows) => {
      setTree(rows)
      setSelectedId(rows[0]?.id ?? null)
    })
  }, [])

  const selectedNode = selectedId != null ? findNode(tree, selectedId) : null
  const editingNode = editingId != null ? findNode(tree, editingId) : null

  // vanilla syncMenuType 的命令式半边：C 类型 perms 为空时按 path 自动补全
  const syncMenuType = (type: MenuType) => {
    if (type === 'C') {
      const cur = permsRef.current?.getAttribute('value') ?? ''
      if (!cur) {
        const auto = autoPerms('C', pathRef.current?.getAttribute('value') ?? '')
        if (auto) permsRef.current?.setAttribute('value', auto)
      }
    }
  }

  // vanilla fillMenuForm + buildParentOptions + setTypeRadio：open 边沿回填（偏差记录 4/5/6）
  useEffect(() => {
    if (!drawerOpen) return
    const node = editingNode
    const nextType: MenuType = node?.type ?? 'C'
    nameRef.current?.setAttribute('value', node?.title ?? '')
    const pid = node ? parentOf(tree, node.id) : formParentId
    parentRef.current?.setAttribute('value', String(pid ?? 0))
    permsRef.current?.setAttribute('value', node?.perms ?? '')
    pathRef.current?.setAttribute('value', node?.path ?? '')
    const toOpt = (list: MenuTree[]): Array<Record<string, unknown>> =>
      list.map((n) => ({
        value: String(n.id),
        label: n.title,
        children: n.children?.length ? toOpt(n.children) : undefined,
      }))
    parentRef.current?.setAttribute(
      'options',
      JSON.stringify([{ value: '0', label: t('menus.option.top'), children: toOpt(tree) }]),
    )
    const expanded: string[] = []
    const walk = (list: MenuTree[]) => {
      for (const n of list) {
        if (n.children?.length) {
          expanded.push(String(n.id))
          walk(n.children)
        }
      }
    }
    walk(tree)
    parentRef.current?.setAttribute('expanded', JSON.stringify(expanded))
    setFormType(nextType)
    // radio checked 命令式同步（与组件 excludeSameName 同通道，偏差记录 6）
    typeGroupRef.current?.querySelectorAll<HTMLElement>('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === nextType) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
    syncMenuType(nextType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, editingId, formParentId])

  // locale 变化时 radio 文案随 JSX 重算，checked 需按 formType 重打（vanilla refreshText 里
  // 重建 radio 组后 setRadioChecked 同款时机）
  useEffect(() => {
    typeGroupRef.current?.querySelectorAll<HTMLElement>('oas-radio').forEach((r) => {
      if (r.getAttribute('value') === formType) r.setAttribute('checked', '')
      else r.removeAttribute('checked')
    })
  }, [locale, formType, drawerOpen])

  // panel 内原生 click 例外直绑（AGENTS.md 第 2 条）：取消=关闭；保存=触发内部原生 form 提交
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => setDrawerOpen(false)
    const onSave = () => {
      ;(
        formRef.current?.shadowRoot?.querySelector('form') as HTMLFormElement | null
      )?.requestSubmit()
    }
    cancel?.addEventListener('click', onCancel)
    save?.addEventListener('click', onSave)
    return () => {
      cancel?.removeEventListener('click', onCancel)
      save?.removeEventListener('click', onSave)
    }
  }, [])

  // vanilla nextId：树内最大 id + 1
  const nextId = (): number => {
    const all: MenuTree[] = []
    const walk = (list: MenuTree[]) => {
      for (const n of list) {
        all.push(n)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(tree)
    return all.reduce((m, n) => Math.max(m, n.id), 0) + 1
  }

  // vanilla openForm 三种入口（新建/编辑/新增子菜单）
  const openCreate = () => {
    setEditingId(null)
    setFormParentId(null)
    setDrawerOpen(true)
  }
  const openEdit = (node: MenuTree) => {
    setEditingId(node.id)
    setFormParentId(null)
    setDrawerOpen(true)
  }
  const openAddChild = (node: MenuTree) => {
    setEditingId(null)
    setFormParentId(node.id)
    setDrawerOpen(true)
  }

  // vanilla md-del-pop oas-ok 段：有子菜单拒绝；纯内存删除
  const doDelete = (node: MenuTree) => {
    if ((node.children ?? []).length > 0) {
      appMessage.error(t('menus.hasChildren'))
      return
    }
    removeNode(tree, node.id)
    appMessage.success(t('common.deleted'))
    setSelectedId(null)
    setTree([...tree])
  }

  // 树事件：选中联动详情（vanilla oas-select 段）
  useOasEvent<{ key: string }>(treeRef, 'oas-select', (d) => {
    setSelectedId(Number(d.key))
  })

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(drawerRef, 'oas-close', () => setDrawerOpen(false))

  // vanilla typeGroup oas-change 段：取触发 radio 的 value 切 formType
  useOasEvent(typeGroupRef, 'oas-change', (_d, ev) => {
    const radio = ev.composedPath()[0] as HTMLElement
    if (!(radio instanceof HTMLElement) || !radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (isMenuType(v)) {
      setFormType(v)
      syncMenuType(v)
    }
  })

  // vanilla pathInput oas-input 段：C 类型 perms 为空时随 path 自动补全
  useOasEvent<{ value: string }>(pathRef, 'oas-input', (d) => {
    if (formType !== 'C') return
    const cur = permsRef.current?.getAttribute('value') ?? ''
    if (!cur) {
      const auto = autoPerms('C', d.value)
      if (auto) permsRef.current?.setAttribute('value', auto)
    }
  })

  // vanilla oas-submit 段：类型差异校验 → 父级合法性 → 原地更新/插入
  useOasEvent<{ values: { name: string } }>(formRef, 'oas-submit', (d) => {
    const name = d.values.name?.trim()
    if (!name) return
    const parentRaw = parentRef.current?.getAttribute('value') || '0'
    const parentId = parentRaw === '0' ? null : Number(parentRaw)
    const perms = (permsRef.current?.getAttribute('value') ?? '').trim()
    const path = (pathRef.current?.getAttribute('value') ?? '').trim()

    if (formType === 'F') {
      if (!perms) {
        appMessage.error(t('menus.err.permRequired'))
        return
      }
      if (!PERM_RE.test(perms)) {
        appMessage.error(t('menus.err.permFormat'))
        return
      }
    } else if (formType === 'C') {
      if (!path) {
        appMessage.error(t('menus.err.pathRequired'))
        return
      }
    }

    if (editingId != null && parentId != null) {
      const desc = descendants(tree, editingId)
      if (parentId === editingId || desc.has(parentId)) {
        appMessage.error(t('menus.err.parentInvalid'))
        return
      }
    }

    const finalPerms = formType === 'C' ? perms || autoPerms('C', path) : perms || undefined

    if (editingId != null) {
      const node = findNode(tree, editingId)
      if (!node) {
        appMessage.error(t('menus.notFound'))
        return
      }
      const oldParent = parentOf(tree, node.id)
      node.title = name
      node.type = formType
      node.perms = finalPerms
      node.path = formType === 'C' ? path : undefined
      if (parentId !== oldParent) {
        removeNode(tree, node.id)
        insertChild(tree, parentId, node)
      }
      appMessage.success(t('common.saved'))
    } else {
      const newNode: MenuTree = {
        id: nextId(),
        title: name,
        type: formType,
        perms: finalPerms,
        path: formType === 'C' ? path : undefined,
        parentId,
        children: [],
      }
      insertChild(tree, parentId, newNode)
      setSelectedId(newNode.id)
      appMessage.success(t('common.created'))
    }
    setDrawerOpen(false)
    setTree([...tree])
  })

  const rules = JSON.stringify({ name: [{ required: true, message: t('menus.rule.name') }] })
  const treeNodesJson = useMemo(() => JSON.stringify(toTreeNodes(tree)), [tree])
  const expandedAttr = useMemo(() => {
    const keys: string[] = []
    const walk = (list: MenuTree[]) => {
      for (const n of list) {
        if (n.children?.length) {
          keys.push(String(n.id))
          walk(n.children)
        }
      }
    }
    walk(tree)
    return keys.join(',')
  }, [tree])

  // vanilla syncMenuType 的提示文案半边（由 formType 派生，偏差记录 5）
  const permsHint =
    formType === 'C'
      ? t('menus.hint.autoPerms')
      : formType === 'M'
        ? t('menus.hint.noPermForDir')
        : t('menus.hint.required')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.menus')}</h1>
          <p className="page-subtitle">{t('menus.subtitle')}</p>
        </div>
        <oas-button data-testid="menu-create" type="primary" icon="plus" onClick={openCreate}>
          {t('menus.new')}
        </oas-button>
      </div>
      <div className="menu-layout">
        <oas-card className="menu-tree-card" title={t('menus.treeTitle')}>
          <oas-tree
            ref={treeRef}
            data-testid="menu-tree"
            data={treeNodesJson}
            expanded={expandedAttr}
            selected={selectedId != null ? String(selectedId) : undefined}
          />
        </oas-card>
        <oas-card className="menu-detail-card" title={t('menus.detailTitle')}>
          <MenusDetail
            node={selectedNode}
            onEdit={openEdit}
            onAddChild={openAddChild}
            onDelete={doDelete}
          />
        </oas-card>
      </div>

      <oas-drawer
        ref={drawerRef}
        data-testid="menu-form-drawer"
        title={editingNode ? t('menus.editMenu', { title: editingNode.title }) : t('menus.new')}
        placement="right"
        size="medium"
        no-footer
        visible={drawerOpen}
      >
        <oas-form ref={formRef} rules={rules}>
          <div className="menu-form-body">
            <div className="form-field">
              <label className="form-label">
                {t('menus.form.name')} <span className="req">*</span>
              </label>
              <oas-input
                ref={nameRef}
                data-testid="mf-name"
                name="name"
                placeholder={t('menus.rule.name')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t('menus.form.type')}</label>
              <div className="radio-group inline" id="mf-type" ref={typeGroupRef}>
                {(['M', 'C', 'F'] as const).map((ty) => (
                  <oas-radio key={ty} name="menuType" value={ty}>
                    <span className="radio-label">{t(`menus.type.${ty}`)}</span>
                  </oas-radio>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">{t('menus.form.parent')}</label>
              <oas-tree-select
                ref={parentRef}
                data-testid="mf-parent"
                placeholder={t('menus.placeholder.top')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">
                {t('menus.form.perms')}{' '}
                <span className="form-hint-inline" id="mf-perms-hint">
                  {permsHint}
                </span>
              </label>
              <oas-input
                ref={permsRef}
                data-testid="mf-perms"
                name="perms"
                placeholder={t('menus.placeholder.perms')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">
                {t('menus.form.path')}{' '}
                <span className="req" id="mf-path-req">
                  {formType === 'C' ? '*' : ''}
                </span>
              </label>
              <oas-input
                ref={pathRef}
                data-testid="mf-path"
                name="path"
                placeholder={t('menus.placeholder.path')}
              />
            </div>
            <div className="form-actions">
              <oas-space justify="end">
                <oas-button ref={cancelRef} data-testid="mf-cancel">
                  {t('common.cancel')}
                </oas-button>
                <oas-button ref={saveRef} data-testid="mf-save" type="primary">
                  {t('common.save')}
                </oas-button>
              </oas-space>
            </div>
          </div>
        </oas-form>
      </oas-drawer>
    </div>
  )
}
