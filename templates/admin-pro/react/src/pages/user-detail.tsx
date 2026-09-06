// src/pages/user-detail.tsx —— 用户详情弹窗（descriptions + 权限标识 + 编辑/删除）
//    声明式——user/roleName/perms 由父组件 state 派生，重渲染即最新（oas-descriptions
//    的 items 走默认 slot，light DOM 子节点变化自然生效，见组件源码 template）
// 2. 编辑/删除按钮：位于 oas-modal 的 panel 内，panel 对原生 click stopPropagation
//   （AGENTS.md 原生事件例外条款），故直绑 addEventListener；popconfirm 的 oas-ok 与
//    modal 的 oas-close 自定义事件仍走 useOasEvent
import { useEffect, useRef } from 'react'
import type { UserRow } from '../data/users'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

export interface UserPermItem {
  perm: string
  allowed: boolean
}

export interface UserDetailProps {
  open: boolean
  user: UserRow | null
  /** 角色显示名（roleMap 命中取角色名，否则取枚举文案；父组件 roleName() 同款） */
  roleName: string
  /** 角色标签色调（vanilla roleTagType/tagTypeForRole 段，父组件算好传入） */
  roleTagType: string
  perms: UserPermItem[]
  canMutate: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

function statusTagType(status: UserRow['status']): string {
  return status === 'active' ? 'success' : 'danger'
}

export function UserDetail({
  open,
  user,
  roleName,
  roleTagType,
  perms,
  canMutate,
  onClose,
  onEdit,
  onDelete,
}: UserDetailProps) {
  const { t } = useT()
  const surfaceRef = useRef<HTMLElement | null>(null)
  const popconfirmRef = useRef<HTMLElement | null>(null)
  const editRef = useRef<HTMLElement | null>(null)
  const onEditRef = useRef(onEdit)
  onEditRef.current = onEdit

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态
  useOasEvent(surfaceRef, 'oas-close', onClose)

  // vanilla delete-popconfirm oas-ok 段（删除闭环在父组件：权限判断/删行/关窗/提示/刷新）
  useOasEvent(popconfirmRef, 'oas-ok', () => onDelete())

  // panel 内原生 click 例外直绑（AGENTS.md 第 2 条）：编辑=关详情开表单
  useEffect(() => {
    const edit = editRef.current
    const handler = () => onEditRef.current()
    edit?.addEventListener('click', handler)
    return () => edit?.removeEventListener('click', handler)
  }, [])

  return (
    <oas-modal ref={surfaceRef} data-testid="user-detail-modal" no-footer visible={open}>
      <div className="modal-body">
        <div className="detail-header">
          <oas-avatar id="detail-avatar" size="48">
            <span slot="fallback" id="detail-avatar-text">
              {user ? user.name.charAt(0).toUpperCase() : ''}
            </span>
          </oas-avatar>
          <div>
            <div id="detail-name" className="detail-name">
              {user?.name ?? ''}
            </div>
            <oas-tag id="detail-role-tag" type={roleTagType}>
              {roleName}
            </oas-tag>
          </div>
        </div>
        {user && (
          <oas-descriptions id="detail-desc" column="1">
            <oas-descriptions-item label="ID">
              <span id="detail-id">{user.id}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('users.name')}>
              <span id="detail-name2">{user.name}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('users.email')}>
              <span id="detail-email">{user.email}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('users.role')}>
              <span id="detail-role">{roleName}</span>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('users.status')}>
              <oas-tag id="detail-status-tag" type={statusTagType(user.status)}>
                {t(`users.status.${user.status}`)}
              </oas-tag>
            </oas-descriptions-item>
            <oas-descriptions-item label={t('users.created')}>
              <span id="detail-created">{user.created}</span>
            </oas-descriptions-item>
          </oas-descriptions>
        )}
        <oas-divider />
        <div className="detail-perms-title form-label">{t('users.perm')}</div>
        <div id="detail-perms-list" className="detail-perms-list">
          {perms.length === 0 ? (
            <oas-tag type="default">{t('users.nonePerm')}</oas-tag>
          ) : (
            perms.map((p) => (
              <oas-tag className="mono" type={p.allowed ? 'success' : 'default'} key={p.perm}>
                {p.perm}
              </oas-tag>
            ))
          )}
        </div>
        <oas-space justify="end">
          <oas-button ref={editRef} data-testid="detail-edit" type="primary">
            {t('common.edit')}
          </oas-button>
          <oas-popconfirm
            ref={popconfirmRef}
            title={t('users.confirmDelete')}
            id="delete-popconfirm"
          >
            <oas-button
              data-testid="detail-delete"
              type="danger"
              disabled={!canMutate || undefined}
              title={!canMutate ? t('common.noPerm') : undefined}
            >
              {t('common.delete')}
            </oas-button>
          </oas-popconfirm>
        </oas-space>
      </div>
    </oas-modal>
  )
}
