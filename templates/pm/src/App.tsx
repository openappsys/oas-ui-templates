import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { db } from './db/schema'
import type { Issue, IssueStatus } from './types'
import { STATUS_LABEL } from './types'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}
const LIST_WINDOW = 500
const BOARD_COL_WINDOW = 50

type View = 'issues' | 'board' | 'timeline'

/** 列表/看板共享的数据窗口：索引直取最近 LIST_WINDOW 条，无全量内存排序 */
function useIssueWindow(statusFilter: IssueStatus | null) {
  return useLiveQuery(
    () =>
      statusFilter
        ? db.issues
            .where('[projectId+status+updatedAt]')
            .between(
              ['project-1', statusFilter, Dexie.minKey],
              ['project-1', statusFilter, Dexie.maxKey],
            )
            .reverse()
            .limit(LIST_WINDOW)
            .toArray()
        : db.issues
            .where('[projectId+updatedAt]')
            .between(['project-1', Dexie.minKey], ['project-1', Dexie.maxKey])
            .reverse()
            .limit(LIST_WINDOW)
            .toArray(),
    [statusFilter],
  )
}

/** 真实全量计数（index count，与窗口大小无关） */
function useIssueCount(statusFilter: IssueStatus | null) {
  return useLiveQuery(
    () =>
      statusFilter
        ? db.issues.where('[projectId+status]').equals(['project-1', statusFilter]).count()
        : db.issues.where('projectId').equals('project-1').count(),
    [statusFilter],
  )
}

export function App() {
  const [view, setView] = useState<View>('issues')
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null)
  const issues = useIssueWindow(statusFilter)
  const total = useIssueCount(statusFilter)

  return (
    <div className="app-frame">
      <header className="titlebar" data-testid="titlebar">
        <span className="tb-name">OAS PM</span>
        <span className="tb-spacer" />
      </header>
      <nav className="menubar">
        {['文件', '编辑', '视图', '帮助'].map((m) => (
          <button key={m} className="menu-item" type="button">
            {m}
          </button>
        ))}
      </nav>
      <div className="main">
        <aside className="activity-bar">
          <button
            className={`act-btn${view === 'issues' ? ' is-active' : ''}`}
            type="button"
            title="Issues"
            data-testid="nav-issues"
            onClick={() => setView('issues')}
          >
            <oas-icon name="tree" size="20" />
          </button>
          <button
            className={`act-btn${view === 'board' ? ' is-active' : ''}`}
            type="button"
            title="看板"
            data-testid="nav-board"
            onClick={() => setView('board')}
          >
            <oas-icon name="organization" size="20" />
          </button>
          <button
            className={`act-btn${view === 'timeline' ? ' is-active' : ''}`}
            type="button"
            title="时间线"
            data-testid="nav-timeline"
            onClick={() => setView('timeline')}
          >
            <oas-icon name="clock" size="20" />
          </button>
        </aside>
        <aside className="side-panel" data-testid="side-panel">
          <p className="side-title">状态</p>
          <button
            className={`side-item${statusFilter === null ? ' is-active' : ''}`}
            type="button"
            data-testid="filter-all"
            onClick={() => setStatusFilter(null)}
          >
            <span>全部</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`side-item${statusFilter === s ? ' is-active' : ''}`}
              type="button"
              data-testid={`filter-${s}`}
              onClick={() => setStatusFilter(s)}
            >
              <span style={{ color: STATUS_COLOR[s] }}>●</span>
              <span>{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </aside>
        <main className="content">
          {view === 'issues' && issues && (
            <IssueList issues={issues} total={total ?? issues.length} />
          )}
          {view === 'board' && <KanbanBoard issues={issues ?? []} />}
          {view === 'timeline' && <TimelineView issues={issues ?? []} />}
        </main>
      </div>
      <footer className="statusbar">
        <span>● 就绪</span>
        <span className="sb-spacer" />
        <span>OAS PM v0.1.0</span>
      </footer>
    </div>
  )
}

