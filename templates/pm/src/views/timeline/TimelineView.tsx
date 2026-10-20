import { useEffect, useMemo, useRef } from 'react'
import { useRepositories } from '@/data/context'
import { useObservable } from '@/data/use-observable'
import type { Issue } from '@/types'
import { PRIORITY_TEXT } from '@/lib/colors'
import { t } from '@/i18n'
import type { Action, Ctx } from '@/permission/policy'

/* ── 时间线（oas-gantt） ── */
interface GanttElement extends HTMLElement {
  tasks?: unknown[]
}

/** 状态 → 进度（done 100 / 进行中 50 / 其余 0） */
const PROGRESS: Record<Issue['status'], number> = {
  backlog: 0,
  todo: 0,
  in_progress: 50,
  done: 100,
  cancelled: 0,
}

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function TimelineView({
  issues,
  can,
}: {
  issues: Issue[]
  can: (action: Action, ctx?: Ctx) => boolean
}) {
  const { issues: issuesRepo, projects: projectsRepo } = useRepositories()
  const projects = useObservable(() => projectsRepo.liveAll(), [projectsRepo])
  const ganttRef = useRef<GanttElement>(null)

  // can 进依赖：身份/成员变化时 disabled（无编辑权限禁拖）要随任务数据重建
  const tasks = useMemo(() => {
    const dueTasks = issues
      .filter((i) => i.dueAt !== null && i.dueAt > i.createdAt)
      .slice(0, 50)
      .map((i) => ({
        id: i.id,
        name: `${i.key} ${i.title}`,
        start: toDate(i.startAt ?? i.createdAt),
        end: toDate(i.dueAt as number),
        type: 'task' as const,
        parent: projects === undefined ? undefined : `proj-${i.projectId}`,
        progress: PROGRESS[i.status],
        color: PRIORITY_TEXT[i.priority],
        // 截止日即 fnlt 约束：排期超出自动 .conflict 高亮（PM deadline 语义）
        constraint: 'fnlt' as const,
        constraintDate: toDate(i.dueAt as number),
        disabled: !can('issue:edit', { issue: i }),
      }))
      // 相邻 fs 依赖演示组件连线能力（前项完成 → 后项开始）
      .map((t, idx, arr) => ({
        ...t,
        dependencies: idx > 0 ? [{ id: arr[idx - 1].id, type: 'fs' as const }] : undefined,
      }))
    // urgent 且无截止日期 → 创建里程碑（单点；不占 50 条名额、不进 fs 链）
    const milestones = issues
      .filter((i) => i.priority === 'urgent' && i.dueAt === null)
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        name: `${i.key} ${i.title}`,
        start: toDate(i.createdAt),
        type: 'milestone' as const,
        parent: projects === undefined ? undefined : `proj-${i.projectId}`,
        disabled: !can('issue:edit', { issue: i }),
      }))
    const children = [...milestones, ...dueTasks]
    // 项目分组 summary：日期聚合自子任务（start 最早 / end 最晚，里程碑按起点计）
    const summaries = (projects ?? [])
      .map((p) => {
        const mine = children.filter((t) => t.parent === `proj-${p.id}`)
        if (mine.length === 0) return null
        const starts = mine.map((t) => t.start)
        const ends = mine.map((t) => (t.type === 'task' ? t.end : t.start))
        return {
          id: `proj-${p.id}`,
          name: p.name,
          type: 'summary' as const,
          start: starts.reduce((min, s) => (s < min ? s : min)),
          end: ends.reduce((max, e) => (e > max ? e : max)),
          expanded: true,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
    // summary 附在数组末尾：组件按 parent 指针组树（组内嵌套与数组位置无关），
    // tasks property 读回保持 issue 在前——甘特写回用 tasks[0] 定位 issue
    return [...children, ...summaries]
  }, [issues, can, projects])

  useEffect(() => {
    if (ganttRef.current) ganttRef.current.tasks = tasks
  }, [tasks])

  const gateRef = useRef({ can, issues })
  gateRef.current = { can, issues }

  // task-change 写回：甘特条拖拽/拉伸改期 → startAt/dueAt 落库（liveQuery 全视图自动刷新）
  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; start: string; end?: string }>).detail
      if (!d?.id) return
      const it = gateRef.current.issues.find((i) => i.id === d.id)
      if (!it || !gateRef.current.can('issue:edit', { issue: it })) return
      const patch: Partial<Issue> = {}
      if (d.start) patch.startAt = new Date(d.start).getTime()
      if (d.end) patch.dueAt = new Date(d.end).getTime()
      void issuesRepo.update(d.id, patch)
    }
    el.addEventListener('task-change', onChange)
    return () => el.removeEventListener('task-change', onChange)
  }, [issuesRepo.update])

  // 空态：既无带截止日期的任务、也无 urgent 里程碑
  if (tasks.length === 0) {
    return <div className="timeline-empty">{t('timelineEmpty')}</div>
  }

  return (
    <div className="timeline-page">
      <oas-gantt
        ref={ganttRef}
        data-testid="gantt"
        stripe=""
        style={{ width: '100%', flex: 1, minHeight: 420 }}
      />
    </div>
  )
}
