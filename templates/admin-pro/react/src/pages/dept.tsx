// src/pages/dept.tsx —— 部门管理（左树右详情 + 抽屉表单 + 子部门表）
//    刷文案）；本模版声明式——tree/flat/selectedId/editingId/drawerOpen 全部 useState，树的
//    data/expanded/selected、详情区、抽屉标题全部由 state 派生；useT() 订阅后整页重渲染，
//    rules/label/placeholder/rules 文案随 locale 自动重算（dashboard 同款模式）
// 2. 事件绑定：oas-tree 的 oas-select/oas-node-render、oas-form 的 oas-submit、oas-drawer 的
//    oas-close 走 useOasEvent页头新建按钮为 light DOM 原生 click 直绑
//    onClick；抽屉面板内取消/保存按钮按第 2 条例外直绑 addEventListener（panel 对原生事件
//    stopPropagation，React 根委托收不到）
//    options/expanded/value）；本模版在 open 边沿的 useEffect 做同样的事（字段非受控，value
//    回写 state（product-form 同款）
// 5. 命令式 API 规避（批次 A oas-virtual-list.buffer 崩溃教训）：React 19 property 通道会遮蔽
//    custom element 原型成员；本页对 oas-tree/oas-tree-select 只用 attribute（data 虽有
//    property setter 但其实现就是 setAttribute 反射），不触碰任何命令式成员
// 6. 子组件拆分（单文件 ≤400 行纪律）：详情卡 ./dept-detail.tsx（描述/操作/子部门表）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../styles/pages/dept.css'
import { createDept, listDepts, removeDept, treeDepts, updateDept } from '../data/system'
import type { DeptNode, DeptTree } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { DeptDetail } from './dept-detail'

type TFunc = (key: string, params?: Record<string, string | number>) => string

/** oas-tree 自定义节点模板的数据形态（dept.ts 的 DeptTreeNode） */
interface DeptTreeNode {
  key: string
  label: string
  members: number
  children: DeptTreeNode[]
}

/** vanilla findNode */
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

/** vanilla descendants */
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