/* ── Issue 列表 ── */
function IssueList({ issues, total }: { issues: Issue[]; total: number }) {
  const [selected, setSelected] = useState<Issue | null>(null)

  return (
    <div className="issue-page">
      <div className="issue-header">
        <h1>Issues</h1>
        <span className="issue-total" data-testid="issue-total">
          {total.toLocaleString()} 条{total > issues.length ? `（显示最近 ${issues.length}）` : ''}
        </span>
      </div>
      <div className="issue-thead">
        <span>Key</span>
        <span>标题</span>
        <span>优先级</span>
        <span>状态</span>
      </div>
      <VirtualIssueList issues={issues} onSelect={setSelected} />
      {selected && <IssueDetailPanel issue={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function VirtualIssueList({ issues, onSelect }: { issues: Issue[]; onSelect: (i: Issue) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(720)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewH(el.clientHeight || 720)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const ROW_H = 44
  const OVERSCAN = 8
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const visible = Math.ceil(viewH / ROW_H) + OVERSCAN * 2
  const end = Math.min(issues.length, start + visible)

  const rows: React.ReactNode[] = []
  for (let i = start; i < end; i++) {
    const issue = issues[i]
    rows.push(
      <div
        key={issue.id}
        className="issue-row"
        role="button"
        tabIndex={0}
        style={{
          position: 'absolute',
          top: i * ROW_H,
          left: 0,
          right: 0,
          height: ROW_H,
          cursor: 'pointer',
        }}
        onClick={() => onSelect(issue)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect(issue)
        }}
      >
        <span className="issue-key">{issue.key}</span>
        <span className="issue-title">{issue.title}</span>
        <span className={`issue-priority pri-${issue.priority}`}>{issue.priority}</span>
        <span className={`issue-status st-${issue.status}`}>{issue.status}</span>
      </div>,
    )
  }

  return (
    <div
      ref={scrollRef}
      className="issue-scroll"
      style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      onScroll={onScroll}
    >
      <div style={{ height: issues.length * ROW_H, position: 'relative' }}>{rows}</div>
    </div>
  )
}

function IssueDetailPanel({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  return (
    <div
      className="detail-overlay"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        className="detail-panel"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="detail-head">
          <span className="issue-key">{issue.key}</span>
          <button className="detail-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <h2 className="detail-title">{issue.title}</h2>
        <div className="detail-meta">
          <div>
            <span>状态</span>
            <span className={`st-${issue.status}`}>{STATUS_LABEL[issue.status]}</span>
          </div>
          <div>
            <span>优先级</span>
            <span className={`pri-${issue.priority}`}>{issue.priority}</span>
          </div>
          <div>
            <span>负责人</span>
            <span>{issue.assigneeId ?? '未分配'}</span>
          </div>
          <div>
            <span>标签</span>
            <span>{issue.labels.join(', ') || '—'}</span>
          </div>
        </div>
        {issue.description && <p className="detail-desc">{issue.description}</p>}
      </div>
    </div>
  )
}

/* ── 看板 ── */
function KanbanBoard({ issues }: { issues: Issue[] }) {
  const [dragOver, setDragOver] = useState<IssueStatus | null>(null)

  const byStatus = useMemo(() => {
    const map: Partial<Record<IssueStatus, Issue[]>> = {}
    for (const s of STATUSES) map[s] = []
    for (const i of issues) {
      const k = i.status as IssueStatus
      if (map[k]) map[k].push(i)
    }
    return map
  }, [issues])

  async function moveIssue(issueId: string, toStatus: IssueStatus) {
    await db.issues.update(issueId, { status: toStatus, updatedAt: Date.now() })
  }

  return (
    <div className="board" data-testid="board">
      {STATUSES.map((s) => {
        const col = byStatus[s] ?? []
        const shown = col.slice(0, BOARD_COL_WINDOW)
        const hidden = col.length - shown.length
        return (
          <div
            key={s}
            className={`board-col${dragOver === s ? ' drag-over' : ''}`}
            data-status={s}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(s)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              const id = e.dataTransfer.getData('text/plain')
              if (id) moveIssue(id, s)
            }}
          >
            <p className="board-col-title" style={{ color: STATUS_COLOR[s] }}>
              {STATUS_LABEL[s]}{' '}
              <span className="board-col-count" data-testid={`col-count-${s}`}>
                {col.length}
              </span>
            </p>
            <div className="board-col-body" data-testid={`col-body-${s}`}>
              {shown.map((issue) => (
                <div
                  key={issue.id}
                  className="board-card"
                  draggable
                  data-card-key={issue.key}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', issue.id)}
                >
                  <span className="board-card-key">{issue.key}</span>
                  <p className="board-card-title">{issue.title}</p>
                  <span className={`issue-priority pri-${issue.priority}`}>{issue.priority}</span>
                </div>
              ))}
              {hidden > 0 && (
                <p className="board-col-more">还有 {hidden.toLocaleString()} 条未显示</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 时间线（oas-gantt） ── */
interface GanttElement extends HTMLElement {
  tasks?: unknown[]
}

function TimelineView({ issues }: { issues: Issue[] }) {
  const ganttRef = useRef<GanttElement>(null)
  const tasks = useMemo(
    () =>
      issues
        .filter((i) => i.dueAt !== null && i.dueAt > i.createdAt)
        .slice(0, 50)
        .map((i) => ({
          name: `${i.key} ${i.title}`,
          start: new Date(i.createdAt).toISOString().slice(0, 10),
          end: new Date(i.dueAt as number).toISOString().slice(0, 10),
          type: 'task' as const,
        })),
    [issues],
  )

  // oas-gantt 的 tasks/scale 走 property 通道（attribute 会被 React 19 的
  // property 分派覆盖原型方法/收到非数组值），经 ref 显式赋值最稳
  useEffect(() => {
    if (ganttRef.current) ganttRef.current.tasks = tasks
  }, [tasks])

  if (tasks.length === 0) {
    return <div className="timeline-empty">暂无带截止日期的 Issue</div>
  }

  return (
    <div className="timeline-page">
      <oas-gantt ref={ganttRef} data-testid="gantt" style={{ width: '100%', height: '500px' }} />
    </div>
  )
}
