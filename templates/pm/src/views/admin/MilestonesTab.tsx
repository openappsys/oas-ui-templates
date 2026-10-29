import { useEffect, useMemo, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import { dayInputToTs, tsToDayInput } from '@/lib/cycles'
import { OSelect } from '@/components/oas-wrappers'

/* ── 里程碑管理（独立 Admin 页）：卡片式行内编辑 + 进度聚合 + 逾期/完成标识 ── */
export function MilestonesTab() {
  const {
    milestones: milestonesRepo,
    issues: issuesRepo,
    projects: projectsRepo,
  } = useRepositories()
  const projects = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const [projectId, setProjectId] = useState('project-1')
  const rows = useObservable(() => milestonesRepo.live(projectId), [milestonesRepo, projectId])
  // 进度聚合（每里程碑 在库总数 / done 类别完成数）
  const progressRows = useObservable(
    () => milestonesRepo.liveMilestoneProgress(projectId),
    [milestonesRepo, projectId],
  )
  const progressById = useMemo(
    () => new Map((progressRows ?? []).map((p) => [p.milestoneId, p])),
    [progressRows],
  )
  const nameRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const now = Date.now()
  const tableRef = useRef<HTMLDivElement>(null)

  // 行内 popconfirm 确认删除（oas-open-change bubbles/composed，容器委托一次挂载）
  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason !== 'ok') return
      const host = e.target as HTMLElement | null
      const id = host?.getAttribute?.('data-milestone-id') ?? ''
      if (id) {
        setError('')
        void milestonesRepo.delete(id)
      }
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [milestonesRepo])

  const create = async () => {
    const name = (nameRef.current?.value ?? '').trim()
    if (!name) {
      setError(t('milestoneName'))
      return
    }
    const day = dateRef.current?.value ?? ''
    const desc = (descRef.current?.value ?? '').trim()
    setError('')
    await milestonesRepo.create({
      projectId,
      name,
      dueAt: day ? dayInputToTs(day) : null,
      ...(desc ? { description: desc } : {}),
    })
    if (nameRef.current) nameRef.current.value = ''
    if (dateRef.current) dateRef.current.value = ''
    if (descRef.current) descRef.current.value = ''
  }

  return (
    <div className="admin-crud-page" data-testid="admin-tab-milestones">
      <h1 className="page-h1">{t('adminNavMilestones')}</h1>
      <p className="admin-field-hint">{t('msEditHint')}</p>
      <div className="admin-field-row">
        <div className="admin-field-label">
          <span>{t('project')}</span>
        </div>
        <OSelect
          testid="admin-milestones-project"
          value={projectId}
          options={(projects ?? []).map((p) => ({ label: p.name, value: p.id }))}
          onChange={setProjectId}
        />
      </div>
      {error && (
        <p className="admin-cycle-warn" data-testid="admin-milestones-error">
          {error}
        </p>
      )}
      <div className="ms-table" ref={tableRef}>
        {(rows ?? []).map((m) => {
          const prog = progressById.get(m.id)
          const total = prog?.total ?? 0
          const done = prog?.done ?? 0
          const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
          const overdue = m.dueAt !== null && m.dueAt < now && done < total
          const allDone = total > 0 && done >= total
          // 删除确认带影响面（title 是 HTMLElement 原生 property，React 落不进 attribute——ref 回调写）
          const confirmText =
            total > 0
              ? t('msDeleteConfirmN').replace('{n}', String(total))
              : t('adminDeleteConfirm')
          return (
            <div className="ms-card" key={m.id} data-testid={`admin-milestone-row-${m.id}`}>
              <div className="ms-card-head">
                {/* 名称/日期行内编辑（key 重挂回显，失焦保存） */}
                <input
                  className="comment-input ms-edit-name"
                  data-testid={`admin-milestone-name-${m.id}`}
                  key={`${m.id}:${m.name}`}
                  defaultValue={m.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== m.name) void milestonesRepo.update(m.id, { name })
                    else e.target.value = m.name
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
                <input
                  type="date"
                  className="ms-edit-date"
                  data-testid={`admin-milestone-date-${m.id}`}
                  key={`${m.id}:${m.dueAt ?? ''}`}
                  defaultValue={m.dueAt ? tsToDayInput(m.dueAt) : ''}
                  onBlur={(e) => {
                    const day = e.target.value
                    const next = day ? dayInputToTs(day) : null
                    if (next !== (m.dueAt ?? null))
                      void milestonesRepo.update(m.id, { dueAt: next })
                  }}
                />
                <span className="ms-due-note">
                  {m.dueAt
                    ? t('milestoneDue').replace('{date}', new Date(m.dueAt).toLocaleDateString())
                    : ''}
                </span>
                {overdue && (
                  <oas-tag
                    size="small"
                    type="danger"
                    data-testid={`admin-milestone-overdue-${m.id}`}
                  >
                    {t('milestoneOverdue')}
                  </oas-tag>
                )}
                {allDone && (
                  <oas-tag
                    size="small"
                    type="success"
                    data-testid={`admin-milestone-alldone-${m.id}`}
                  >
                    {t('msAllDone')}
                  </oas-tag>
                )}
                <oas-popconfirm
                  data-milestone-id={m.id}
                  ref={(el) => {
                    if (el) (el as HTMLElement).setAttribute('title', confirmText)
                  }}
                >
                  <button
                    type="button"
                    className="states-del"
                    data-testid={`admin-milestone-del-${m.id}`}
                    title={t('milestoneDelete')}
                  >
                    ×
                  </button>
                </oas-popconfirm>
              </div>
              <input
                className="ms-edit-desc"
                data-testid={`admin-milestone-desc-${m.id}`}
                key={`${m.id}:${m.description ?? ''}`}
                placeholder={t('msDescPlaceholder')}
                defaultValue={m.description ?? ''}
                onBlur={(e) => {
                  const desc = e.target.value.trim()
                  if (desc !== (m.description ?? '')) {
                    void milestonesRepo.update(
                      m.id,
                      desc ? { description: desc } : { description: '' },
                    )
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
              <div className="ms-progress-row" data-testid={`admin-milestone-progress-${m.id}`}>
                <div className="ms-progress-track" aria-hidden>
                  <div
                    className={`ms-progress-fill${overdue ? ' is-overdue' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="ms-progress-text">
                  {t('msProgress')
                    .replace('{done}', String(done))
                    .replace('{total}', String(total))}
                  {total > 0 ? ` · ${pct}%` : ''}
                </span>
              </div>
            </div>
          )
        })}
        {(rows ?? []).length === 0 && (
          <p className="worklog-empty" data-testid="admin-milestones-empty">
            {t('milestoneEmpty')}
          </p>
        )}
      </div>
      <div className="states-add-row">
        <input
          ref={nameRef}
          className="comment-input states-name"
          data-testid="admin-milestone-new-name"
          placeholder={t('milestoneNamePlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
        />
        <input
          ref={descRef}
          className="comment-input ms-new-desc"
          data-testid="admin-milestone-new-desc"
          placeholder={t('msDescPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
        />
        <input
          ref={dateRef}
          type="date"
          className="states-color ms-date-input"
          data-testid="admin-milestone-new-date"
        />
        <oas-button
          size="small"
          type="primary"
          data-testid="admin-milestone-add"
          onClick={() => void create()}
        >
          {t('create')}
        </oas-button>
      </div>
    </div>
  )
}