/** vanilla toTreeNodes */
function toTreeNodes(nodes: DeptTree[]): DeptTreeNode[] {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.name,
    members: n.members,
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

/** vanilla expandKeys */
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

/** vanilla prune：剔除自身及其后代后的选项树 */
function prune(node: DeptTree, excluded: Set<number>): DeptTree | null {
  if (excluded.has(node.id)) return null
  const children = (node.children ?? [])
    .map((c) => prune(c, excluded))
    .filter((c): c is DeptTree => c !== null)
  return { ...node, children }
}

/** vanilla buildParentOptions：顶级哨兵 + 剔除编辑目标自身/后代 */
function buildParentOptions(
  nodes: DeptTree[],
  excludeId: number | null,
  t: TFunc,
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

export default function DeptPage() {
  const { t } = useT()
  const [tree, setTree] = useState<DeptTree[]>([])
  const [flat, setFlat] = useState<DeptNode[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formParentId, setFormParentId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const savingRef = useRef(false)

  const treeRef = useRef<HTMLElement | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const parentRef = useRef<HTMLElement | null>(null)
  const membersRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)

  const refresh = useCallback(async () => {
    const [rows, tr] = await Promise.all([listDepts(), treeDepts()])
    setFlat(rows)
    setTree(tr)
    setSelectedId((prev) => (prev != null && findNode(tr, prev) ? prev : (tr[0]?.id ?? null)))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedNode = selectedId != null ? findNode(tree, selectedId) : null
  const editingNode = editingId != null ? findNode(tree, editingId) : null

  useEffect(() => {
    if (!drawerOpen) return
    nameRef.current?.setAttribute('value', editingNode?.name ?? '')
    membersRef.current?.setAttribute('value', String(editingNode?.members ?? 0))
    const pid = editingNode?.parentId ?? formParentId ?? null
    parentRef.current?.setAttribute('value', String(pid ?? 0))
    parentRef.current?.setAttribute(
      'options',
      JSON.stringify(buildParentOptions(tree, editingId, t)),
    )
    parentRef.current?.setAttribute('expanded', JSON.stringify(expandKeys(tree)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, editingId, formParentId])

  // panel 内原生 click 例外直绑：取消=关闭；保存=触发内部原生 form 提交
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

  const openCreate = () => {
    setEditingId(null)
    setFormParentId(null)
    setDrawerOpen(true)
  }
  const openEdit = (node: DeptNode) => {
    setEditingId(node.id)
    setFormParentId(node.parentId)
    setDrawerOpen(true)
  }
  const openAddChild = (node: DeptTree) => {
    setEditingId(null)
    setFormParentId(node.id)
    setDrawerOpen(true)
  }

  const doDelete = async (id: number) => {
    const node = findNode(tree, id)
    if (!node) {
      appMessage.error(t('dept.notFound'))
      return
    }
    if ((node.children ?? []).length > 0) {
      appMessage.error(t('dept.hasChildren'))
      return
    }
    const ok = await removeDept(id)
    if (!ok) {
      appMessage.error(t('dept.notFound'))
      return
    }
    appMessage.success(t('common.deleted'))
    setSelectedId(null)
    void refresh()
  }

  useOasEvent<{ key: string }>(treeRef, 'oas-select', (d) => {
    setSelectedId(Number(d.key))
  })
  useOasEvent<{ node: DeptTreeNode; element: HTMLElement }>(treeRef, 'oas-node-render', (d) => {
    const badge = d.element.querySelector<HTMLElement>('.dept-member-badge')
    if (badge) badge.textContent = String(d.node.members)
  })

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(drawerRef, 'oas-close', () => setDrawerOpen(false))

  useOasEvent<{ values: { name: string; members: string } }>(formRef, 'oas-submit', async (d) => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const name = d.values.name?.trim()
      if (!name) return
      const parentRaw = parentRef.current?.getAttribute('value') || '0'
      const parentId = parentRaw === '0' ? null : Number(parentRaw)
      const members = Number(d.values.members) || 0
      if (editingId != null && parentId === editingId) {
        appMessage.error(t('dept.err.parentSelf'))
        return
      }
      if (editingId == null) {
        await createDept({ name, parentId, members })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateDept(editingId, { name, parentId, members })
        if (!updated) appMessage.error(t('dept.notFound'))
        else appMessage.success(t('common.saved'))
      }
      setDrawerOpen(false)
      void refresh()
    } finally {
      savingRef.current = false
    }
  })

  const rules = JSON.stringify({ name: [{ required: true, message: t('dept.rule.name') }] })
  const treeNodesJson = useMemo(() => JSON.stringify(toTreeNodes(tree)), [tree])
  const expandedAttr = useMemo(() => expandKeys(tree).join(','), [tree])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.dept')}</h1>
          <p className="page-subtitle">{t('dept.subtitle')}</p>
        </div>
        <oas-button data-testid="dept-create" type="primary" icon="plus" onClick={openCreate}>
          {t('dept.new')}
        </oas-button>
      </div>
      <oas-splitter className="dept-layout" percent="30" min="20" max="45">
        <oas-card slot="left" className="dept-tree-card" title={t('dept.treeTitle')}>
          <oas-tree
            ref={treeRef}
            data-testid="dept-tree"
            data={treeNodesJson}
            expanded={expandedAttr}
            selected={selectedId != null ? String(selectedId) : undefined}
          >
            {/* vanilla template[slot="node"]：节点标签 + 人数徽标（oas-node-render 回填徽标） */}
            <template slot="node">
              <span className="tree-node-label">
                <span data-node-label=""></span>
                <span className="dept-member-badge"></span>
              </span>
            </template>
          </oas-tree>
        </oas-card>
        <oas-card slot="right" className="dept-detail-card" title={t('dept.detailTitle')}>
          <DeptDetail
            node={selectedNode}
            onEdit={openEdit}
            onAddChild={openAddChild}
            onDelete={(node) => void doDelete(node.id)}
            onEditRow={(id) => {
              const row = flat.find((d) => d.id === id)
              if (row) openEdit(row)
            }}
            onSubDelete={(id) => void doDelete(id)}
          />
        </oas-card>
      </oas-splitter>

      <oas-drawer
        ref={drawerRef}
        data-testid="dept-form-drawer"
        title={editingNode ? t('dept.editDept', { name: editingNode.name }) : t('dept.new')}
        placement="right"
        size="medium"
        no-footer
        visible={drawerOpen}
      >
        <oas-form ref={formRef} rules={rules}>
          <div className="dept-form-body">
            <div className="form-field">
              <label className="form-label">
                {t('dept.form.name')} <span className="req">*</span>
              </label>
              <oas-input
                ref={nameRef}
                data-testid="df-name"
                name="name"
                placeholder={t('dept.rule.name')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t('dept.form.parent')}</label>
              <oas-tree-select
                ref={parentRef}
                data-testid="df-parent"
                placeholder={t('dept.placeholder.top')}
              />
            </div>
            <div className="form-field">
              <label className="form-label">{t('dept.form.members')}</label>
              <oas-input-number
                ref={membersRef}
                data-testid="df-members"
                name="members"
                min="0"
                placeholder="0"
              />
            </div>
            <div className="form-actions">
              <oas-space justify="end">
                <oas-button ref={cancelRef} data-testid="df-cancel">
                  {t('common.cancel')}
                </oas-button>
                <oas-button ref={saveRef} data-testid="df-save" type="primary">
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
