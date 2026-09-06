// src/pages/menus-detail.tsx —— 权限详情卡（选中节点描述/操作按钮）
// 1. 数据与状态、删除编排都在父组件 menus.tsx；本组件纯展示 + 事件转发
// 2. 事件绑定：详情区位于 oas-card 的 light DOM（非 drawer/modal panel），原生 click 可达
//    React 根委托——编辑/新增子菜单按钮直接 onClick；删除 popconfirm 的 oas-ok 自定义
//    事件走 useOasEvent
// 3. oas-ok 监听绑定在仅 node 非空时才挂载的内层组件上：若挂在条件渲染的外层，
//    首挂载（node 为空）时 ref 为 null 且 effect 不再重跑，监听永远不会附上
import { useRef } from 'react'
import type { MenuTree, MenuType } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

/** vanilla TYPE_TAG：菜单类型 → 标签色 */
const TYPE_TAG: Record<MenuType, string> = { M: 'default', C: 'primary', F: 'warning' }

export interface MenusDetailProps {
  /** 当前选中节点（null → 空态） */
  node: MenuTree | null
  onEdit: (node: MenuTree) => void
  onAddChild: (node: MenuTree) => void
  onDelete: (node: MenuTree) => void
}

export function MenusDetail(props: MenusDetailProps) {
  const { t } = useT()
  if (!props.node) return <oas-empty description={t('menus.empty.selectNode')} />
  // 内层组件仅在 node 非空时挂载，保证 useOasEvent 的 effect 首跑时 ref 已就绪
  return <MenusDetailInner {...props} node={props.node} />
}

function MenusDetailInner({
  node,
  onEdit,
  onAddChild,
  onDelete,
}: MenusDetailProps & { node: MenuTree }) {
  const { t } = useT()
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // vanilla md-del-pop 直绑的 oas-ok → 父组件编排（子节点存在时拒绝删除）
  useOasEvent(wrapRef, 'oas-ok', () => {
    onDelete(node)
  })

  return (
    <div ref={wrapRef} className="menu-detail">
      <div className="menu-detail-head">
        <div className="menu-detail-title">{node.title}</div>
        <oas-tag type={TYPE_TAG[node.type]}>{t(`menus.type.${node.type}`)}</oas-tag>
      </div>
      <oas-descriptions column="1">
        <oas-descriptions-item label={t('menus.form.type')}>
          <span className="mono">{node.type}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('menus.form.perms')}>
          <span className="mono" data-testid="menu-detail-perms">
            {node.perms ?? '—'}
          </span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('menus.form.path')}>
          <span className="mono">{node.path ?? '—'}</span>
        </oas-descriptions-item>
        <oas-descriptions-item label={t('menus.detail.childCount')}>
          <span className="mono">{(node.children ?? []).length}</span>
        </oas-descriptions-item>
      </oas-descriptions>
      <div className="menu-detail-actions">
        <oas-button data-md-action="edit" type="primary" onClick={() => onEdit(node)}>
          {t('common.edit')}
        </oas-button>
        <oas-button data-md-action="child" onClick={() => onAddChild(node)}>
          {t('menus.addChild')}
        </oas-button>
        <oas-popconfirm title={t('menus.confirmDelete')} id="md-del-pop">
          <oas-button data-md-action="delete" type="danger">
            {t('common.delete')}
          </oas-button>
        </oas-popconfirm>
      </div>
    </div>
  )
}
