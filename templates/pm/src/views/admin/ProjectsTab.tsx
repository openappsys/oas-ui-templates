import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import type { Member, Project } from '@/types'
import { OMultiSelect, OSelect } from '@/components/oas-wrappers'

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

export function ProjectsTab({
  memberMap,
  currentUser,
}: {
  memberMap: Map<string, Member>
  currentUser: string
}) {
  const {
    projects: projectsRepo,
    admin,
    members: membersRepo,
    projectMembers: projectMembersRepo,
    audit: auditRepo,
  } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const modalRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLElement & { value?: string }>(null)
  const keyRef = useRef<HTMLElement & { value?: string }>(null)
  const descRef = useRef<HTMLElement & { value?: string }>(null)
  const [editing, setEditing] = useState<Project | null>(null)
  const [lead, setLead] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const memberModalRef = useRef<HTMLElement>(null)
  const [memberProject, setMemberProject] = useState<Project | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const errorTimer = useRef<number | undefined>(undefined)
  const inFlightRef = useRef(false)

  const list = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const projectMembers = useObservable(() => projectMembersRepo.liveAll(), [projectMembersRepo])
  const health = useObservable(() => admin.liveProjectHealth(), [admin])
  const healthMap = useMemo(
    () => new Map((health ?? []).map((h) => [h.projectId, h.total])),
    [health],
  )

  const showError = useCallback((msg: string) => {
    setError(msg)
    window.clearTimeout(errorTimer.current)
    errorTimer.current = window.setTimeout(() => setError(''), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(errorTimer.current), [])

  const listRef = useRef(list)
  listRef.current = list
  const memberOptions = useMemo(
    () => (members ?? []).map((m) => ({ label: m.name, value: m.id })),
    [members],
  )

  const openMembers = useCallback(
    (p: Project) => {
      setMemberProject(p)
      setSelectedMembers(
        (projectMembers ?? []).filter((a) => a.projectId === p.id).map((a) => a.memberId),
      )
      memberModalRef.current?.setAttribute('visible', '')
    },
    [projectMembers],
  )
  const openMembersRef = useRef(openMembers)
  openMembersRef.current = openMembers

  const saveMembers = useCallback(async () => {
    if (!memberProject) return
    try {
      await projectMembersRepo.setMembers(memberProject.id, selectedMembers)
      void auditRepo.add({
        id: nanoid(),
        at: Date.now(),
        actorId: currentUser,
        action: 'projectMember.set',
        target: memberProject.name,
        detail: String(selectedMembers.length),
      })
      memberModalRef.current?.removeAttribute('visible')
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    }
  }, [memberProject, selectedMembers, projectMembersRepo, auditRepo, currentUser, showError])

  const openModal = useCallback(
    (p: Project | null) => {
      setEditing(p)
      setLead(p?.leadId ?? memberOptions[0]?.value ?? '')
      setFieldError('')
      if (nameRef.current) nameRef.current.value = p?.name ?? ''
      if (keyRef.current) keyRef.current.value = p?.key ?? ''
      if (descRef.current) descRef.current.value = p?.description ?? ''
      modalRef.current?.setAttribute('visible', '')
    },
    [memberOptions],
  )
  const openModalRef = useRef(openModal)
  openModalRef.current = openModal

  const save = useCallback(async () => {
    if (inFlightRef.current) return
    const name = (nameRef.current?.value ?? '').trim()
    const key = (keyRef.current?.value ?? '').trim().toUpperCase()
    const description = (descRef.current?.value ?? '').trim()
    if (!name) {
      setFieldError(t('adminNameRequired'))
      return
    }
    if (!key) {
      setFieldError(t('adminKeyRequired'))
      return
    }
    setFieldError('')
    inFlightRef.current = true
    try {
      if (editing) {
        await projectsRepo.update(editing.id, { name, key, description, leadId: lead })
      } else {
        await projectsRepo.create({
          id: nanoid(),
          name,
          key,
          description,
          leadId: lead,
          createdAt: Date.now(),
          nextKeyNum: 100001,
        })
      }
      modalRef.current?.removeAttribute('visible')
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    } finally {
      inFlightRef.current = false
    }
  }, [editing, lead, projectsRepo, showError])

  const remove = useCallback(
    async (id: string) => {
      try {
        await projectsRepo.delete(id)
      } catch {
        showError(t('adminProjectDeleteFailed'))
      }
    },
    [projectsRepo, showError],
  )
  const removeRef = useRef(remove)
  removeRef.current = remove

  const rows = useMemo(
    () =>
      (list ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        leadName: memberMap.get(p.leadId)?.name ?? '—',
        createdAt: new Date(p.createdAt).toLocaleDateString(),
      })),
    [list, memberMap],
  )

  const columns = useMemo<Col[]>(() => {
    return [
      { key: 'name', title: t('adminColName') },
      { key: 'key', title: t('key') },
      { key: 'leadName', title: t('adminColLead') },
      {
        key: 'issueCount',
        title: t('adminColIssues'),
        align: 'right',
        render: (row) => {
          const total = healthMap.get(String(row.id))
          return total === undefined ? '…' : total.toLocaleString()
        },
      },
      { key: 'createdAt', title: t('createdAt') },
      {
        key: 'actions',
        title: t('adminColActions'),
        render: (row) => {
          const id = String(row.id)
          const box = document.createElement('span')
          box.style.display = 'inline-flex'
          box.style.alignItems = 'center'
          box.style.gap = '6px'
          const edit = document.createElement('oas-button')
          edit.setAttribute('size', 'small')
          edit.setAttribute('data-testid', `admin-project-edit-${id}`)
          edit.textContent = t('adminEdit')
          edit.addEventListener('click', () => {
            const p = (listRef.current ?? []).find((x) => x.id === id)
            if (p) openModalRef.current(p)
          })
          const mem = document.createElement('oas-button')
          mem.setAttribute('size', 'small')
          mem.setAttribute('data-testid', `admin-project-members-${id}`)
          mem.textContent = t('projectMembers')
          mem.addEventListener('click', () => {
            const p = (listRef.current ?? []).find((x) => x.id === id)
            if (p) openMembersRef.current(p)
          })
          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('title', t('adminDeleteConfirm'))
          const del = document.createElement('oas-button')
          del.setAttribute('type', 'danger')
          del.setAttribute('size', 'small')
          del.setAttribute('data-testid', `admin-project-del-${id}`)
          del.textContent = t('delete')
          pop.appendChild(del)
          pop.addEventListener('oas-open-change', (e: Event) => {
            const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
            if (reason === 'ok') void removeRef.current(id)
          })
          box.append(mem, edit, pop)
          return box
        },
      },
    ]
  }, [healthMap])

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.columns = columns
    el.data = rows
  }, [columns, rows])

  return (
    <div className="admin-crud-page" data-testid="admin-tab-projects">
      <div className="admin-crud-top">
        <h1 className="page-h1">{t('adminProjectsTitle')}</h1>
        <oas-button
          type="primary"
          data-testid="admin-project-new"
          onClick={() => openModalRef.current(null)}
        >
          {t('adminNewProject')}
        </oas-button>
      </div>
      {error && (
        <oas-alert type="error" className="admin-crud-error" data-testid="admin-project-error">
          {error}
        </oas-alert>
      )}
      <div className="admin-panel">
        <oas-table
          ref={tableRef}
          className="admin-crud-table"
          row-key="id"
          data-testid="admin-table-projects"
        />
      </div>

      <oas-modal ref={modalRef} no-footer data-testid="admin-project-modal">
        <div className="create-body">
          <div className="create-field">
            <label htmlFor="admin-project-name">{t('adminColName')}</label>
            <oas-input ref={nameRef} data-testid="admin-project-name" />
          </div>
          <div className="create-field">
            <label htmlFor="admin-project-key">{t('key')}</label>
            <oas-input
              ref={keyRef}
              data-testid="admin-project-key"
              placeholder={t('adminKeyHint')}
            />
          </div>
          <div className="create-field">
            <label htmlFor="admin-project-desc">{t('description')}</label>
            <oas-input ref={descRef} data-testid="admin-project-desc" />
          </div>
          <div className="create-field">
            <label htmlFor="admin-project-lead">{t('adminColLead')}</label>
            <OSelect
              testid="admin-project-lead"
              value={lead}
              options={memberOptions}
              onChange={setLead}
            />
          </div>
          {fieldError && (
            <p className="create-error" data-testid="admin-project-field-error">
              {fieldError}
            </p>
          )}
          <div className="quit-actions">
            <oas-button
              data-testid="admin-project-cancel"
              onClick={() => modalRef.current?.removeAttribute('visible')}
            >
              {t('cancel')}
            </oas-button>
            <oas-button type="primary" data-testid="admin-project-save" onClick={() => void save()}>
              {editing ? t('save') : t('create')}
            </oas-button>
          </div>
        </div>
      </oas-modal>

      {/* 项目成员：负责人候选/成员筛选只看项目成员；工作区目录可搜索 */}
      <oas-modal ref={memberModalRef} no-footer data-testid="admin-project-members-modal">
        <div className="create-body">
          <h2 className="profile-title">{t('projectMembers')}</h2>
          <p className="profile-hint">{t('projectMembersHint')}</p>
          <OMultiSelect
            testid="admin-project-members-select"
            label={t('projectMembers')}
            searchLabel={t('searchMembers')}
            placeholder={t('allMembers')}
            value={selectedMembers}
            options={memberOptions}
            onChange={setSelectedMembers}
          />
          <div className="quit-actions">
            <oas-button
              data-testid="admin-project-members-cancel"
              onClick={() => memberModalRef.current?.removeAttribute('visible')}
            >
              {t('cancel')}
            </oas-button>
            <oas-button
              type="primary"
              data-testid="admin-project-members-save"
              onClick={() => void saveMembers()}
            >
              {t('save')}
            </oas-button>
          </div>
        </div>
      </oas-modal>
    </div>
  )
}
