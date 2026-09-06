// src/pages/menus.tsx —— 权限管理（左树右详情 + 抽屉表单，纯内存树）
// 1. 状态：tree/selectedId/editingId/formParentId/drawerOpen 全部 useState，树的
//    data/expanded/selected、详情区、抽屉标题全部由 state 派生；useT() 订阅后整页重渲染
// 2. 事件绑定：oas-tree 的 oas-select 走 useOasEvent；页头新建按钮为 light DOM 原生
//    click 直绑 onClick；抽屉表单的 radio 切换/perms 自动补全/取消保存接线在
//    ./menus-form-drawer.tsx，本页只做提交校验与树变更编排（校验失败不关抽屉）
// 3. 树数据为纯内存可变结构：变更后以 setTree([...tree]) 触发重渲染
// 4. 子组件拆分（单文件 ≤400 行纪律）：树助手 ./menus-tree.ts、抽屉表单
//    ./menus-form-drawer.tsx、详情卡 ./menus-detail.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { treeMenus } from '../data/system'
import type { MenuTree, MenuType } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { MenusDetail } from './menus-detail'
import { MenusFormDrawer } from './menus-form-drawer'
import type { MenuSubmitPayload } from './menus-form-drawer'
import { autoPerms } from './menus-form-drawer'
import { descendants, findNode, insertChild, parentOf, removeNode, toTreeNodes } from './menus-tree'

const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

export default function MenusPage() {
  const { t } = useT()
  const [tree, setTree] = useState<MenuTree[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formParentId, setFormParentId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const treeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    void treeMenus().then((rows) => {
      setTree(rows)
      setSelectedId(rows[0]?.id ?? null)
    })
  }, [])

  const selectedNode = selectedId != null ? findNode(tree, selectedId) : null
  const editingNode = editingId != null ? findNode(tree, editingId) : null

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

  useOasEvent<{ key: string }>(treeRef, 'oas-select', (d) => {
    setSelectedId(Number(d.key))
  })

  const handleMenuSubmit = (p: MenuSubmitPayload) => {
    const { name, type: formType, parentId, perms, path } = p
    if (!name) return

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
  }

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

      {/* 抽屉表单自包含回填/类型切换/perms 补全；提交值转发上来编排 */}
      <MenusFormDrawer
        open={drawerOpen}
        editing={editingNode}
        presetParentId={formParentId}
        tree={tree}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleMenuSubmit}
      />
    </div>
  )
}
