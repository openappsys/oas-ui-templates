import { useEffect, useMemo, useRef } from 'react'
import { t, type DictKey } from '@/i18n'
import type { MemberRole } from '@/types'
import { ACTIONS, can, type Action } from '@/permission/policy'

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

export function PermissionsTab() {
  const tableRef = useRef<TableHost>(null)

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
