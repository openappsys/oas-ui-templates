import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import { AVATAR_PALETTE } from '@/lib/colors'
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
}: {
  currentUser: string
  onMemberDeleted: (id: string) => void
}) {
  const { members: membersRepo, roles: rolesRepo, audit: auditRepo, admin } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const modalRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLElement & { value?: string }>(null)
  const emailRef = useRef<HTMLElement & { value?: string }>(null)
  const [newRole, setNewRole] = useState('member')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
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
    () => (roles ?? []).map((r) => ({ label: roleLabel(r.id), value: r.id })),
    [roles, roleLabel],
  )

  const openModal = useCallback(() => {
    setNewRole('member')
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
      })
      modalRef.current?.removeAttribute('visible')
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    } finally {
      inFlightRef.current = false
    }
  }, [membersRepo, newRole, showError])

  const changeRole = useCallback(
    async (id: string, role: string, sel: SelectEl, prev: string) => {
      try {
        await membersRepo.update(id, { role })
        const target = listRef.current?.find((m) => m.id === id)?.name ?? id
        void auditRepo.add({
          id: nanoid(),
          at: Date.now(),
          actorId: currentUser,
          action: 'member.role',
          target,
          detail: roleLabel(role),
        })
      } catch {
        sel.value = prev
        showError(t('adminRoleDemoteFailed'))
      }
    },
    [membersRepo, auditRepo, currentUser, roleLabel, showError],
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

  const rows = useMemo(
    () =>
      (list ?? []).map((m) => ({
        id: m.id,
        name: m.id === currentUser ? `${m.name}${t('adminMe')}` : m.name,
        email: m.email,
        role: m.role,
        inProgress: workloadMap.get(m.id)?.toLocaleString() ?? '…',
      })),
    [list, workloadMap, currentUser],
  )

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
    [roleOptions],
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
        <oas-button
          type="primary"
          data-testid="admin-member-new"
          onClick={() => openModalRef.current()}
        >
          {t('adminNewMember')}
        </oas-button>
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
