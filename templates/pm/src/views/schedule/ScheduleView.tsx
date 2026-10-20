import { useEffect, useMemo, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { t, getLang } from '@/i18n'
import {
  bucketToDueAt,
  clampStartAt,
  deriveScheduleEvents,
  scheduleSignature,
  type ScheduleBucket,
  type ScheduleEvent,
} from '@/lib/schedule-data'
import type { Action, Ctx } from '@/permission/policy'
import type { Issue } from '@/types'

/* ── 日程视图（oas-scheduler 三档：全天/上午/下午）── */

interface SchedulerElement extends HTMLElement {
  events?: ScheduleEvent[]
}

/** 落点归档：组件改写的 start 小时 <12 → 上午、≥12 → 下午（12:00–13:59 归下午）；无 start = 全天 */
function bucketFromStart(start: string | undefined): ScheduleBucket {
  if (!start) return 'allday'
  return Number(start.slice(0, 2)) < 12 ? 'am' : 'pm'
}

const normEvent = (e: ScheduleEvent) =>
  `${e.id}|${e.date}|${e.title}|${e.start ?? ''}|${e.end ?? ''}`

/** 注入回声的完整体判等（含 end/title——resize 只改 end，id|date|start 签名识别不了） */
function sameEvents(a: ScheduleEvent[], b: ScheduleEvent[]): boolean {
  return a.length === b.length && a.every((e, i) => normEvent(e) === normEvent(b[i]!))
}

/** 裁剪内部 resource/resource-week 入口：::part() 不支持后代选择器（Chromium 实测规则整体丢弃），
 *  light CSS 够不着按钮——往 shadow root 注入幂等样式表（VirtualIssueList 先例） */
function ensureViewTrim(root: ShadowRoot | null): void {
  if (!root || root.querySelector('style[data-sched-trim]')) return
  const st = document.createElement('style')
  st.setAttribute('data-sched-trim', '')
  st.textContent = `[part="views"] button[data-view="resource"],
  [part="views"] button[data-view="resource-week"] { display: none !important; }`
  root.appendChild(st)
}

export function ScheduleView({
  issues,
  can,
  onOpenIssue,
}: {
  issues: Issue[]
  can: (action: Action, ctx?: Ctx) => boolean
  onOpenIssue: (id: string) => void
}) {
  const { issues: issuesRepo } = useRepositories()
  const calRef = useRef<SchedulerElement>(null)
  const [reinject, setReinject] = useState(0)
  // 上次注入的 events 原样（回声判等）与签名（跳过冗余注入）；deny 回弹时清签名强制重写
  const injectedRef = useRef<ScheduleEvent[]>([])
  const sigGuard = useRef('')

  // 标签按渲染期求值（同 ResourceView）：切语言 → App 重渲染 → memo 重算 → 前缀随文案重建
  const amLabel = t('am')
  const pmLabel = t('pm')
  const overdueLabel = t('overdue')
  const events = useMemo(
    () => deriveScheduleEvents(issues, { am: amLabel, pm: pmLabel, overdue: overdueLabel }),
    [issues, amLabel, pmLabel, overdueLabel],
  )
  const locale = getLang() === 'zh' ? 'zh-CN' : 'en-US'

  const gateRef = useRef({ can, issues, events })
  gateRef.current = { can, issues, events }
  const openRef = useRef(onOpenIssue)
  openRef.current = onOpenIssue

  // 监听先于数据注入挂载（deps 含 events：空态挂载时 ref 为空，数据到达重挂后重新绑定）
  useEffect(() => {
    const el = calRef.current
    if (!el || events.length === 0) return
    const onClick = (e: Event) => {
      const d = (e as CustomEvent<{ id?: string }>).detail
      if (d?.id) openRef.current(d.id)
    }
    // events-change（拖拽改期 = 改 date/档位）写回：与派生映射逐条 diff，date 或落点桶变化者
    // 过 issue:edit 门禁 → dueAt = 桶起点 + startAt 倒挂钳制；deny 或零 diff（resize 只改 end）
    // → 清签名 + 重注入把组件内部模型弹回（无写库 liveQuery 不推新值）
    const onEventsChange = (e: Event) => {
      const d = (e as CustomEvent<{ events?: ScheduleEvent[] }>).detail
      const next = d?.events ?? []
      if (sameEvents(next, injectedRef.current)) return
      const prev = new Map(gateRef.current.events.map((ev) => [ev.id, ev]))
      let denied = false
      let wrote = false
      for (const nt of next) {
        if (!nt.id) continue
        const ot = prev.get(nt.id)
        if (!ot) continue
        if (nt.date === ot.date && bucketFromStart(nt.start) === bucketFromStart(ot.start)) continue
        const it = gateRef.current.issues.find((i) => i.id === nt.id)
        if (!it || !gateRef.current.can('issue:edit', { issue: it })) {
          denied = true
          continue
        }
        const dueAt = bucketToDueAt(nt.date, bucketFromStart(nt.start))
        const patch: Partial<Issue> = { dueAt }
        const clamped = clampStartAt(it.startAt, dueAt)
        if (clamped !== it.startAt) patch.startAt = clamped
        void issuesRepo.update(nt.id, patch)
        wrote = true
      }
      if (denied || !wrote) {
        sigGuard.current = ''
        setReinject((n) => n + 1)
      }
    }
    el.addEventListener('oas-event-click', onClick)
    el.addEventListener('oas-events-change', onEventsChange)
    return () => {
      el.removeEventListener('oas-event-click', onClick)
      el.removeEventListener('oas-events-change', onEventsChange)
    }
  }, [issuesRepo, events])

  const inject = useMemo(() => ({ events, reinject }), [events, reinject])
  useEffect(() => {
    const el = calRef.current
    if (!el) return
    ensureViewTrim(el.shadowRoot)
    // 回声守卫：set events 本身也派发 oas-events-change——写前签名对拍，签名相同跳过注入
    const sig = scheduleSignature(inject.events)
    if (sig === sigGuard.current) return
    sigGuard.current = sig
    injectedRef.current = inject.events
    el.events = inject.events
  }, [inject])

  if (events.length === 0) {
    return (
      <div className="schedule-page" data-testid="schedule-view">
        <div className="schedule-head">
          <span className="schedule-title">{t('schedule')}</span>
        </div>
        <oas-empty data-testid="schedule-empty" description={t('scheduleEmpty')} />
      </div>
    )
  }

  return (
    <div className="schedule-page" data-testid="schedule-view">
      <div className="schedule-head">
        <span className="schedule-title">{t('schedule')}</span>
      </div>
      <oas-scheduler
        ref={calRef}
        data-testid="schedule-gantt"
        view="month"
        locale={locale}
        start-hour="8"
        end-hour="19"
        style={{ width: '100%', flex: 1, minHeight: 420 }}
      />
    </div>
  )
}
