import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRepositories } from '@/data/context'
import { t, getLang } from '@/i18n'
import {
  clampStartAt,
  deriveScheduleEvents,
  dueAtWithTime,
  scheduleSignature,
  type ScheduleEvent,
} from '@/lib/schedule-data'
import type { Action, Ctx } from '@/permission/policy'
import type { Issue } from '@/types'

/* ── 日程视图（oas-scheduler：全天/上午/下午三档 + 精确时刻 HH:mm）── */

interface SchedulerElement extends HTMLElement {
  events?: ScheduleEvent[]
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
  // 月视图点日期/+N 条（oas-day-click）→ 切 day 视图并锚到该日（page-show-date 受控）；
  // 组件内置视图切换器（oas-view-change，含用户自写的 attribute 同步）全量镜像，
  // 防 React 重渲染（事件注入/拒绝回弹）用陈旧 state 覆写 attribute 把组件弹回旧视图
  const [view, setView] = useState('month')
  const [dayDate, setDayDate] = useState('')
  // 上次注入的 events 原样（回声判等）与签名（跳过冗余注入）；deny 回弹时清签名强制重写
  const injectedRef = useRef<ScheduleEvent[]>([])
  const sigGuard = useRef('')

  // 标签按渲染期求值（同 ResourceView）：切语言 → App 重渲染 → memo 重算 → 前缀随文案重建
  const amLabel = t('am')
  const pmLabel = t('pm')
  const overdueLabel = t('overdue')
  const moreTmpl = t('scheduleMore')
  const events = useMemo(
    () =>
      deriveScheduleEvents(issues, {
        am: amLabel,
        pm: pmLabel,
        overdue: overdueLabel,
        more: (n) => moreTmpl.replace('{n}', String(n)),
      }),
    [issues, amLabel, pmLabel, overdueLabel, moreTmpl],
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
      // 合成 +N 封顶块是纯展示聚合、无对应 issue——点击不开抽屉
      if (d?.id && !d.id.startsWith('__more__')) openRef.current(d.id)
    }
    // events-change（拖拽改期 = 改 date/落点时刻）写回：与派生映射逐条 diff（date 或 start 变化者；
    // resize 只改 end 天然零 diff）→ 过 issue:edit 门禁 → dueAt = 日 + 落点时刻（组件已 15min
    // 吸附，直写不归桶——归桶会丢精度；start 手拆禁 new Date 隐式解析；全天行 start 缺失写
    // 00:00 现行为）+ startAt 倒挂钳制；deny 或零 diff → 清签名 + 重注入把组件内部模型弹回
    // （无写库 liveQuery 不推新值）
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
        if (nt.date === ot.date && (nt.start ?? '') === (ot.start ?? '')) continue
        const it = gateRef.current.issues.find((i) => i.id === nt.id)
        if (!it || !gateRef.current.can('issue:edit', { issue: it })) {
          denied = true
          continue
        }
        const [hh, mm] = (nt.start ?? '00:00').split(':').map(Number)
        const dueAt = dueAtWithTime(nt.date, hh ?? 0, mm ?? 0)
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
    // 月视图点日期数字/空白格/+N 条 → oas-day-click：切 day 视图锚到该日；
    // 内置视图切换器点「月」回月视图（受控宿主同步属性并清锚点，页锚停留在用户浏览到的日期）
    const onDayClick = (e: Event) => {
      const d = (e as CustomEvent<{ date?: string }>).detail
      if (!d?.date) return
      setDayDate(d.date)
      setView('day')
    }
    const onViewChange = (e: Event) => {
      const v = (e as CustomEvent<{ view?: string }>).detail?.view
      if (!v) return
      setView(v)
      if (v !== 'day') setDayDate('')
    }
    el.addEventListener('oas-day-click', onDayClick)
    el.addEventListener('oas-view-change', onViewChange)
    return () => {
      el.removeEventListener('oas-event-click', onClick)
      el.removeEventListener('oas-events-change', onEventsChange)
      el.removeEventListener('oas-day-click', onDayClick)
      el.removeEventListener('oas-view-change', onViewChange)
    }
  }, [issuesRepo, events])

  const inject = useMemo(() => ({ events, reinject }), [events, reinject])
  // useLayoutEffect：shadow 样式裁剪 + 事件注入须先于绘制，消首帧未裁剪/空数据闪现
  useLayoutEffect(() => {
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
          <h1 className="schedule-title">{t('schedule')}</h1>
        </div>
        <oas-empty data-testid="schedule-empty" description={t('scheduleEmpty')} />
      </div>
    )
  }

  return (
    <div className="schedule-page" data-testid="schedule-view">
      <div className="schedule-head">
        <h1 className="schedule-title">{t('schedule')}</h1>
      </div>
      <oas-scheduler
        ref={calRef}
        data-testid="schedule-gantt"
        view={view}
        page-show-date={dayDate || undefined}
        locale={locale}
        start-hour="8"
        end-hour="19"
        style={{ width: '100%', flex: 1, minHeight: 420 }}
      />
    </div>
  )
}
