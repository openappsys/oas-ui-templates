import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { levelResources, type ResourceTask } from '@oas-ui/ui/data/resource'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import { UNASSIGNED_ID, toResourceData } from '@/lib/resource-data'
import type { Action, Ctx } from '@/permission/policy'
import type { Issue } from '@/types'

/* ── 资源视图（oas-resource）── */

interface ResourceElement extends HTMLElement {
  resources?: unknown[]
  tasks?: ResourceTask[]
}

type LevelNotice = { kind: 'success' | 'info' | 'error'; text: string }

export function ResourceView({
  issues,
  can,
  onOpenIssue,
}: {
  issues: Issue[]
  can: (action: Action, ctx?: Ctx) => boolean
  onOpenIssue: (id: string) => void
}) {
  const { issues: issuesRepo, members: membersRepo } = useRepositories()
  const members = useObservable(() => membersRepo.liveAll(), [membersRepo])
  const resRef = useRef<ResourceElement>(null)
  const [overloaded, setOverloaded] = useState(0)
  const [reinject, setReinject] = useState(0)

  // 标签按渲染期求值：切换语言时 App 重渲染 → 值变 → memo 重算，未分配行名随文案重建
  const unassignedLabel = t('resourceUnassigned')
  const data = useMemo(
    () => toResourceData(members ?? [], issues, unassignedLabel),
    [members, issues, unassignedLabel],
  )

  const gateRef = useRef({ can, issues, data })
  gateRef.current = { can, issues, data }
  const openRef = useRef(onOpenIssue)
  openRef.current = onOpenIssue

  // 监听先于数据注入挂载（deps 含 data：空态挂载时 ref 为空，数据到达重挂后重新绑定）：
  // oas-overload 按签名去重只派发一次，首次 tasks 赋值若在监听之前发生会被永久错过
  useEffect(() => {
    const el = resRef.current
    if (!el || data.tasks.length === 0) return
    const onOverload = (e: Event) => {
      const d = (e as CustomEvent<{ overloads: Array<{ resourceId: string }> }>).detail
      setOverloaded(new Set((d?.overloads ?? []).map((o) => o.resourceId)).size)
    }
    const onTaskClick = (e: Event) => {
      const d = (e as CustomEvent<{ id: string }>).detail
      if (d?.id) openRef.current(d.id)
    }
    // tasks-change（拖拽改期/换行 = 改分配）写回：与当前映射逐条 diff，
    // start/end 变 → startAt/dueAt；resources[0] 变 → assigneeId（__unassigned__ → null）。
    // 逐条过 issue:edit 门禁，未过跳过并触发重注入把组件内部模型弹回（无写库 liveQuery 不会推新值）；
    // 宿主程序性赋值的回声 diff 为空，天然幂等
    const onTasksChange = (e: Event) => {
      const d = (e as CustomEvent<{ tasks?: ResourceTask[] }>).detail
      const next = d?.tasks ?? []
      const prev = new Map(gateRef.current.data.tasks.map((task) => [task.id, task]))
      let denied = false
      for (const nt of next) {
        if (!nt.id) continue
        const ot = prev.get(nt.id)
        if (!ot) continue
        const nextOwner = nt.resources?.[0] ?? UNASSIGNED_ID
        const prevOwner = ot.resources?.[0] ?? UNASSIGNED_ID
        const moved = nt.start !== ot.start || nt.end !== ot.end || nextOwner !== prevOwner
        if (!moved) continue
        const it = gateRef.current.issues.find((i) => i.id === nt.id)
        if (!it || !gateRef.current.can('issue:edit', { issue: it })) {
          denied = true
          continue
        }
        const patch: Partial<Issue> = {}
        if (nt.start !== ot.start) patch.startAt = new Date(nt.start).getTime()
        if (nt.end !== ot.end) patch.dueAt = new Date(nt.end).getTime()
        if (nextOwner !== prevOwner) {
          patch.assigneeId = nextOwner === UNASSIGNED_ID ? null : nextOwner
        }
        void issuesRepo.update(nt.id, patch)
      }
      if (denied) setReinject((n) => n + 1)
    }
    el.addEventListener('oas-overload', onOverload)
    el.addEventListener('oas-task-click', onTaskClick)
    el.addEventListener('oas-tasks-change', onTasksChange)
    return () => {
      el.removeEventListener('oas-overload', onOverload)
      el.removeEventListener('oas-task-click', onTaskClick)
      el.removeEventListener('oas-tasks-change', onTasksChange)
    }
  }, [issuesRepo, data])

  const inject = useMemo(() => ({ data, reinject }), [data, reinject])

  useEffect(() => {
    const el = resRef.current
    if (!el) return
    el.resources = inject.data.resources
    el.tasks = inject.data.tasks
  }, [inject])

  // 一键均载反馈（成功 N / 已均衡 / 失败，4s 自动隐藏，同 ProjectsTab alert 模式）
  const [notice, setNotice] = useState<LevelNotice | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)
  const levelingRef = useRef(false)
  const showNotice = useCallback((n: LevelNotice) => {
    setNotice(n)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  // 求解器输出只采纳「改派」（resources[0] 变 → assigneeId，__unassigned__ → null）；
  // 其时间顺延（start/end 平滑）不落库——dueAt 是业务 deadline，不被求解器改写
  const runLevel = useCallback(async () => {
    if (levelingRef.current) return
    levelingRef.current = true
    try {
      const cur = gateRef.current.data.tasks
      const leveled = levelResources(gateRef.current.data.resources, cur, { scale: 'day' })
      const prev = new Map(cur.map((task) => [task.id, task]))
      const updates: Array<Promise<unknown>> = []
      for (const nt of leveled) {
        if (!nt.id) continue
        const ot = prev.get(nt.id)
        if (!ot) continue
        const nextOwner = nt.resources?.[0] ?? UNASSIGNED_ID
        const prevOwner = ot.resources?.[0] ?? UNASSIGNED_ID
        if (nextOwner === prevOwner) continue
        updates.push(
          issuesRepo.update(nt.id, { assigneeId: nextOwner === UNASSIGNED_ID ? null : nextOwner }),
        )
      }
      await Promise.all(updates)
      showNotice(
        updates.length > 0
          ? { kind: 'success', text: t('resourceLevelDone').replace('{n}', String(updates.length)) }
          : { kind: 'info', text: t('resourceLevelNone') },
      )
    } catch (e) {
      showNotice({
        kind: 'error',
        text: `${t('resourceLevelFailed')}${e instanceof Error ? e.message : String(e)}`,
      })
    } finally {
      levelingRef.current = false
    }
  }, [issuesRepo, showNotice])
  const runLevelRef = useRef(runLevel)
  runLevelRef.current = runLevel

  // 均载入口：admin（bulk:apply，批量改派跨成员）且存在超载时渲染
  const canLevel = can('bulk:apply')
  const popRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = popRef.current
    if (!el || !canLevel || overloaded === 0) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason === 'ok') void runLevelRef.current()
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [canLevel, overloaded])

  if (data.tasks.length === 0) {
    return (
      <div className="resource-page" data-testid="resource-view">
        <div className="resource-head">
          <span className="resource-title">{t('resourceTitle')}</span>
        </div>
        <oas-empty data-testid="resource-empty" description={t('resourceEmpty')} />
      </div>
    )
  }

  return (
    <div className="resource-page" data-testid="resource-view">
      <div className="resource-head">
        <span className="resource-title">{t('resourceTitle')}</span>
        {overloaded > 0 && (
          <oas-badge type="danger" data-testid="resource-overload-count">
            {t('resourceOverload').replace('{n}', String(overloaded))}
          </oas-badge>
        )}
        {canLevel && overloaded > 0 && (
          <oas-popconfirm
            ref={popRef}
            title={t('resourceLevelConfirm')}
            data-testid="resource-level-confirm"
          >
            <oas-button type="primary" size="small" data-testid="resource-level-btn">
              {t('resourceLevelBtn')}
            </oas-button>
          </oas-popconfirm>
        )}
      </div>
      {notice && (
        <oas-alert
          type={notice.kind}
          className="resource-level-alert"
          data-testid="resource-level-alert"
        >
          {notice.text}
        </oas-alert>
      )}
      <oas-resource
        ref={resRef}
        data-testid="resource-view-gantt"
        show-load-values=""
        style={{ width: '100%', flex: 1, minHeight: 420 }}
      />
    </div>
  )
}
