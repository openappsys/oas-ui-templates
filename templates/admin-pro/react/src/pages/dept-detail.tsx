// src/pages/dept-detail.tsx —— 部门详情卡（选中节点描述/操作按钮/子部门表）
// 1. 数据与状态、删除编排都在父组件 dept.tsx；本组件纯展示 + 事件转发
// 2. 事件绑定：详情区位于 oas-card 的 light DOM（非 drawer/modal panel），原生 click 可达
//    React 根委托——编辑/新增子部门按钮直接 onClick；行内编辑经 composedPath 匹配
//    [data-edit]；删除 popconfirm 的 oas-ok 自定义事件走 useOasEvent
// 3. oas-ok 监听绑定在仅 node 非空时才挂载的内层组件上：若挂在条件渲染的外层，
//    首挂载（node 为空）时 ref 为 null 且 effect 不再重跑，监听永远不会附上
// 4. 子表 columns 含 render 函数 → property 通道，列定义按 locale 重建
import { useMemo, useRef } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import type { DeptTree } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

type TFunc = (key: string, params?: Record<string, string | number>) => string

export interface DeptDetailProps {
  /** 当前选中节点（null → 空态） */
  node: DeptTree | null
  onEdit: (node: DeptTree) => void
  onAddChild: (node: DeptTree) => void
  onDelete: (node: DeptTree) => void
  /** 子表行内编辑（父组件按 id 回查 flat 行） */
  onEditRow: (id: number) => void
  /** 子表 popconfirm 删除 */
  onSubDelete: (id: number) => void
}

/** vanilla subActionCell：编辑按钮 + popconfirm 包裹的删除按钮（data-edit/data-del 逐字对齐） */
function subActionCell(node: DeptTree, t: TFunc): HTMLElement {
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

/** vanilla SUB_COLUMNS */
function buildColumns(t: TFunc): TableColumn[] {
  return [
    { key: 'name', title: t('dept.th.name') },
    { key: 'members', title: t('dept.th.members'), align: 'right' },
    {
      key: 'action',
      title: t('dept.th.action'),
      render: (r) => subActionCell(r as unknown as DeptTree, t),
    },
  ]
}

export function DeptDetail(props: DeptDetailProps) {
  const { t } = useT()
  if (!props.node) return <oas-empty description={t('dept.empty.selectNode')} />
  // 内层组件仅在 node 非空时挂载，保证 useOasEvent 的 effect 首跑时 ref 已就绪
  return <DeptDetailInner {...props} node={props.node} />
}

function DeptDetailInner({
  node,
  onEdit,
  onAddChild,
  onDelete,
  onEditRow,
  onSubDelete,
}: DeptDetailProps & { node: DeptTree }) {
  const { t, locale } = useT()
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(() => buildColumns(t), [locale])

  // 否则是详情删除 popconfirm（#md-del-pop）→ 删除当前选中节点
  useOasEvent<{ source: HTMLElement }>(wrapRef, 'oas-ok', (detail) => {
    const src = detail.source
    if (!src?.hasAttribute) return
    if (src.hasAttribute('data-del')) onSubDelete(Number(src.getAttribute('data-del')))
    else if (src.id === 'md-del-pop') onDelete(node)
  })

  const onWrapClick = (e: React.MouseEvent) => {
    const editBtn = e.nativeEvent
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
    if (editBtn) onEditRow(Number(editBtn.getAttribute('data-edit')))
  }

  const children = node.children ?? []
  return (
    <div ref={wrapRef} className="dept-detail" onClick={onWrapClick}>
      <div className="dept-detail-head">
        <div className="dept-detail-title">{node.name}</div>
        <oas-tag type="primary" data-testid="dept-detail-members">
          {t('dept.memberCount', { n: node.members })}
        </oas-tag>
      </div>
      <oas-descriptions column="1">
        <oas-descriptions-item label={t('dept.detail.id')}>
          <span className="mono">{node.id}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('dept.form.parent')}>
          <span className="mono">{node.parentId == null ? '—' : node.parentId}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('dept.detail.childCount')}>
          <span className="mono">{children.length}</span>
        </oas-descriptions-item>
      </oas-descriptions>
      <div className="dept-detail-actions">
        <oas-button data-md-action="edit" type="primary" onClick={() => onEdit(node)}>
          {t('common.edit')}
        </oas-button>
        <oas-button data-md-action="child" onClick={() => onAddChild(node)}>
          {t('dept.addChild')}
        </oas-button>
        <oas-popconfirm title={t('dept.confirmDelete')} id="md-del-pop">
          <oas-button data-md-action="delete" type="danger">
            {t('common.delete')}
          </oas-button>
        </oas-popconfirm>
      </div>
      <div className="dept-detail-sub">
        <div className="dept-detail-sub-title">{t('dept.subTitle')}</div>
        <div id="dept-sub">
          {children.length === 0 ? (
            <div className="sub-dept-empty">{t('dept.empty.noChildren')}</div>
          ) : (
            <oas-table
              data-testid="dept-sub-table"
              row-key="id"
              columns={columns}
              data={JSON.stringify(children)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
