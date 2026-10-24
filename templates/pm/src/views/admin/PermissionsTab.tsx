import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { t, type DictKey } from '@/i18n'
import type { MemberRole, Role } from '@/types'
import { ACTIONS, can, type Action } from '@/permission/policy'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { OCheckbox } from '@/components/oas-wrappers'

type Col = {
  key: string
  title: string
  align?: 'left' | 'center' | 'right'
  render?: (row: Record<string, unknown>) => string | Node
}
type TableHost = HTMLElement & {
  columns?: Col[]
  data?: Array<Record<string, unknown>>
}

const PERM_LABEL: Record<Action, DictKey> = {
  'issue:create': 'permIssueCreate',
  'issue:edit': 'permIssueEdit',
  'issue:delete': 'permIssueDelete',
  'issue:change-status': 'permIssueChangeStatus',
  'issue:change-assignee': 'permIssueChangeAssignee',
  'comment:create': 'permCommentCreate',
  'comment:edit': 'permCommentEdit',
  'comment:delete': 'permCommentDelete',
  'view:save': 'permViewSave',
  'view:delete': 'permViewDelete',
  'bulk:apply': 'permBulkApply',
  'bulk:delete': 'permBulkDelete',
  'project:manage': 'permProjectManage',
  'member:manage': 'permMemberManage',
}

const MATRIX_ROLES: MemberRole[] = ['viewer', 'member', 'admin']

function roleLabel(role: MemberRole): string {
  if (role === 'admin') return t('adminRoleAdmin')
  if (role === 'member') return t('adminRoleMember')
  return t('adminRoleViewer')
}

/**
 * 权限页：上半「自定义角色」编辑（名称/描述/权限矩阵），下半内置三角色只读矩阵。
 * 内置角色只读；自定义角色可分配给成员（成员页的角色下拉取自同一张 roles 表）。
 */
