import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { getLang, t } from '@/i18n'
import { AVATAR_PALETTE } from '@/lib/colors'
import { isWorkspaceAction, type Action } from '@/permission/policy'
import { OSelect } from '@/components/oas-wrappers'

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
type SelectEl = HTMLElement & {
  value?: string
  options?: Array<{ label: string; value: string }>
}

/** 头像色板与 seed 同源（src/lib/colors.ts：700 档保证白字 ≥4.5） */
const PALETTE = AVATAR_PALETTE

export function MembersTab({
  currentUser,
  onMemberDeleted,
  canWorkspace,
}: {
  currentUser: string
  onMemberDeleted: (id: string) => void
  /** 无工作区管理权限时不能授予含工作区动作的角色（防止成员管理员自提权） */
  canWorkspace: boolean
}) {
  const { members: membersRepo, roles: rolesRepo, audit: auditRepo, admin } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const modalRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLElement & { value?: string }>(null)
  const emailRef = useRef<HTMLElement & { value?: string }>(null)
  const [newRole, setNewRole] = useState('member')
  // 新建成员种类：human（缺省）/ agent（AI 执行者，可被指派、自动推进）
  const [newKind, setNewKind] = useState<'human' | 'agent'>('human')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const errorTimer = useRef<number | undefined>(undefined)
  const inFlightRef = useRef(false)

  const list = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const roles = useObservable(() => rolesRepo.liveAll(), [rolesRepo])
  const workload = useObservable(() => admin.liveMemberWorkload(), [admin])
  const workloadMap = useMemo(
    () => new Map((workload ?? []).map((w) => [w.memberId, w.inProgress])),
    [workload],
  )
  const listRef = useRef(list)
  listRef.current = list

  const showError = useCallback((msg: string) => {
    setError(msg)
    window.clearTimeout(errorTimer.current)
    errorTimer.current = window.setTimeout(() => setError(''), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(errorTimer.current), [])

  const roleLabel = useCallback(
    (id: string) => {
      if (id === 'admin') return t('adminRoleAdmin')
      if (id === 'member') return t('adminRoleMember')
      if (id === 'viewer') return t('adminRoleViewer')
      return roles?.find((r) => r.id === id)?.name ?? id
    },
    [roles],
  )

  const roleOptions = useMemo(
    () =>
      (roles ?? [])
        .filter((r) => r.scope !== 'project')
        .filter(
          (r) => canWorkspace || !(r.permissions as Action[]).some((a) => isWorkspaceAction(a)),
        )
        .map((r) => ({ label: roleLabel(r.id), value: r.id })),
    [roles, roleLabel, canWorkspace],
  )

  const openModal = useCallback(() => {
    setNewRole('member')
    setNewKind('human')
    setFieldError('')
    if (nameRef.current) nameRef.current.value = ''
    if (emailRef.current) emailRef.current.value = ''
    modalRef.current?.setAttribute('visible', '')
  }, [])
  const openModalRef = useRef(openModal)
  openModalRef.current = openModal

  const save = useCallback(async () => {
    if (inFlightRef.current) return
    const name = (nameRef.current?.value ?? '').trim()
    const email = (emailRef.current?.value ?? '').trim()
    if (!name) {
      setFieldError(t('adminNameRequired'))
      return
    }
    if (!email) {
      setFieldError(t('adminEmailRequired'))
      return
    }
    setFieldError('')
    inFlightRef.current = true
    try {
      await membersRepo.create({
        id: nanoid(),
        name,
        email,
        role: newRole,
        avatarColor: PALETTE[(listRef.current?.length ?? 0) % PALETTE.length],
        kind: newKind === 'agent' ? 'agent' : 'human',
      })
      modalRef.current?.removeAttribute('visible')
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    } finally {
      inFlightRef.current = false
    }
  }, [membersRepo, newRole, newKind, showError])

  const changeRole = useCallback(
    async (id: string, role: string, sel: SelectEl, prev: string) => {
      const next = (roles ?? []).find((r) => r.id === role)
      if (
        !canWorkspace &&
        next &&
        (next.id === 'admin' || (next.permissions as Action[]).some((a) => isWorkspaceAction(a)))
      ) {
        sel.value = prev
        showError(t('adminRoleElevateBlocked'))
        return
      }
      try {
        await membersRepo.update(id, { role })
        const target = listRef.current?.find((m) => m.id === id)?.name ?? id
        void auditRepo
          .add({
            id: nanoid(),
            at: Date.now(),
            actorId: currentUser,
            action: 'member.role',
            target,
            detail: roleLabel(role),
          })
          .catch((e) => console.error('[audit] member.role', target, e))
      } catch {
        sel.value = prev
        showError(t('adminRoleDemoteFailed'))
      }
    },
    [membersRepo, auditRepo, currentUser, roleLabel, showError, canWorkspace, roles],
  )
  const changeRoleRef = useRef(changeRole)
  changeRoleRef.current = changeRole

  const remove = useCallback(
    async (id: string) => {
      try {
        await membersRepo.delete(id)
        onMemberDeleted(id)
      } catch {
        showError(t('adminMemberDeleteFailed'))
      }
    },
    [membersRepo, onMemberDeleted, showError],
  )
  const removeRef = useRef(remove)
  removeRef.current = remove

  const PAGE_SIZE = 20
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list ?? []
    return (list ?? []).filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q))
  }, [list, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  useEffect(() => {
    setPage(0)
  }, [query])
  const rows = useMemo(
    () =>
      filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((m) => ({
        id: m.id,
        name:
          (m.id === currentUser ? `${m.name}${t('adminMe')}` : m.name) +
          (m.kind === 'agent' ? ` ${t('memberAgentTag')}` : ''),
        email: m.email,
        role: m.role,
        inProgress: workloadMap.get(m.id)?.toLocaleString() ?? '…',
      })),
    [filtered, safePage, workloadMap, currentUser],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: 语言切换需要重建表头/操作文案
  const columns = useMemo<Col[]>(
    () => [
      { key: 'name', title: t('adminMemberName') },
      { key: 'email', title: t('adminColEmail') },
      {
        key: 'role',
        title: t('adminColRole'),
        render: (row) => {
          const sel = document.createElement('oas-select') as SelectEl
          sel.setAttribute('size', 'small')
          sel.setAttribute('label', `${t('adminColRole')} · ${String(row.name ?? '')}`)
          sel.setAttribute('data-testid', `admin-member-role-${String(row.id)}`)
          sel.style.width = '120px'
          sel.options = roleOptions
          sel.value = String(row.role)
          sel.addEventListener('oas-change', (e: Event) => {
            const v = (e as CustomEvent<{ value?: string }>).detail?.value
            if (typeof v !== 'string' || v === row.role) return
            void changeRoleRef.current(String(row.id), v, sel, String(row.role))
          })
          return sel
        },
      },
      { key: 'inProgress', title: t('adminColInProgress'), align: 'right' },
      {
        key: 'actions',
        title: t('adminColActions'),
        render: (row) => {
          const id = String(row.id)
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('title', t('adminRemoveConfirm'))
          const del = document.createElement('oas-button')
          del.setAttribute('type', 'danger')
          del.setAttribute('size', 'small')
          del.setAttribute('data-testid', `admin-member-del-${id}`)
          del.textContent = t('delete')
          pop.appendChild(del)
          pop.addEventListener('oas-open-change', (e: Event) => {
            const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
            if (reason === 'ok') void removeRef.current(id)
          })
          return pop
        },
      },
    ],
    [roleOptions, getLang()],
  )

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.columns = columns
    el.data = rows
  }, [columns, rows])

  return (
    <div className="admin-crud-page" data-testid="admin-tab-members">
      <div className="admin-crud-top">
        <h1 className="page-h1">{t('adminMembersTitle')}</h1>
        <div className="admin-tools">
          <oas-input
            value={query}
            aria-label={t('searchMembers')}
            placeholder={t('searchMembers')}
            data-testid="admin-member-search"
            onInput={(e) => setQuery((e.target as HTMLElement & { value?: string }).value ?? '')}
          />
          <span className="admin-count" data-testid="admin-member-count">
            {filtered.length}
          </span>
          <oas-button
            size="small"
            data-testid="admin-member-prev"
            aria-label={t('adminPrevPage')}
            disabled={safePage === 0 ? '' : undefined}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹
          </oas-button>
          <oas-button
            size="small"
            data-testid="admin-member-next"
            aria-label={t('adminNextPage')}
            disabled={safePage >= pageCount - 1 ? '' : undefined}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            ›
          </oas-button>
          <oas-button
            type="primary"
            data-testid="admin-member-new"
            onClick={() => openModalRef.current()}
          >
            {t('adminNewMember')}
          </oas-button>
        </div>
      </div>
      {error && (
        <oas-alert type="error" className="admin-crud-error" data-testid="admin-member-error">
          {error}
        </oas-alert>
      )}
      <div className="admin-panel">
        <oas-table
          ref={tableRef}
          className="admin-crud-table"
          row-key="id"
          data-testid="admin-table-members"
        />
      </div>

      <oas-modal ref={modalRef} no-footer data-testid="admin-member-modal">
        <div className="create-body">
          <div className="create-field">
            <label htmlFor="admin-member-name">{t('adminMemberName')}</label>
            <oas-input ref={nameRef} data-testid="admin-member-name" />
          </div>
          <div className="create-field">
            <label htmlFor="admin-member-email">{t('adminColEmail')}</label>
            <oas-input ref={emailRef} data-testid="admin-member-email" placeholder="user@oas.dev" />
          </div>
          <div className="create-field">
            <label htmlFor="admin-member-role-new">{t('adminColRole')}</label>
            <OSelect
              testid="admin-member-role-new"
              value={newRole}
              options={roleOptions}
              onChange={(v) => setNewRole(v)}
            />
          </div>
          <div className="create-field">
            <label htmlFor="admin-member-kind-new">{t('adminMemberKind')}</label>
            <OSelect
              testid="admin-member-kind-new"
              value={newKind}
              options={[
                { label: t('memberKindHuman'), value: 'human' },
                { label: t('memberKindAgent'), value: 'agent' },
              ]}
              onChange={(v) => setNewKind(v === 'agent' ? 'agent' : 'human')}
            />
          </div>
          {fieldError && (
            <p className="create-error" data-testid="admin-member-field-error">
              {fieldError}
            </p>
          )}
          <div className="quit-actions">
            <oas-button
              data-testid="admin-member-cancel"
              onClick={() => modalRef.current?.removeAttribute('visible')}
            >
              {t('cancel')}
            </oas-button>
            <oas-button type="primary" data-testid="admin-member-save" onClick={() => void save()}>
              {t('create')}
            </oas-button>
          </div>
        </div>
      </oas-modal>
    </div>
  )
}
