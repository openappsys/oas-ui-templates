import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { t, type DictKey } from '@/i18n'
import type { MemberRole, Role } from '@/types'
import { ACTIONS, can, type Action } from '@/permission/policy'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { OCheckbox, OSelect } from '@/components/oas-wrappers'

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

const AUDIT_LABEL: Record<string, DictKey> = {
  'role.create': 'auditRoleCreate',
  'role.update': 'auditRoleUpdate',
  'role.delete': 'auditRoleDelete',
  'member.role': 'auditMemberRole',
  'projectRole.set': 'auditProjectRole',
  'projectRole.clear': 'auditProjectRoleClear',
  'projectMember.set': 'auditProjectMembers',
}

function roleLabel(role: MemberRole): string {
  if (role === 'admin') return t('adminRoleAdmin')
  if (role === 'member') return t('adminRoleMember')
  return t('adminRoleViewer')
}

/**
 * 权限页：自定义角色编辑（名称/描述/作用域/权限矩阵）、项目级角色覆盖、最近变更（审计），
 * 底部内置三角色只读矩阵。内置角色只读；自定义角色可分配给成员。
 */
export function PermissionsTab({ currentUser }: { currentUser: string }) {
  const {
    roles: rolesRepo,
    audit: auditRepo,
    projectRoles: projectRolesRepo,
    projects: projectsRepo,
    members: membersRepo,
  } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const roles = useObservable(() => rolesRepo.liveAll(), [rolesRepo])
  const audit = useObservable(() => auditRepo.liveRecent(12), [auditRepo])
  const assignments = useObservable(() => projectRolesRepo.liveAll(), [projectRolesRepo])
  const projects = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const memberMap = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'workspace' | 'project'>('workspace')
  const [perms, setPerms] = useState<Set<Action>>(new Set())
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  // 项目角色覆盖表单
  const [ovProject, setOvProject] = useState('')
  const [ovMember, setOvMember] = useState('')
  const [ovMemberQuery, setOvMemberQuery] = useState('')
  const [ovRole, setOvRole] = useState('')

  const custom = useMemo(() => (roles ?? []).filter((r) => !r.builtin), [roles])
  const projectRoles = useMemo(
    () => (roles ?? []).filter((r) => r.scope === 'project' && !r.builtin),
    [roles],
  )

  useEffect(() => {
    if (!ovProject && projects?.length) setOvProject(projects[0].id)
    if (!ovMember && members?.length) setOvMember(members[0].id)
  }, [projects, members, ovProject, ovMember])

  const log = (action: string, target: string, detail?: string) => {
    void auditRepo.add({
      id: nanoid(),
      at: Date.now(),
      actorId: currentUser,
      action,
      target,
      detail,
    })
  }

  const load = (role: Role) => {
    setEditingId(role.id)
    setDraft(false)
    setName(role.name)
    setDescription(role.description)
    setScope(role.scope === 'project' ? 'project' : 'workspace')
    setPerms(new Set(role.permissions as Action[]))
    setError('')
    setSaved('')
  }

  const startDraft = () => {
    setEditingId(`role-${nanoid(6)}`)
    setDraft(true)
    setName(t('permNewRole'))
    setDescription('')
    setScope('workspace')
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
          scope,
          builtin: false,
          permissions: [...perms],
        })
        setDraft(false)
        log('role.create', clean)
      } else {
        await rolesRepo.update(editingId, {
          name: clean,
          description: description.trim(),
          scope,
          permissions: [...perms],
        })
        log('role.update', clean)
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
      log('role.delete', name.trim() || editingId)
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

  const applyProjectRole = async () => {
    if (!ovProject || !ovMember || busy) return
    setBusy(true)
    try {
      await projectRolesRepo.set(ovProject, ovMember, ovRole || null)
      const target = `${projectMap.get(ovProject)?.name ?? ovProject} / ${memberMap.get(ovMember)?.name ?? ovMember}`
      log(
        ovRole ? 'projectRole.set' : 'projectRole.clear',
        target,
        ovRole ? (roles?.find((r) => r.id === ovRole)?.name ?? ovRole) : undefined,
      )
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
              {role.scope === 'project' && (
                <span className="perm-role-scope">{t('roleScopeProject')}</span>
              )}
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
              <div className="perm-field">
                <span>{t('roleScope')}</span>
                <OSelect
                  testid="perm-role-scope"
                  ariaLabel={t('roleScope')}
                  value={scope}
                  options={[
                    { label: t('roleScopeWorkspace'), value: 'workspace' },
                    { label: t('roleScopeProject'), value: 'project' },
                  ]}
                  onChange={(v) => setScope(v === 'project' ? 'project' : 'workspace')}
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

      <div className="admin-panel" data-testid="admin-project-roles">
        <p className="admin-panel-title">{t('projRoleTitle')}</p>
        <p className="admin-hint">{t('projRoleHint')}</p>
        <div className="proj-role-form">
          <div className="perm-field">
            <span>{t('projRoleProject')}</span>
            <OSelect
              testid="proj-role-project"
              ariaLabel={t('projRoleProject')}
              value={ovProject}
              options={(projects ?? []).map((p) => ({ label: p.name, value: p.id }))}
              onChange={setOvProject}
            />
          </div>
          <div className="perm-field">
            <span>{t('projRoleMember')}</span>
            <oas-input
              value={ovMemberQuery}
              aria-label={t('searchMembers')}
              placeholder={t('searchMembers')}
              data-testid="proj-role-member-search"
              onInput={(e) =>
                setOvMemberQuery((e.target as HTMLElement & { value?: string }).value ?? '')
              }
            />
            <OSelect
              testid="proj-role-member"
              ariaLabel={t('projRoleMember')}
              value={ovMember}
              options={(members ?? [])
                .filter((m) =>
                  ovMemberQuery.trim()
                    ? m.name.toLowerCase().includes(ovMemberQuery.trim().toLowerCase())
                    : true,
                )
                .map((m) => ({ label: m.name, value: m.id }))}
              onChange={setOvMember}
            />
          </div>
          <div className="perm-field">
            <span>{t('projRoleRole')}</span>
            <OSelect
              testid="proj-role-role"
              ariaLabel={t('projRoleRole')}
              value={ovRole}
              options={[
                { label: t('projRoleInherit'), value: '' },
                ...projectRoles.map((r) => ({ label: r.name, value: r.id })),
              ]}
              onChange={setOvRole}
            />
          </div>
          <oas-button
            type="primary"
            size="small"
            data-testid="proj-role-apply"
            onClick={() => void applyProjectRole()}
          >
            {t('projRoleApply')}
          </oas-button>
        </div>

        {(assignments ?? []).length > 0 ? (
          <ul className="proj-role-list" data-testid="proj-role-list">
            {assignments?.map((a) => (
              <li key={a.id}>
                <span>
                  {projectMap.get(a.projectId)?.name ?? a.projectId} /{' '}
                  {memberMap.get(a.memberId)?.name ?? a.memberId}
                </span>
                <span className="proj-role-name">
                  {roles?.find((r) => r.id === a.roleId)?.name ?? a.roleId}
                </span>
                <button
                  type="button"
                  className="proj-role-remove"
                  data-testid={`proj-role-remove-${a.id}`}
                  onClick={() => void projectRolesRepo.set(a.projectId, a.memberId, null)}
                >
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-hint">{t('projRoleEmpty')}</p>
        )}
      </div>

      <div className="admin-panel" data-testid="admin-audit">
        <p className="admin-panel-title">{t('auditTitle')}</p>
        {(audit ?? []).length > 0 ? (
          <ul className="audit-list">
            {audit?.map((e) => (
              <li key={e.id}>
                <span className="audit-time">
                  {new Date(e.at).toLocaleString(undefined, {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="audit-actor">{memberMap.get(e.actorId)?.name ?? e.actorId}</span>
                <span className="audit-action">
                  {AUDIT_LABEL[e.action] ? t(AUDIT_LABEL[e.action]) : e.action}
                </span>
                <span className="audit-target">{e.target}</span>
                {e.detail && <span className="audit-detail">{e.detail}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-hint" data-testid="audit-empty">
            {t('auditEmpty')}
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
