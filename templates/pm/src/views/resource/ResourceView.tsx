import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { levelResources, type ResourceTask } from '@oas-ui/ui/data/resource'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import { t } from '@/i18n'
import {
  diffResourceAssignments,
  UNASSIGNED_ID,
  toLevelingResources,
  toResourceData,
} from '@/lib/resource-data'
import type { Action, Ctx } from '@/permission/policy'
import type { Issue } from '@/types'

/* ── 资源视图（oas-resource）── */

interface ResourceElement extends HTMLElement {
  resources?: unknown[]
  tasks?: ResourceTask[]
}

type LevelNotice = { kind: 'success' | 'info' | 'error'; text: string; epoch: number }

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
  // 均载求解输入与展示数据解耦：展示过滤空泳道，但求解必须看到全部成员
  // （含空闲成员，否则空闲行不在 resources 里、求解器不会把任务搬过去）+ 未分配行
  const levelInput = useMemo(
    () => toLevelingResources(members ?? [], unassignedLabel),
    [members, unassignedLabel],
  )

  const gateRef = useRef({ can, issues, data, levelInput })
  gateRef.current = { can, issues, data, levelInput }
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

  // 一键均载反馈（成功 N / 部分失败 / 已均衡 / 失败，4s 自动隐藏，同 SettingsTab alert 模式）；
  // epoch 作 oas-alert 的 key：4s 窗口内二次均载强制重挂，否则同 type 复用元素不重放开场
  const [notice, setNotice] = useState<LevelNotice | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)
  const noticeEpoch = useRef(0)
  const levelingRef = useRef(false)
  const showNotice = useCallback((n: Omit<LevelNotice, 'epoch'>) => {
    noticeEpoch.current += 1
    setNotice({ ...n, epoch: noticeEpoch.current })
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  // reassign 求解：把任务从最忙资源搬到较空闲资源（时长不动、尊重 capacity），
  // 求解输入用全量成员（levelInput，含空闲成员）；写回 diff 走 diffResourceAssignments
  // （只比 resources[0]，__unassigned__ → null），逐条过 issue:edit 门禁（deny 计入 skipped 不进批）
  const runLevel = useCallback(async () => {
    if (levelingRef.current) return
    levelingRef.current = true
    try {
      const cur = gateRef.current.data.tasks
      const leveled = levelResources(gateRef.current.levelInput, cur, {
        mode: 'reassign',
        scale: 'day',
        capacity: 1,
      })
      const batch: Array<{ id: string; changes: Partial<Issue> }> = []
      let skipped = 0
      for (const diff of diffResourceAssignments(cur, leveled)) {
        const it = gateRef.current.issues.find((i) => i.id === diff.id)
        if (!it || !gateRef.current.can('issue:edit', { issue: it })) {
          skipped += 1
          continue
        }
        batch.push({ id: diff.id, changes: { assigneeId: diff.assigneeId } })
      }
      // updateMany 单事务写回：共享 updatedAt、liveQuery 只发一次；
      // allSettled 口径报成功/失败（单批时失败即全败，结构留多批部分失败的上报通道）
      let succeeded = 0
      let failed = 0
      let failReason = ''
      if (batch.length > 0) {
        const results = await Promise.allSettled([issuesRepo.updateMany(batch)])
        for (const r of results) {
          if (r.status === 'fulfilled') {
            succeeded += batch.length
          } else {
            failed += batch.length
            failReason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          }
        }
      }
      const skippedSuffix =
        skipped > 0 ? t('resourceLevelSkipped').replace('{k}', String(skipped)) : ''
      if (failed > 0 && succeeded > 0) {
        const text = t('resourceLevelPartial')
          .replace('{n}', String(succeeded))
          .replace('{k}', String(failed))
        showNotice({ kind: 'error', text: text + skippedSuffix })
      } else if (failed > 0) {
        showNotice({ kind: 'error', text: `${t('resourceLevelFailed')} ${failReason}` })
      } else if (succeeded > 0) {
        const text = t('resourceLevelDone').replace('{n}', String(succeeded))
        showNotice({ kind: 'success', text: text + skippedSuffix })
      } else {
        showNotice({ kind: 'info', text: t('resourceLevelNone') + skippedSuffix })
      }
    } catch (e) {
      showNotice({
        kind: 'error',
        text: `${t('resourceLevelFailed')} ${e instanceof Error ? e.message : String(e)}`,
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
  // deps 含 data：空态树卸载 popconfirm（ref 指向脱挂节点）后数据返回会换新节点重挂，
  // canLevel/overloaded 不变时 effect 不重跑 → 监听仍挂在旧节点上；随 data 重绑保证确认可用
  useEffect(() => {
    const el = popRef.current
    if (!el || !canLevel || overloaded === 0 || data.tasks.length === 0) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason === 'ok') void runLevelRef.current()
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [canLevel, overloaded, data])

  if (data.tasks.length === 0) {
    return (
      <div className="resource-page" data-testid="resource-view">
        <div className="resource-head">
          <h1 className="resource-title">{t('resourceTitle')}</h1>
        </div>
        <oas-empty data-testid="resource-empty" description={t('resourceEmpty')} />
      </div>
    )
  }

  return (
    <div className="resource-page" data-testid="resource-view">
      <div className="resource-head">
        <h1 className="resource-title">{t('resourceTitle')}</h1>
        {overloaded > 0 && (
          <oas-badge type="danger" data-testid="resource-overload-count">
            {t('resourceOverload').replace('{n}', String(overloaded))}
          </oas-badge>
        )}
        {canLevel && overloaded > 0 && (
          <oas-popconfirm
            ref={popRef}
            title={t('resourceLevelConfirm')}
            ok-text={t('confirm')}
            cancel-text={t('cancel')}
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
          key={notice.epoch}
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
