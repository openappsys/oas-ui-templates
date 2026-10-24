import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Observable } from '@/data/observable'
import { t, type Lang } from '@/i18n'
import type { Cycle } from '@/types'
import { ALL_PROJECTS } from '@/lib/filters'
import {
  DAY_MS,
  cyclePhase,
  dayInputToTs,
  nextCycleOf,
  overlapsAnyCycle,
  rolloverUpdates,
  tsToDayInput,
} from '@/lib/cycles'
import { ODatePicker, OSelect, OSegmented } from '@/components/oas-wrappers'

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

const PHASE_KEY = {
  ended: 'cyclePhaseEnded',
  current: 'cyclePhaseCurrent',
  upcoming: 'cyclePhaseUpcoming',
} as const

/** 一次性读取 Observable 的首个快照（结转在确认时刻取数，避免弹窗开着时读到旧数据） */
function firstOf<T>(obs: Observable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let unsub: () => void = () => {}
    unsub = obs.subscribe({
      next: (v) => {
        unsub()
        resolve(v)
      },
      error: (e) => {
        unsub()
        reject(e)
      },
    })
  })
}

export function CyclesTab({ lang }: { lang: Lang }) {
  const { cycles: cyclesRepo, issues: issuesRepo, projects: projectsRepo } = useRepositories()
  const tableRef = useRef<TableHost>(null)
  const modalRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLElement & { value?: string }>(null)
  const goalRef = useRef<HTMLElement & { value?: string }>(null)
  const [editing, setEditing] = useState<Cycle | null>(null)
  const [projectId, setProjectId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [closing, setClosing] = useState<Cycle | null>(null)
  const [closeMode, setCloseMode] = useState<'next' | 'out'>('next')
  const timer = useRef<number | undefined>(undefined)
  const inFlightRef = useRef(false)

  const list = useObservable(() => cyclesRepo.liveAll(ALL_PROJECTS), [cyclesRepo])
  // 管理端跨项目：一张表列出全部迭代，计数按全项目聚合
  const counts = useObservable(() => issuesRepo.liveCycleCounts(ALL_PROJECTS), [issuesRepo])
  const projects = useObservable(() => projectsRepo.liveAll(), [projectsRepo])

  const showError = useCallback((msg: string) => {
    setError(msg)
    setNotice('')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setError(''), 5000)
  }, [])
  const showNotice = useCallback((msg: string) => {
    setNotice(msg)
    setError('')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setNotice(''), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const listRef = useRef(list)
  listRef.current = list
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects])
  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
    [projects],
  )
  const countMap = useMemo(() => new Map((counts ?? []).map((c) => [c.cycleId, c])), [counts])

  const openModal = useCallback(
    (cycle: Cycle | null) => {
      setEditing(cycle)
      setFieldError('')
      setProjectId(cycle?.projectId ?? projectOptions[0]?.value ?? '')
      setStart(cycle ? tsToDayInput(cycle.startAt) : '')
      setEnd(cycle ? tsToDayInput(cycle.endAt) : '')
      if (nameRef.current) nameRef.current.value = cycle?.name ?? ''
      if (goalRef.current) goalRef.current.value = cycle?.goal ?? ''
      modalRef.current?.setAttribute('visible', '')
    },
    [projectOptions],
  )
  const openModalRef = useRef(openModal)
  openModalRef.current = openModal

  const startTs = dayInputToTs(start)
  const endTs = dayInputToTs(end)
  /** 同项目重叠只警告不拦截：历史数据本来就可能重叠，硬拦会让这些周期无法编辑 */
  const overlapWarn =
    startTs !== null &&
    endTs !== null &&
    endTs > startTs &&
    overlapsAnyCycle(list ?? [], projectId, startTs, endTs + DAY_MS - 1, editing?.id)

  const save = useCallback(async () => {
    if (inFlightRef.current) return
    const name = (nameRef.current?.value ?? '').trim()
    const goal = (goalRef.current?.value ?? '').trim()
    if (!name) {
      setFieldError(t('adminNameRequired'))
      return
    }
    if (!projectId) {
      setFieldError(t('adminCycleProjectRequired'))
      return
    }
    const startAt = dayInputToTs(start)
    const endDay = dayInputToTs(end)
    if (startAt === null || endDay === null) {
      setFieldError(t('adminCycleRangeRequired'))
      return
    }
    if (endDay <= startAt) {
      setFieldError(t('adminCycleEndAfterStart'))
      return
    }
    setFieldError('')
    inFlightRef.current = true
    try {
      // 结束日含当日：endAt 取当日 23:59:59.999，否则「今天结束」的周期当天就会判为已结束
      const endAt = endDay + DAY_MS - 1
      if (editing) {
        await cyclesRepo.update(editing.id, { name, goal, startAt, endAt })
      } else {
        await cyclesRepo.create({ projectId, name, startAt, endAt, ...(goal ? { goal } : {}) })
      }
      modalRef.current?.removeAttribute('visible')
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    } finally {
      inFlightRef.current = false
    }
  }, [editing, end, projectId, start, cyclesRepo, showError])

  const remove = useCallback(
    async (id: string) => {
      try {
        await cyclesRepo.delete(id)
      } catch (e) {
        showError(e instanceof Error ? e.message : String(e))
      }
    },
    [cyclesRepo, showError],
  )
  const removeRef = useRef(remove)
  removeRef.current = remove

  const nextOfClosing = closing ? nextCycleOf(list ?? [], closing) : undefined

  const openClose = useCallback((cycle: Cycle) => {
    setClosing(cycle)
    // 有下一周期时默认「移到下一周期」（工作项连续排期），否则只能移出
    setCloseMode(nextCycleOf(listRef.current ?? [], cycle) ? 'next' : 'out')
    closeRef.current?.setAttribute('visible', '')
  }, [])
  const openCloseRef = useRef(openClose)
  openCloseRef.current = openClose

  /**
   * 结转：未完成项（非 done/cancelled）一次 updateMany 搬到目标周期或移出迭代，
   * 再把该周期 endAt 收到当前时刻（仍在进行中才收）。不写活动历史——
   * 既有 updateMany 就是「无活动」的批量通道（bulkApply 才记活动），这里沿用同一口径。
   */
  const runClose = useCallback(async () => {
    if (inFlightRef.current || !closing) return
    inFlightRef.current = true
    try {
      const all = await firstOf(issuesRepo.liveCycleIssues(closing.projectId, closing.id))
      const target =
        closeMode === 'next' ? (nextCycleOf(listRef.current ?? [], closing)?.id ?? null) : null
      const updates = rolloverUpdates(all, closing.id, target)
      if (updates.length > 0) await issuesRepo.updateMany(updates)
      const now = Date.now()
      if (closing.endAt > now) await cyclesRepo.update(closing.id, { endAt: now })
      closeRef.current?.removeAttribute('visible')
      showNotice(t('adminCycleClosed'))
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    } finally {
      inFlightRef.current = false
    }
  }, [closing, closeMode, cyclesRepo, issuesRepo, showError, showNotice])
  const runCloseRef = useRef(runClose)
  runCloseRef.current = runClose

  // biome-ignore lint/correctness/useExhaustiveDependencies: t() 读模块级语言态，lang 是语言切换时的重算触发器
  const rows = useMemo(() => {
    const now = Date.now()
    return (list ?? []).map((c) => {
      const count = countMap.get(c.id)
      const phase = cyclePhase(c, now)
      return {
        id: c.id,
        name: c.name,
        project: projectMap.get(c.projectId)?.name ?? '—',
        range: `${tsToDayInput(c.startAt)} ~ ${tsToDayInput(c.endAt)}`,
        status: t(PHASE_KEY[phase]),
        total: (count?.total ?? 0).toLocaleString(),
        done: (count?.done ?? 0).toLocaleString(),
        goal: c.goal ?? '',
        phase,
      }
    })
  }, [list, countMap, projectMap, lang])

  // biome-ignore lint/correctness/useExhaustiveDependencies: 列渲染读模块级语言态，lang 是语言切换时的重算触发器
  const columns = useMemo<Col[]>(() => {
    return [
      { key: 'name', title: t('adminColName') },
      { key: 'project', title: t('adminColProject') },
      { key: 'range', title: t('adminColRange') },
      { key: 'status', title: t('adminColStatus') },
      { key: 'total', title: t('adminColTotal'), align: 'right' },
      { key: 'done', title: t('adminColDone'), align: 'right' },
      {
        key: 'goal',
        title: t('adminColGoal'),
        render: (row) => {
          const goal = String(row.goal ?? '')
          if (!goal) return '—'
          const span = document.createElement('span')
          span.className = 'admin-cycle-goal'
          span.textContent = goal
          span.title = goal
          return span
        },
      },
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
          edit.setAttribute('data-testid', `admin-cycle-edit-${id}`)
          edit.textContent = t('adminEdit')
          edit.addEventListener('click', () => {
            const c = (listRef.current ?? []).find((x) => x.id === id)
            if (c) openModalRef.current(c)
          })
          box.appendChild(edit)

          // 只有进行中的周期可结转：已结束的周期没有「未完成项去向」问题
          if (row.phase === 'current') {
            const close = document.createElement('oas-button')
            close.setAttribute('size', 'small')
            close.setAttribute('data-testid', `admin-cycle-close-${id}`)
            close.textContent = t('adminCycleClose')
            close.addEventListener('click', () => {
              const c = (listRef.current ?? []).find((x) => x.id === id)
              if (c) openCloseRef.current(c)
            })
            box.appendChild(close)
          }

          const pop = document.createElement('oas-popconfirm')
          pop.setAttribute('title', t('adminCycleDeleteConfirm'))
          pop.setAttribute('ok-text', t('confirm'))
          pop.setAttribute('cancel-text', t('cancel'))
          const del = document.createElement('oas-button')
          del.setAttribute('type', 'danger')
          del.setAttribute('size', 'small')
          del.setAttribute('data-testid', `admin-cycle-del-${id}`)
          del.textContent = t('delete')
          pop.appendChild(del)
          pop.addEventListener('oas-open-change', (e: Event) => {
            const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
            if (reason === 'ok') void removeRef.current(id)
          })
          box.appendChild(pop)
          return box
        },
      },
    ]
  }, [lang])

  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    el.columns = columns
    el.data = rows
  }, [columns, rows])

  return (
    <div className="admin-crud-page" data-testid="admin-tab-cycles">
      <div className="admin-crud-top">
        <h1 className="page-h1">{t('adminCyclesTitle')}</h1>
        <oas-button
          type="primary"
          data-testid="admin-cycle-new"
          onClick={() => openModalRef.current(null)}
        >
          {t('adminNewCycle')}
        </oas-button>
      </div>
      {error && (
        <oas-alert type="error" className="admin-crud-error" data-testid="admin-cycle-error">
          {error}
        </oas-alert>
      )}
      {notice && (
        <oas-alert type="success" className="admin-crud-error" data-testid="admin-cycle-notice">
          {notice}
        </oas-alert>
      )}
      <div className="admin-panel">
        <oas-table
          ref={tableRef}
          className="admin-crud-table"
          row-key="id"
          data-testid="admin-table-cycles"
        />
      </div>

      <oas-modal ref={modalRef} no-footer data-testid="admin-cycle-modal">
        <div className="create-body">
          <div className="create-field">
            <label htmlFor="admin-cycle-name">{t('adminColName')}</label>
            <oas-input ref={nameRef} data-testid="admin-cycle-name" />
          </div>
          <div className="create-field">
            <label htmlFor="admin-cycle-project">{t('adminColProject')}</label>
            <OSelect
              testid="admin-cycle-project"
              value={projectId}
              options={projectOptions}
              onChange={setProjectId}
              disabled={!!editing}
            />
          </div>
          <div className="create-dates">
            <div className="create-field">
              <label htmlFor="admin-cycle-start">{t('adminCycleStart')}</label>
              <ODatePicker testid="admin-cycle-start" value={start} onChange={setStart} />
            </div>
            <div className="create-field">
              <label htmlFor="admin-cycle-end">{t('adminCycleEnd')}</label>
              <ODatePicker testid="admin-cycle-end" value={end} onChange={setEnd} />
            </div>
          </div>
          <div className="create-field">
            <label htmlFor="admin-cycle-goal">{t('adminCycleGoal')}</label>
            <oas-input ref={goalRef} data-testid="admin-cycle-goal" />
          </div>
          {overlapWarn && (
            <p className="admin-cycle-warn" data-testid="admin-cycle-overlap-warn">
              {t('adminCycleOverlapWarn')}
            </p>
          )}
          {fieldError && (
            <p className="create-error" data-testid="admin-cycle-field-error">
              {fieldError}
            </p>
          )}
          <div className="quit-actions">
            <oas-button
              data-testid="admin-cycle-cancel"
              onClick={() => modalRef.current?.removeAttribute('visible')}
            >
              {t('cancel')}
            </oas-button>
            <oas-button type="primary" data-testid="admin-cycle-save" onClick={() => void save()}>
              {editing ? t('save') : t('create')}
            </oas-button>
          </div>
        </div>
      </oas-modal>

      <oas-modal
        ref={closeRef}
        title={t('adminCycleCloseTitle')}
        no-footer
        data-testid="admin-cycle-close-modal"
      >
        <div className="create-body">
          <p className="admin-cycle-close-name" data-testid="admin-cycle-close-name">
            {closing?.name ?? ''}
          </p>
          {nextOfClosing ? (
            <>
              <p className="admin-cycle-close-hint">
                {t('adminCycleCloseTarget').replace('{name}', nextOfClosing.name)}
              </p>
              <OSegmented
                testid="admin-cycle-close-mode"
                value={closeMode}
                options={[
                  { label: t('adminCycleCloseMoveNext'), value: 'next' },
                  { label: t('adminCycleCloseMoveOut'), value: 'out' },
                ]}
                onChange={(v) => setCloseMode(v === 'next' ? 'next' : 'out')}
              />
            </>
          ) : (
            <p className="admin-cycle-close-hint" data-testid="admin-cycle-no-next">
              {t('adminCycleNoNext')}
            </p>
          )}
          <div className="quit-actions">
            <oas-button
              data-testid="admin-cycle-close-cancel"
              onClick={() => closeRef.current?.removeAttribute('visible')}
            >
              {t('cancel')}
            </oas-button>
            <oas-button
              type="primary"
              data-testid="admin-cycle-close-confirm"
              onClick={() => void runCloseRef.current()}
            >
              {t('adminCycleCloseConfirm')}
            </oas-button>
          </div>
        </div>
      </oas-modal>
    </div>
  )
}
