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
  const dragIdRef = useRef<string | null>(null)

  // 排序统一入口：拖排与改数字都归约为「按给定 id 序列重排」（两端同一条 reorder 契约）
  const applyOrder = async (ids: string[]) => {
    setError('')
    try {
      await modulesRepo.reorder(ids)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  /** 把 id 移动到目标下标（0 基；越界钳制） */
  const moveTo = async (id: string, targetIndex: number) => {
    const ids = (rows ?? []).map((r) => r.id)
    const from = ids.indexOf(id)
    if (from < 0) return
    ids.splice(from, 1)
    ids.splice(Math.max(0, Math.min(targetIndex, ids.length)), 0, id)
    await applyOrder(ids)
  }

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
        {(rows ?? []).map((m, index) => {
          const total = countById.get(m.id) ?? 0
          // 删除确认带影响面（title 是 HTMLElement 原生 property，React 落不进 attribute——ref 回调写）
          const confirmText =
            total > 0
              ? t('moduleDeleteConfirmN').replace('{n}', String(total))
              : t('adminDeleteConfirm')
          return (
            <div
              className="ms-card"
              key={m.id}
              data-testid={`admin-module-row-${m.id}`}
              // HTML5 拖排：整卡可拖（卡片本身就是操作主体，无需独立把手），落点按目标卡插入其位
              draggable
              onDragStart={(e) => {
                dragIdRef.current = m.id
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', m.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragIdRef.current
                dragIdRef.current = null
                if (!from || from === m.id) return
                void moveTo(from, index)
              }}
              onDragEnd={() => {
                dragIdRef.current = null
              }}
            >
              <div className="ms-card-head">
                {/* 排序：数字直改（1 基位置，失焦落库）+ 整卡拖拽，共用 moveTo/reorder 通道 */}
                <input
                  type="number"
                  className="ms-order-input"
                  data-testid={`admin-module-order-${m.id}`}
                  key={`${m.id}:${m.order ?? index}`}
                  defaultValue={(m.order ?? index) + 1}
                  min={1}
                  max={(rows ?? []).length}
                  aria-label={t('moduleOrder')}
                  onBlur={(e) => {
                    const pos = Math.round(Number(e.target.value))
                    if (!Number.isFinite(pos)) {
                      e.target.value = String((m.order ?? index) + 1)
                      return
                    }
                    void moveTo(m.id, pos - 1)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
                <span className="ms-drag-hint" aria-hidden>
                  ⠿
                </span>
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
