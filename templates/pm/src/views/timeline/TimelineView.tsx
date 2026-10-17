import { useEffect, useMemo, useRef } from 'react'
import { useRepositories } from '@/data/context'
import type { Issue } from '@/types'

/* ── 时间线（oas-gantt） ── */
interface GanttElement extends HTMLElement {
  tasks?: unknown[]
}

export function TimelineView({ issues }: { issues: Issue[] }) {
  const { issues: issuesRepo } = useRepositories()
  const ganttRef = useRef<GanttElement>(null)
  const tasks = useMemo(
    () =>
      issues
        .filter((i) => i.dueAt !== null && i.dueAt > i.createdAt)
        .slice(0, 50)
        .map((i) => ({
          id: i.id,
          name: `${i.key} ${i.title}`,
          start: new Date(i.startAt ?? i.createdAt).toISOString().slice(0, 10),
          end: new Date(i.dueAt as number).toISOString().slice(0, 10),
          type: 'task' as const,
        }))
        // 相邻 fs 依赖演示组件连线能力（前项完成 → 后项开始）
        .map((t, i, arr) => ({
          ...t,
          dependencies: i > 0 ? [{ id: arr[i - 1].id, type: 'fs' as const }] : undefined,
        })),
    [issues],
  )

  useEffect(() => {
    if (ganttRef.current) ganttRef.current.tasks = tasks
  }, [tasks])

  // task-change 写回：甘特条拖拽/拉伸改期 → startAt/dueAt 落库（liveQuery 全视图自动刷新）
  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; start: string; end?: string }>).detail
      if (!d?.id) return
      const patch: Partial<Issue> = {}
      if (d.start) patch.startAt = new Date(d.start).getTime()
      if (d.end) patch.dueAt = new Date(d.end).getTime()
      void issuesRepo.update(d.id, patch)
    }
    el.addEventListener('task-change', onChange)
    return () => el.removeEventListener('task-change', onChange)
  }, [])

  if (tasks.length === 0) {
    return <div className="timeline-empty">暂无带截止日期的 Issue</div>
  }

  return (
    <div className="timeline-page">
      <oas-gantt
        ref={ganttRef}
        data-testid="gantt"
        style={{ width: '100%', flex: 1, minHeight: 420 }}
      />
    </div>
  )
}
