// src/pages/user-form.tsx —— 用户表单弹窗（新建/编辑，modal 形态）
// 2. 取消/保存按钮：位于 oas-modal 的 panel 内，panel 对原生 click stopPropagation
//    oas-submit/oas-close 自定义事件仍走 useOasEvent
//    React state 单一持有，监听 oas-close 回写 state
//    attribute 随 roles state 重算，回填仅写 value attribute
import { useEffect, useMemo, useRef } from 'react'
import type { UserRow, UserRole, UserStatus } from '../data/users'
import { createUser, updateUser } from '../data/users'
import type { RoleRow } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'

export interface UserFormProps {
  open: boolean
  /** 编辑态 id（null=新建）；与 editing 分离以对齐 vanilla 的 editingId 语义（行被删仍可按 id 提交） */
  editingId: number | null
  editing: UserRow | null
  roles: RoleRow[]
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  name: string
  email: string
  roleId: string
  status: UserStatus
}

/** vanilla roleEnumFor：按角色 code 映射 UserRole 枚举 */
function roleEnumFor(roleRow: RoleRow | undefined): UserRole {
  if (!roleRow) return 'viewer'
  if (roleRow.code === 'super_admin') return 'admin'
  if (roleRow.code === 'viewer') return 'viewer'
  return 'editor'
}

export function UserForm({ open, editingId, editing, roles, onClose, onSaved }: UserFormProps) {
  const { t } = useT()
  const surfaceRef = useRef<HTMLElement | null>(null)
  const formRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLElement | null>(null)
  const emailRef = useRef<HTMLElement | null>(null)
  const roleRef = useRef<HTMLElement | null>(null)
  const statusRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const saveRef = useRef<HTMLElement | null>(null)
  const savingRef = useRef(false)

  // 回调最新化：面板内原生监听只在挂载时绑一次（product-form 同款）
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])

  useEffect(() => {
    if (!open) return
    nameRef.current?.setAttribute('value', editing?.name ?? '')
    emailRef.current?.setAttribute('value', editing?.email ?? '')
    roleRef.current?.setAttribute(
      'value',
      editing?.roleId != null ? String(editing.roleId) : String(roles[0]?.id ?? ''),
    )
    statusRef.current?.setAttribute('value', editing?.status ?? 'active')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, roles])

  // panel 内原生 click 例外直绑：取消=关闭；保存=触发内部原生 form 提交
  useEffect(() => {
    const cancel = cancelRef.current
    const save = saveRef.current
    const onCancel = () => onCloseRef.current()
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

  // 组件侧关闭（遮罩/Esc/✕）→ 回写 React 状态（visible 单一事实来源）
  useOasEvent(surfaceRef, 'oas-close', () => onCloseRef.current())

  useOasEvent<{ values: FormValues }>(formRef, 'oas-submit', async (detail) => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const values = detail.values
      const roleId = values.roleId ? Number(values.roleId) : null
      const roleRow = roleId != null ? roleMap.get(roleId) : undefined
      const role = roleEnumFor(roleRow)
      if (editingId == null) {
        await createUser({
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status || 'active',
        })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateUser(editingId, {
          name: values.name,
          email: values.email,
          role,
          roleId,
          status: values.status,
        })
        if (!updated) {
          appMessage.error(t('users.notFound'))
        } else {
          appMessage.success(t('common.saved'))
        }
      }
      onSaved()
    } finally {
      savingRef.current = false
    }
  })

  const title =
    editingId == null ? t('users.new') : t('users.editUser').replace('#{id}', String(editingId))
  const rules = JSON.stringify({
    name: [{ required: true, message: t('users.rule.name') }],
    email: [
      { required: true, message: t('users.rule.email') },
      { pattern: '^\\S+@\\S+$', message: t('users.rule.emailFmt') },
    ],
  })
  const roleOptions = JSON.stringify(roles.map((r) => ({ label: r.name, value: String(r.id) })))
  const statusOptions = JSON.stringify([
    { label: t('users.status.active'), value: 'active' },
    { label: t('users.status.disabled'), value: 'disabled' },
  ])

  return (
    <oas-modal ref={surfaceRef} data-testid="user-form-modal" no-footer visible={open}>
      <div className="modal-body">
        <h2 id="form-title">{title}</h2>
        <oas-form ref={formRef} id="user-form" rules={rules}>
          <div className="form-grid">
            <oas-input
              ref={nameRef}
              data-testid="field-name"
              name="name"
              placeholder={t('users.name')}
            />
            <oas-input
              ref={emailRef}
              data-testid="field-email"
              name="email"
              placeholder={t('users.email')}
            />
            <oas-select
              ref={roleRef}
              data-testid="field-role"
              name="roleId"
              options={roleOptions}
            />
            <oas-select
              ref={statusRef}
              data-testid="field-status"
              name="status"
              options={statusOptions}
            />
          </div>
          <div className="form-actions">
            <oas-space justify="end">
              <oas-button ref={cancelRef} data-testid="form-cancel">
                {t('common.cancel')}
              </oas-button>
              <oas-button ref={saveRef} data-testid="form-save" type="primary">
                {t('common.save')}
              </oas-button>
            </oas-space>
          </div>
        </oas-form>
      </div>
    </oas-modal>
  )
}