export function PermissionsTab() {
  const { roles: rolesRepo } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const roles = useObservable(() => rolesRepo.liveAll(), [rolesRepo])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [perms, setPerms] = useState<Set<Action>>(new Set())
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  const custom = useMemo(() => (roles ?? []).filter((r) => !r.builtin), [roles])

  const load = (role: Role) => {
    setEditingId(role.id)
    setDraft(false)
    setName(role.name)
    setDescription(role.description)
    setPerms(new Set(role.permissions as Action[]))
    setError('')
    setSaved('')
  }

  const startDraft = () => {
    setEditingId(`role-${nanoid(6)}`)
    setDraft(true)
    setName(t('permNewRole'))
    setDescription('')
    setPerms(new Set())
    setError('')
    setSaved('')
  }

  const toggle = (action: Action) => {
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(action)) next.delete(action)
      else next.add(action)
      return next
    })
    setSaved('')
  }

  const save = async () => {
    if (!editingId || busy) return
    const clean = name.trim()
    if (!clean) {
      setError(t('permRoleNameRequired'))
      return
    }
    setBusy(true)
    setError('')
    try {
      if (draft) {
        await rolesRepo.create({
          id: editingId,
          name: clean,
          description: description.trim(),
          builtin: false,
          permissions: [...perms],
        })
        setDraft(false)
      } else {
        await rolesRepo.update(editingId, {
          name: clean,
          description: description.trim(),
          permissions: [...perms],
        })
      }
      setSaved(t('permRoleSaved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editingId || draft || busy) return
    setBusy(true)
    setError('')
    try {
      await rolesRepo.delete(editingId)
      setEditingId(null)
      setName('')
      setDescription('')
      setPerms(new Set())
      setSaved('')
    } catch {
      setError(t('permRoleInUse'))
    } finally {
      setBusy(false)
    }
  }

  // 内置三角色只读矩阵（保持原有口径：14 行 × 3 列）
  const rows = useMemo(
    () =>
      ACTIONS.map((action) => ({
        id: action,
        action: t(PERM_LABEL[action]),
        ...Object.fromEntries(
          MATRIX_ROLES.map((role) => [role, can({ id: 'matrix', role }, action) ? '✓' : '—']),
        ),
      })),
    [],
  )

  const columns = useMemo<Col[]>(
    () => [
      { key: 'action', title: t('adminPermAction') },
      ...MATRIX_ROLES.map((role) => ({
        key: role,
        title: roleLabel(role),
        align: 'center' as const,
        render: (row: Record<string, unknown>) => String(row[role] ?? ''),
      })),
    ],
    [],
  )

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.columns = columns
    el.data = rows
  }, [columns, rows])

  return (
    <div className="admin-crud-page" data-testid="admin-tab-permissions">
      <h1 className="page-h1">{t('adminPermTitle')}</h1>

      <div className="admin-panel" data-testid="admin-custom-roles">
        <div className="perm-head">
          <p className="admin-panel-title">{t('permCustomTitle')}</p>
          <span className="admin-hint">{t('permCustomHint')}</span>
        </div>

        <div className="perm-roles">
          {custom.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`perm-role-chip${role.id === editingId ? ' is-active' : ''}`}
              data-testid={`perm-role-${role.id}`}
              onClick={() => load(role)}
            >
              {role.name}
            </button>
          ))}
          <button
            type="button"
            className="perm-role-chip is-new"
            data-testid="perm-role-new"
            onClick={startDraft}
          >
            {t('permNewRole')}
          </button>
        </div>

        {editingId ? (
          <div className="perm-editor">
            <div className="perm-fields">
              <div className="perm-field">
                <span>{t('permRoleName')}</span>
                <oas-input
                  value={name}
                  aria-label={t('permRoleName')}
                  data-testid="perm-role-name"
                  onInput={(e) =>
                    setName((e.target as HTMLElement & { value?: string }).value ?? '')
                  }
                />
              </div>
              <div className="perm-field">
                <span>{t('permRoleDesc')}</span>
                <oas-input
                  value={description}
                  aria-label={t('permRoleDesc')}
                  data-testid="perm-role-desc"
                  onInput={(e) =>
                    setDescription((e.target as HTMLElement & { value?: string }).value ?? '')
                  }
                />
              </div>
            </div>

            <p className="perm-matrix-title">{t('permMatrixTitle')}</p>
            <div className="perm-checks" data-testid="perm-checks">
              {ACTIONS.map((action) => (
                <div key={action} className="perm-check">
                  <OCheckbox
                    testid={`perm-${action}`}
                    ariaLabel={t(PERM_LABEL[action])}
                    checked={perms.has(action)}
                    onChange={() => toggle(action)}
                  />
                  <span>{t(PERM_LABEL[action])}</span>
                </div>
              ))}
            </div>

            {error && (
              <oas-alert type="error" size="small" data-testid="perm-error">
                {error}
              </oas-alert>
            )}
            {saved && (
              <oas-alert type="success" size="small" data-testid="perm-saved">
                {saved}
              </oas-alert>
            )}

            <div className="perm-actions">
              {!draft && (
                <oas-button
                  type="danger"
                  size="small"
                  data-testid="perm-role-delete"
                  onClick={() => void remove()}
                >
                  {t('delete')}
                </oas-button>
              )}
              <span className="perm-actions-gap" />
              <oas-button
                type="primary"
                size="small"
                data-testid="perm-role-save"
                disabled={busy ? '' : undefined}
                onClick={() => void save()}
              >
                {t('save')}
              </oas-button>
            </div>
          </div>
        ) : (
          <p className="admin-hint" data-testid="perm-empty">
            {custom.length === 0 ? t('permNoCustomRoles') : t('permSelectRole')}
          </p>
        )}
      </div>

      <div className="admin-panel">
        <p className="admin-panel-title">{t('adminPermTitle')}</p>
        <oas-table
          ref={tableRef}
          className="admin-perm-table"
          row-key="id"
          data-testid="admin-permissions-matrix"
        />
        <p className="admin-hint">{t('adminPermNote')}</p>
      </div>
    </div>
  )
}
