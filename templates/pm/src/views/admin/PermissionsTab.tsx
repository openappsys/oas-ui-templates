import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { t, type DictKey } from '@/i18n'
import type { MemberRole, Role } from '@/types'
import { can, builtinPermissions, type Action } from '@/permission/policy'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { OCheckbox, OMultiSelect, OSelect, OTabs } from '@/components/oas-wrappers'

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

type PermTab = 'roles' | 'access' | 'audit'

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

/** 项目覆盖下拉的「继承」哨兵：空字符串会被 oas-select 当成未选占位 */
const INHERIT = '__inherit__'

/** 权限按资源分组（编辑区、只读矩阵、组级全选共用） */
const PERM_GROUPS: Array<{ key: DictKey; actions: Action[] }> = [
  {
    key: 'permGroupIssue',
    actions: [
      'issue:create',
      'issue:edit',
      'issue:delete',
      'issue:change-status',
      'issue:change-assignee',
    ],
  },
  { key: 'permGroupComment', actions: ['comment:create', 'comment:edit', 'comment:delete'] },
  { key: 'permGroupView', actions: ['view:save', 'view:delete'] },
  { key: 'permGroupBulk', actions: ['bulk:apply', 'bulk:delete'] },
  { key: 'permGroupAdmin', actions: ['project:manage', 'member:manage'] },
]

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

function builtinLabel(id: string): string {
  return id === 'admin' || id === 'member' || id === 'viewer' ? roleLabel(id) : id
}

/** 内置三角色只读对比矩阵（一张表 group-by，列宽跨组对齐） */
function BuiltinMatrix() {
  const ref = useRef<TableHost>(null)
  const rows = useMemo(
    () =>
      PERM_GROUPS.flatMap((group) =>
        group.actions.map((action) => ({
          id: action,
          action: t(PERM_LABEL[action]),
          category: t(group.key),
          ...Object.fromEntries(
            MATRIX_ROLES.map((role) => [role, can({ id: 'matrix', role }, action) ? '✓' : '—']),
          ),
        })),
      ),
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
    const el = ref.current
    if (!el) return
    el.columns = columns
    el.data = rows
  }, [columns, rows])
  return (
    <oas-table
      ref={ref}
      className="admin-perm-table"
      row-key="id"
      group-by="category"
      data-testid="admin-permissions-matrix"
    />
  )
}

/**
 * 权限页：角色（master-detail：内置只读对比 + 自定义编辑，可复制内置）/
 * 项目访问（项目成员的项目角色覆盖 + 生效预览）/ 审计。
 */
