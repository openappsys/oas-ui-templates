import { useEffect, useMemo, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import { OSelect } from '@/components/oas-wrappers'

/* ── 模块管理（独立 Admin 页）：项目内 Issue 归类容器——卡片式行内编辑 + 归属计数 ── */
export function ModulesTab() {
  const { modules: modulesRepo, projects: projectsRepo, members: membersRepo } = useRepositories()
  const projects = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const [projectId, setProjectId] = useState('project-1')
  const rows = useObservable(() => modulesRepo.live(projectId), [modulesRepo, projectId])
  const counts = useObservable(
    () => modulesRepo.liveModuleCounts(projectId),
    [modulesRepo, projectId],
  )
  const countById = useMemo(
    () => new Map((counts ?? []).map((c) => [c.moduleId, c.total])),
    [counts],
  )
  const memberName = useMemo(() => new Map((members ?? []).map((m) => [m.id, m.name])), [members])
  const nameRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const tableRef = useRef<HTMLDivElement>(null)

  // 行内 popconfirm 确认删除（oas-open-change bubbles/composed，容器委托一次挂载）
  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason !== 'ok') return
      const host = e.target as HTMLElement | null
      const id = host?.getAttribute?.('data-module-id') ?? ''
      if (id) {
        setError('')
        void modulesRepo.delete(id).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err))
        })
      }
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [modulesRepo])

  const create = async () => {
    const name = (nameRef.current?.value ?? '').trim()
    if (!name) {
      setError(t('moduleName'))
      return
    }
    const desc = (descRef.current?.value ?? '').trim()
    setError('')
    try {
      await modulesRepo.create({
        projectId,
        name,
        ...(desc ? { description: desc } : {}),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }
    if (nameRef.current) nameRef.current.value = ''
    if (descRef.current) descRef.current.value = ''
  }

  return (
    <div className="admin-crud-page" data-testid="admin-tab-modules">
      <h1 className="page-h1">{t('modules')}</h1>
      <p className="admin-field-hint">{t('moduleEditHint')}</p>
      <div className="admin-field-row">
        <div className="admin-field-label">
          <span>{t('project')}</span>
        </div>
        <OSelect
          testid="admin-modules-project"
          value={projectId}
          options={(projects ?? []).map((p) => ({ label: p.name, value: p.id }))}
          onChange={setProjectId}
        />
      </div>
      {error && (
        <p className="admin-cycle-warn" data-testid="admin-modules-error">
          {error}
        </p>
      )}
      <div className="ms-table" ref={tableRef}>
        {(rows ?? []).map((m) => {
          const total = countById.get(m.id) ?? 0
          // 删除确认带影响面（title 是 HTMLElement 原生 property，React 落不进 attribute——ref 回调写）
          const confirmText =
            total > 0
              ? t('moduleDeleteConfirmN').replace('{n}', String(total))
              : t('adminDeleteConfirm')
          return (
            <div className="ms-card" key={m.id} data-testid={`admin-module-row-${m.id}`}>
              <div className="ms-card-head">
                {/* 名称/负责人行内编辑（key 重挂回显，失焦保存）；重名错误就地提示 */}
                <input
                  className="comment-input ms-edit-name"
                  data-testid={`admin-module-name-${m.id}`}
                  key={`${m.id}:${m.name}`}
                  defaultValue={m.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== m.name) {
                      setError('')
                      void modulesRepo.update(m.id, { name }).catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : String(err))
                        e.target.value = m.name
                      })
                    } else e.target.value = m.name
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
                <span className="ms-due-note" data-testid={`admin-module-count-${m.id}`}>
                  {t('moduleIssueCount').replace('{n}', String(total))}
                </span>
                {m.leadId ? (
                  <oas-tag size="small" data-testid={`admin-module-lead-${m.id}`}>
                    {memberName.get(m.leadId) ?? m.leadId}
                  </oas-tag>
                ) : null}
                <oas-popconfirm
                  data-module-id={m.id}
                  ref={(el) => {
                    if (el) (el as HTMLElement).setAttribute('title', confirmText)
                  }}
                >
                  <button
                    type="button"
                    className="states-del"
                    data-testid={`admin-module-del-${m.id}`}
                    title={t('moduleDelete')}
                  >
                    ×
                  </button>
                </oas-popconfirm>
              </div>
              <input
                className="ms-edit-desc"
                data-testid={`admin-module-desc-${m.id}`}
                key={`${m.id}:${m.description ?? ''}`}
                placeholder={t('moduleDescPlaceholder')}
                defaultValue={m.description ?? ''}
                onBlur={(e) => {
                  const desc = e.target.value.trim()
                  if (desc !== (m.description ?? '')) {
                    void modulesRepo.update(
                      m.id,
                      desc ? { description: desc } : { description: '' },
                    )
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            </div>
          )
        })}
        {(rows ?? []).length === 0 && (
          <p className="worklog-empty" data-testid="admin-modules-empty">
            {t('moduleEmpty')}
          </p>
        )}
      </div>
      <div className="states-add-row">
        <input
          ref={nameRef}
          className="comment-input states-name"
          data-testid="admin-module-new-name"
          placeholder={t('moduleNamePlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
        />
        <input
          ref={descRef}
          className="comment-input ms-new-desc"
          data-testid="admin-module-new-desc"
          placeholder={t('moduleDescPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create()
          }}
        />
        <oas-button
          size="small"
          type="primary"
          data-testid="admin-module-add"
          onClick={() => void create()}
        >
          {t('create')}
        </oas-button>
      </div>
    </div>
  )
}