export function PermissionsTab({ currentUser }: { currentUser: string }) {
  const {
    roles: rolesRepo,
    audit: auditRepo,
    projectRoles: projectRolesRepo,
    projects: projectsRepo,
    members: membersRepo,
  } = useRepositories()
  const roles = useObservable(() => rolesRepo.liveAll(), [rolesRepo])
  const [auditLimit, setAuditLimit] = useState(20)
  const audit = useObservable(() => auditRepo.liveRecent(auditLimit), [auditRepo, auditLimit])
  const assignments = useObservable(() => projectRolesRepo.liveAll(), [projectRolesRepo])
  const projects = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const memberMap = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects])

  const [tab, setTab] = useState<PermTab>('roles')
  const [selectedId, setSelectedId] = useState('admin')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'workspace' | 'project'>('workspace')
  const [perms, setPerms] = useState<Set<Action>>(new Set())
  const [roleQuery, setRoleQuery] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  // 成员分配弹窗（workspace 角色直接改成员角色；项目角色走「项目访问」）
  const assignModalRef = useRef<HTMLElement>(null)
  const [assignIds, setAssignIds] = useState<string[]>([])
  const [assignFallback, setAssignFallback] = useState('member')
  const [assignError, setAssignError] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)

  // 项目访问表单
  const [ovProject, setOvProject] = useState('')
  const [ovMember, setOvMember] = useState('')
  const [ovRole, setOvRole] = useState(INHERIT)
  const [auditQuery, setAuditQuery] = useState('')

  const builtins = useMemo(() => (roles ?? []).filter((r) => r.builtin), [roles])
  const custom = useMemo(() => (roles ?? []).filter((r) => !r.builtin), [roles])
  const projectRoles = useMemo(
    () => (roles ?? []).filter((r) => r.scope === 'project' && !r.builtin),
    [roles],
  )
  const selected = useMemo(
    () => (roles ?? []).find((r) => r.id === selectedId),
    [roles, selectedId],
  )
  const isBuiltin = selected?.builtin === true
  const isDraft = selectedId === '__new__'

  const roleFilter = roleQuery.trim().toLowerCase()
  const matchRole = (role: Role) =>
    !roleFilter ||
    (role.builtin ? builtinLabel(role.id) : role.name).toLowerCase().includes(roleFilter)
  const builtinList = builtins.filter(matchRole)
  const customList = custom.filter(matchRole)

  // 未保存变更：只对「有基线」的编辑生效；草稿以「填了内容」为脏
  const dirty = useMemo(() => {
    if (isDraft) {
      return (
        name.trim() !== '' || description.trim() !== '' || scope !== 'workspace' || perms.size > 0
      )
    }
    if (!selected) return false
    const base = new Set(selected.permissions as Action[])
    return (
      name !== selected.name ||
      description !== selected.description ||
      scope !== (selected.scope === 'project' ? 'project' : 'workspace') ||
      base.size !== perms.size ||
      [...perms].some((a) => !base.has(a))
    )
  }, [isDraft, name, description, scope, perms, selected])

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

  const select = (role: Role) => {
    setSelectedId(role.id)
    setName(role.name)
    setDescription(role.description)
    setScope(role.scope === 'project' ? 'project' : 'workspace')
    setPerms(new Set(role.permissions as Action[]))
    setError('')
    setSaved('')
  }

  const startDraft = () => {
    setSelectedId('__new__')
    setName('')
    setDescription('')
    setScope('workspace')
    setPerms(new Set())
    setError('')
    setSaved('')
  }

  const duplicateBuiltin = async (builtin: Role) => {
    const id = `role-${nanoid(6)}`
    const created: Role = {
      id,
      name: `${builtinLabel(builtin.id)} ${t('permRoleCopySuffix')}`,
      description: builtin.description,
      scope: 'workspace',
      builtin: false,
      permissions: builtinPermissions(builtin.id),
    }
    setBusy(true)
    try {
      await rolesRepo.create(created)
      log('role.create', created.name)
      select(created)
      setSaved(t('permRoleSaved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
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

  const toggleGroup = (actions: Action[]) => {
    setPerms((prev) => {
      const all = actions.every((a) => prev.has(a))
      const next = new Set(prev)
      for (const a of actions) {
        if (all) next.delete(a)
        else next.add(a)
      }
      return next
    })
    setSaved('')
  }

  const save = async () => {
    if (!isDraft && !selected) return
    if (busy) return
    const clean = name.trim()
    if (!clean) {
      setError(t('permRoleNameRequired'))
      return
    }
    setBusy(true)
    setError('')
    try {
      if (isDraft) {
        const id = `role-${nanoid(6)}`
        await rolesRepo.create({
          id,
          name: clean,
          description: description.trim(),
          scope,
          builtin: false,
          permissions: [...perms],
        })
        setSelectedId(id)
        log('role.create', clean)
      } else if (selected) {
        await rolesRepo.update(selected.id, {
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
    if (!selected || selected.builtin || busy) return
    setBusy(true)
    setError('')
    try {
      await rolesRepo.delete(selected.id)
      log('role.delete', selected.name)
      setSelectedId('admin')
      setSaved('')
    } catch {
      setError(t('permRoleInUse'))
    } finally {
      setBusy(false)
    }
  }

  const cancelEdit = () => {
    const back = !isDraft && selected ? selected : builtins.find((r) => r.id === 'admin')
    if (back) select(back)
    else setSelectedId('admin')
    setError('')
    setSaved('')
  }

  const applyProjectRole = async () => {
    if (!ovProject || !ovMember || busy) return
    const roleId = ovRole === INHERIT ? null : ovRole
    setBusy(true)
    try {
      await projectRolesRepo.set(ovProject, ovMember, roleId)
      const target = `${projectMap.get(ovProject)?.name ?? ovProject} / ${
        memberMap.get(ovMember)?.name ?? ovMember
      }`
      log(
        roleId ? 'projectRole.set' : 'projectRole.clear',
        target,
        roleId ? (roles?.find((r) => r.id === roleId)?.name ?? roleId) : undefined,
      )
      setSaved(t('permRoleSaved'))
    } finally {
      setBusy(false)
    }
  }

  const clearAssignment = async (a: { projectId: string; memberId: string }) => {
    await projectRolesRepo.set(a.projectId, a.memberId, null)
    log(
      'projectRole.clear',
      `${projectMap.get(a.projectId)?.name ?? a.projectId} / ${
        memberMap.get(a.memberId)?.name ?? a.memberId
      }`,
    )
  }

  const assignedTo = useMemo(() => {
    if (!selected) return { count: 0, names: [] as string[] }
    if (selected.scope === 'project') {
      const rows = (assignments ?? []).filter((a) => a.roleId === selected.id)
      return {
        count: rows.length,
        names: rows.map(
          (a) =>
            `${projectMap.get(a.projectId)?.name ?? a.projectId} / ${
              memberMap.get(a.memberId)?.name ?? a.memberId
            }`,
        ),
      }
    }
    const rows = (members ?? []).filter((m) => m.role === selected.id)
    return { count: rows.length, names: rows.map((m) => m.name) }
  }, [selected, assignments, members, memberMap, projectMap])

  // ── 角色成员分配（workspace 角色）与分配概览 ──
  const workspaceRoles = useMemo(() => (roles ?? []).filter((r) => r.scope !== 'project'), [roles])
  const memberOptions = useMemo(
    () => (members ?? []).map((m) => ({ label: m.name, value: m.id })),
    [members],
  )
  const fallbackOptions = useMemo(
    () =>
      workspaceRoles
        .filter((r) => r.id !== selected?.id)
        .map((r) => ({
          label: r.builtin ? builtinLabel(r.id) : r.name,
          value: r.id,
        })),
    [workspaceRoles, selected?.id],
  )
  const selectedName = selected
    ? selected.builtin
      ? builtinLabel(selected.id)
      : selected.name
    : ''

  const openAssign = () => {
    if (!selected || selected.scope === 'project') return
    setAssignIds((members ?? []).filter((m) => m.role === selected.id).map((m) => m.id))
    const opts = workspaceRoles.filter((r) => r.id !== selected.id)
    // 回退优先「成员」，其次「只读」；避免把被移除的人默认抬成管理员
    const preferred = ['member', 'viewer'].find((id) => opts.some((r) => r.id === id))
    setAssignFallback(preferred ?? opts[opts.length - 1]?.id ?? '')
    setAssignError('')
    assignModalRef.current?.setAttribute('visible', '')
  }

  const closeAssign = () => {
    assignModalRef.current?.removeAttribute('visible')
  }

  const saveAssign = async () => {
    if (!selected || assignBusy || selected.scope === 'project') return
    const roleId = selected.id
    if (roleId === 'admin' && assignIds.length === 0) {
      setAssignError(t('permAssignLastAdmin'))
      return
    }
    const current = members ?? []
    const toAdd = assignIds.filter((id) => current.find((m) => m.id === id)?.role !== roleId)
    const toRemove = current.filter((m) => m.role === roleId && !assignIds.includes(m.id))
    if (toAdd.length === 0 && toRemove.length === 0) {
      closeAssign()
      return
    }
    setAssignBusy(true)
    setAssignError('')
    try {
      await Promise.all([
        ...toAdd.map((id) => membersRepo.update(id, { role: roleId })),
        ...toRemove.map((m) => membersRepo.update(m.id, { role: assignFallback })),
      ])
      const fallbackRole = workspaceRoles.find((r) => r.id === assignFallback)
      log(
        'member.role',
        selectedName,
        `+${toAdd.length} / -${toRemove.length} · ${roleDisplay(fallbackRole)}`,
      )
      setSaved(t('permAssignSaved'))
      closeAssign()
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e))
    } finally {
      setAssignBusy(false)
    }
  }

  const assignSummary =
    selected && !isDraft ? (
      <div className="perm-assign-summary" data-testid="perm-assigned">
        <div>
          <p className="perm-assign-title">
            {selected.scope === 'project'
              ? t('permAssignedProjects').replace('{n}', String(assignedTo.count))
              : t('permAssignedCount').replace('{n}', String(assignedTo.count))}
          </p>
          <p className="admin-hint">
            {assignedTo.names.length > 0
              ? `${assignedTo.names.slice(0, 6).join('、')}${assignedTo.count > 6 ? '…' : ''}`
              : t('permAssignNone')}
          </p>
        </div>
        {selected.scope === 'project' ? (
          <oas-button size="small" data-testid="perm-assign-goto" onClick={() => setTab('access')}>
            {t('permAssignGoto')}
          </oas-button>
        ) : (
          <oas-button size="small" data-testid="perm-assign-open" onClick={openAssign}>
            {t('permAssignManage')}
          </oas-button>
        )}
      </div>
    ) : null

  // 生效权限预览：工作区角色 + 项目覆盖 → 最终角色（内置角色显示本地化名称）
  const roleDisplay = (role?: Role) =>
    role ? (role.builtin ? builtinLabel(role.id) : role.name) : t('projRoleInherit')
  const selectedMember = (members ?? []).find((m) => m.id === ovMember)
  const workspaceRole = roles?.find((r) => r.id === selectedMember?.role)
  const override = (assignments ?? []).find(
    (a) => a.projectId === ovProject && a.memberId === ovMember,
  )
  const overrideRole = roles?.find((r) => r.id === override?.roleId)
  const finalRole = overrideRole ?? workspaceRole

  useEffect(() => {
    if (!ovProject || !ovMember) return
    const saved = (assignments ?? []).find(
      (a) => a.projectId === ovProject && a.memberId === ovMember,
    )
    setOvRole(saved?.roleId ?? INHERIT)
  }, [ovProject, ovMember, assignments])

  const auditFilter = auditQuery.trim().toLowerCase()
  const auditRows = (audit ?? []).filter((e) => {
    if (!auditFilter) return true
    const actor = memberMap.get(e.actorId)?.name ?? e.actorId
    const action = AUDIT_LABEL[e.action] ? t(AUDIT_LABEL[e.action]) : e.action
    return `${actor} ${action} ${e.target} ${e.detail ?? ''}`.toLowerCase().includes(auditFilter)
  })

  const exportAudit = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header = [
      t('auditColTime'),
      t('auditColActor'),
      t('auditColAction'),
      t('auditColTarget'),
      t('auditColDetail'),
    ]
    const lines = auditRows.map((e) =>
      [
        new Date(e.at).toLocaleString(),
        memberMap.get(e.actorId)?.name ?? e.actorId,
        AUDIT_LABEL[e.action] ? t(AUDIT_LABEL[e.action]) : e.action,
        e.target,
        e.detail ?? '',
      ]
        .map(cell)
        .join(','),
    )
    const blob = new Blob([`\ufeff${[header.map(cell).join(','), ...lines].join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pm-audit.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-crud-page" data-testid="admin-tab-permissions">
      <h1 className="page-h1">{t('adminPermTitle')}</h1>

      <div className="perm-tabs">
        <OTabs
          testid="perm-tabs"
          ariaLabel={t('adminPermTitle')}
          value={tab}
          options={[
            { label: t('permTabRoles'), value: 'roles' },
            { label: t('permTabAccess'), value: 'access' },
            { label: t('permTabAudit'), value: 'audit' },
          ]}
          onChange={(v) => setTab(v as PermTab)}
        />
      </div>

      {tab === 'roles' && (
        <div className="perm-layout" data-testid="perm-roles-tab">
          <aside className="perm-role-list" data-testid="admin-custom-roles">
            <oas-input
              value={roleQuery}
              aria-label={t('permSearchRoles')}
              placeholder={t('permSearchRoles')}
              data-testid="perm-role-search"
              onInput={(e) =>
                setRoleQuery((e.target as HTMLElement & { value?: string }).value ?? '')
              }
            />
            {builtinList.length > 0 && (
              <p className="perm-role-group-label">{t('permBuiltinGroup')}</p>
            )}
            {builtinList.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`perm-role-chip${selectedId === role.id ? ' is-active' : ''}`}
                data-testid={`perm-role-${role.id}`}
                onClick={() => select(role)}
              >
                {builtinLabel(role.id)}
                <span className="perm-role-scope">{t('roleScopeWorkspace')}</span>
                <span className="perm-role-lock">{t('permBuiltin')}</span>
              </button>
            ))}
            <div className="perm-role-list-head">
              <span className="perm-role-group-label">{t('permCustomGroup')}</span>
              <button
                type="button"
                className="perm-role-add"
                data-testid="perm-role-new"
                onClick={startDraft}
              >
                + {t('permNewRole')}
              </button>
            </div>
            {customList.length === 0 ? (
              <p className="perm-role-empty" data-testid="perm-role-empty">
                {roleFilter ? t('permNoMatch') : t('permNoCustomRoles')}
              </p>
            ) : (
              customList.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`perm-role-chip${selectedId === role.id ? ' is-active' : ''}`}
                  data-testid={`perm-role-${role.id}`}
                  onClick={() => select(role)}
                >
                  {role.name}
                  <span className="perm-role-scope">
                    {role.scope === 'project' ? t('roleScopeProject') : t('roleScopeWorkspace')}
                  </span>
                </button>
              ))
            )}
          </aside>

          <section className="perm-detail">
            {isBuiltin && selected ? (
              <>
                <div className="perm-detail-head">
                  <div>
                    <p className="admin-panel-title">{builtinLabel(selected.id)}</p>
                    <p className="admin-hint">{t('adminPermBuiltinHint')}</p>
                  </div>
                  <oas-button
                    size="small"
                    data-testid="perm-role-duplicate"
                    onClick={() => void duplicateBuiltin(selected)}
                  >
                    {t('permDuplicate')}
                  </oas-button>
                </div>
                {assignSummary}
                <BuiltinMatrix />
                {saved && (
                  <oas-alert type="success" size="small" data-testid="perm-saved">
                    {saved}
                  </oas-alert>
                )}
              </>
            ) : (
              <>
                <div className="perm-detail-head">
                  <div className="perm-detail-title">
                    <p className="admin-panel-title">
                      {isDraft ? t('permNewRole') : t('permEditRole')}
                    </p>
                    {dirty && (
                      <span className="perm-unsaved" data-testid="perm-unsaved">
                        {t('permUnsaved')}
                      </span>
                    )}
                  </div>
                  <span className="admin-hint">
                    {t('permGrantedCount').replace('{n}', String(perms.size))}
                  </span>
                </div>
                {assignSummary}
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

                <div className="perm-groups" data-testid="perm-checks">
                  {PERM_GROUPS.map((group) => {
                    const hit = group.actions.filter((a) => perms.has(a)).length
                    return (
                      <section
                        key={group.key}
                        className="perm-group"
                        data-testid={`perm-group-${group.key}`}
                      >
                        <div className="perm-group-head">
                          <OCheckbox
                            testid={`perm-group-all-${group.key}`}
                            ariaLabel={`${t(group.key)} ${t('permSelectAll')}`}
                            checked={hit === group.actions.length}
                            indeterminate={hit > 0 && hit < group.actions.length}
                            onChange={() => toggleGroup(group.actions)}
                          />
                          <p className="perm-group-title">{t(group.key)}</p>
                          <span className="perm-group-count">
                            {hit}/{group.actions.length}
                          </span>
                        </div>
                        <div className="perm-checks">
                          {group.actions.map((action) => (
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
                      </section>
                    )
                  })}
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
                  {selected && !isDraft && (
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
                  <oas-button size="small" data-testid="perm-role-cancel" onClick={cancelEdit}>
                    {t('cancel')}
                  </oas-button>
                  <oas-button
                    type="primary"
                    size="small"
                    data-testid="perm-role-save"
                    disabled={busy || !dirty ? '' : undefined}
                    onClick={() => void save()}
                  >
                    {t('save')}
                  </oas-button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'access' && (
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
              <OSelect
                testid="proj-role-member"
                ariaLabel={t('projRoleMember')}
                value={ovMember}
                searchable
                options={(members ?? []).map((m) => ({ label: m.name, value: m.id }))}
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
                  { label: t('projRoleInherit'), value: INHERIT },
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

          <div className="proj-role-effective" data-testid="proj-role-effective">
            <div>
              <span>{t('projRoleWorkspaceRole')}</span>
              <strong>{roleDisplay(workspaceRole)}</strong>
            </div>
            <div>
              <span>{t('projRoleOverride')}</span>
              <strong>{overrideRole ? roleDisplay(overrideRole) : t('projRoleNone')}</strong>
            </div>
            <div>
              <span>{t('projRoleEffectiveLabel')}</span>
              <strong>{roleDisplay(finalRole)}</strong>
            </div>
          </div>

          <p className="admin-panel-title proj-role-list-title">{t('projRoleAssignments')}</p>
          {(assignments ?? []).length > 0 ? (
            <ul className="proj-role-list" data-testid="proj-role-list">
              {assignments?.map((a) => (
                <li key={a.id}>
                  <span className="proj-role-target">
                    {projectMap.get(a.projectId)?.name ?? a.projectId} /{' '}
                    {memberMap.get(a.memberId)?.name ?? a.memberId}
                  </span>
                  <span className="proj-role-name">
                    {roleDisplay(roles?.find((r) => r.id === a.roleId))}
                  </span>
                  <button
                    type="button"
                    className="proj-role-remove"
                    data-testid={`proj-role-remove-${a.id}`}
                    onClick={() => void clearAssignment(a)}
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
      )}

      {tab === 'audit' && (
        <div className="admin-panel" data-testid="admin-audit">
          <div className="perm-section-head">
            <div>
              <p className="admin-panel-title">{t('auditTitle')}</p>
              <p className="admin-hint">
                {t('auditRecentHint').replace('{n}', String(auditLimit))}
              </p>
            </div>
            <div className="audit-tools">
              <oas-input
                value={auditQuery}
                aria-label={t('auditFilterPlaceholder')}
                placeholder={t('auditFilterPlaceholder')}
                data-testid="audit-filter"
                onInput={(e) =>
                  setAuditQuery((e.target as HTMLElement & { value?: string }).value ?? '')
                }
              />
              <oas-button
                size="small"
                data-testid="audit-export"
                disabled={auditRows.length === 0 ? '' : undefined}
                onClick={exportAudit}
              >
                {t('auditExport')}
              </oas-button>
            </div>
          </div>
          {(audit ?? []).length > 0 ? (
            auditRows.length > 0 ? (
              <>
                <div className="audit-table" data-testid="audit-table">
                  <div className="audit-row audit-head" aria-hidden="true">
                    <span>{t('auditColTime')}</span>
                    <span>{t('auditColActor')}</span>
                    <span>{t('auditColAction')}</span>
                    <span>{t('auditColTarget')}</span>
                    <span>{t('auditColDetail')}</span>
                  </div>
                  {auditRows.map((e) => (
                    <div key={e.id} className="audit-row">
                      <span className="audit-time">
                        {new Date(e.at).toLocaleString(undefined, {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="audit-actor">
                        {memberMap.get(e.actorId)?.name ?? e.actorId}
                      </span>
                      <span className="audit-action">
                        {AUDIT_LABEL[e.action] ? t(AUDIT_LABEL[e.action]) : e.action}
                      </span>
                      <span className="audit-target">{e.target}</span>
                      <span className="audit-detail">{e.detail ?? '—'}</span>
                    </div>
                  ))}
                </div>
                {(audit ?? []).length >= auditLimit && (
                  <div className="audit-more">
                    <oas-button
                      size="small"
                      data-testid="audit-more"
                      onClick={() => setAuditLimit((n) => n + 20)}
                    >
                      {t('auditLoadMore')}
                    </oas-button>
                  </div>
                )}
              </>
            ) : (
              <p className="admin-hint" data-testid="audit-no-match">
                {t('auditNoMatch')}
              </p>
            )
          ) : (
            <p className="admin-hint" data-testid="audit-empty">
              {t('auditEmpty')}
            </p>
          )}
        </div>
      )}

      <oas-modal
        ref={assignModalRef}
        no-footer
        className="perm-assign-modal"
        data-testid="perm-assign-modal"
      >
        <div className="create-body">
          <h2 className="profile-title">{selectedName}</h2>
          <p className="profile-hint">{t('permAssignHint')}</p>
          <OMultiSelect
            testid="perm-assign-members"
            value={assignIds}
            options={memberOptions}
            label={t('permAssignMembers')}
            searchLabel={t('searchMembers')}
            placeholder={t('permAssignPlaceholder')}
            maxTagCount={4}
            onChange={setAssignIds}
          />
          <div className="create-field">
            <label htmlFor="perm-assign-fallback">{t('permAssignFallback')}</label>
            <OSelect
              testid="perm-assign-fallback"
              ariaLabel={t('permAssignFallback')}
              value={assignFallback}
              options={fallbackOptions}
              onChange={setAssignFallback}
            />
          </div>
          <p className="profile-hint">{t('permAssignFallbackHint')}</p>
          {assignError && (
            <p className="create-error" data-testid="perm-assign-error">
              {assignError}
            </p>
          )}
          <div className="quit-actions">
            <oas-button data-testid="perm-assign-cancel" onClick={closeAssign}>
              {t('cancel')}
            </oas-button>
            <oas-button
              type="primary"
              data-testid="perm-assign-save"
              disabled={assignBusy ? '' : undefined}
              onClick={() => void saveAssign()}
            >
              {t('save')}
            </oas-button>
          </div>
        </div>
      </oas-modal>
    </div>
  )
}
