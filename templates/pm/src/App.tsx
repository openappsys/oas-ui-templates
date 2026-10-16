import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import { db } from './db/schema'
import type { Issue, IssuePriority, IssueStatus } from './types'
import { STATUS_LABEL } from './types'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
const PRIORITIES: IssuePriority[] = ['urgent', 'high', 'medium', 'low']
const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}
const LIST_WINDOW = 500
const BOARD_COL_WINDOW = 200

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

/** fractional order：在 prev/next 之间取中值（浮点），边界用 ±1024 步进 */
function betweenOrder(prev?: number, next?: number): number {
  if (prev == null && next == null) return 0
  if (prev == null) return (next as number) - 1024
  if (next == null) return prev + 1024
  return (prev + next) / 2
}

export function App() {
  const [view, setView] = useState<View>('issues')
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null)
  const aboutRef = useRef<HTMLElement>(null)
  const createRef = useRef<HTMLElement>(null)
  const issues = useIssueWindow(statusFilter)
  const total = useIssueCount(statusFilter)

  // oas-modal 的 title 命中 HTMLElement 原生 property（React 19 走 property 不落
  // attribute，组件收不到），挂载后显式 setAttribute
  useEffect(() => {
    createRef.current?.setAttribute('title', '新建 Issue')
    aboutRef.current?.setAttribute('title', '关于')
  }, [])

  const exportCsv = useCallback(() => {
    if (!issues?.length) return
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = [
      'Key,标题,状态,优先级,创建日期',
      ...issues.map((i) =>
        [
          i.key,
          esc(i.title),
          i.status,
          i.priority,
          new Date(i.createdAt).toISOString().slice(0, 10),
        ].join(','),
      ),
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oas-pm-issues-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [issues])

  const createIssue = useCallback(async () => {
    const modal = createRef.current
    if (!modal) return
    const input = modal.querySelector('oas-input') as HTMLElement & { value?: string }
    const title = (input?.value ?? '').trim()
    const errEl = modal.querySelector<HTMLElement>('[data-testid="create-error"]')
    if (!title) {
      if (errEl) errEl.hidden = false
      return
    }
    if (errEl) errEl.hidden = true
    const status = (modal.querySelector('[data-testid="create-status"]') as HTMLSelectElement)
      .value as IssueStatus
    const priority = (modal.querySelector('[data-testid="create-priority"]') as HTMLSelectElement)
      .value as IssuePriority
    await db.issues.add({
      id: nanoid(),
      projectId: 'project-1',
      key: `OAS-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`,
      title,
      description: '',
      status,
      priority,
      assigneeId: null,
      reporterId: 'member-1',
      labels: [],
      startAt: null,
      dueAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: Date.now(),
    })
    if (input) input.value = ''
    createRef.current?.removeAttribute('visible')
  }, [])

  return (
    <div className="app-frame">
      <header className="titlebar" data-testid="titlebar">
        <span className="tb-name">OAS PM</span>
        <span className="tb-spacer" />
      </header>
      <nav className="menubar" data-testid="pm-toolbar">
        <oas-button
          type="primary"
          data-testid="toolbar-new"
          onClick={() => createRef.current?.setAttribute('visible', '')}
        >
          ＋ 新建 Issue
        </oas-button>
        <button
          className="toolbar-btn"
          type="button"
          data-testid="toolbar-export"
          onClick={exportCsv}
        >
          导出 CSV（当前窗口）
        </button>
        <span className="tb-spacer" />
        <button
          className="toolbar-btn"
          type="button"
          data-testid="toolbar-about"
          onClick={() => aboutRef.current?.setAttribute('visible', '')}
        >
          关于
        </button>
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

      {/* 新建 Issue */}
      <oas-modal ref={createRef} no-footer data-testid="modal-create">
        <div className="create-body">
          <div className="create-field">
            <label htmlFor="create-title">标题</label>
            <oas-input data-testid="create-title" placeholder="Issue 标题" />
            <p className="create-error" data-testid="create-error" hidden>
              标题不能为空
            </p>
          </div>
          <div className="create-row">
            <div className="create-field">
              <label htmlFor="create-status">状态</label>
              <select data-testid="create-status" defaultValue="todo">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="create-field">
              <label htmlFor="create-priority">优先级</label>
              <select data-testid="create-priority" defaultValue="medium">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="quit-actions">
            <oas-button
              data-testid="create-cancel"
              onClick={() => {
                const modal = createRef.current
                if (!modal) return
                const input = modal.querySelector('oas-input') as HTMLElement & { value?: string }
                if (input) input.value = ''
                const errEl = modal.querySelector<HTMLElement>('[data-testid="create-error"]')
                if (errEl) errEl.hidden = true
                modal.removeAttribute('visible')
              }}
            >
              取消
            </oas-button>
            <oas-button
              type="primary"
              data-testid="create-submit"
              onClick={() => void createIssue()}
            >
              创建
            </oas-button>
          </div>
        </div>
      </oas-modal>

      {/* 关于 */}
      <oas-modal ref={aboutRef} no-footer data-testid="modal-about">
        <div className="about-body">
          <span className="about-logo">OAS</span>
          <p className="about-name">OAS PM</p>
          <p className="about-ver">v0.1.0 · oas-ui 2.6.1</p>
          <p className="about-desc">
            项目管理模板——React 19 + Dexie.js IndexedDB 本地优先，支持 10W~100W 级 Issue
            的列表、看板与甘特图。
          </p>
          <div className="quit-actions">
            <oas-button
              type="primary"
              data-testid="about-close"
              onClick={() => aboutRef.current?.removeAttribute('visible')}
            >
              知道了
            </oas-button>
          </div>
        </div>
      </oas-modal>
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

/* ── 看板（列内按 order 升序；拖拽时虚线占位框指示落点） ── */
function KanbanBoard({ issues }: { issues: Issue[] }) {
  const [dragOver, setDragOver] = useState<IssueStatus | null>(null)
  const [dropTarget, setDropTarget] = useState<{ col: IssueStatus; index: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const byStatus = useMemo(() => {
    const map: Partial<Record<IssueStatus, Issue[]>> = {}
    for (const s of STATUSES) map[s] = []
    for (const i of issues) {
      const k = i.status as IssueStatus
      if (map[k]) map[k].push(i)
    }
    // 列内按 order 升序——拖拽插入位置由 order 主导，与更新时间无关
    for (const s of STATUSES) map[s]!.sort((a, b) => a.order - b.order)
    return map
  }, [issues])

  async function moveIssue(issueId: string, toStatus: IssueStatus, order: number) {
    await db.issues.update(issueId, { status: toStatus, order, updatedAt: Date.now() })
  }

  /** dragover 时按鼠标 Y 与卡片中点比较，计算插入下标（排除被拖卡自身） */
  function calcDropIndex(body: HTMLElement, clientY: number): number {
    const cards = Array.from(body.querySelectorAll<HTMLElement>('.board-card:not(.is-dragging)'))
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return cards.length
  }

  function handleDrop(s: IssueStatus, body: HTMLElement | null, e: React.DragEvent) {
    const id = e.dataTransfer.getData('text/plain')
    if (!id || !body) return
    const col = byStatus[s] ?? []
    const index = calcDropIndex(body, e.clientY)
    // 落点两侧 order 取中值（排除被拖卡后相邻的卡）
    const rest = col.filter((c) => c.id !== id)
    const prevOrder = index > 0 ? rest[index - 1]?.order : undefined
    const nextOrder = rest[index]?.order
    const order =
      prevOrder != null && nextOrder != null && prevOrder === nextOrder
        ? prevOrder + 1
        : betweenOrder(prevOrder, nextOrder)
    void moveIssue(id, s, order)
  }

  /** 拖拽预览：源列移除被拖卡，目标列把被拖卡插到落点位（预览重排，零净增元素） */
  function previewCol(s: IssueStatus, col: Issue[]): Issue[] {
    if (!draggingId) return col
    const dragging = issues.find((i) => i.id === draggingId)
    const rest = col.filter((c) => c.id !== draggingId)
    if (dropTarget?.col !== s) return rest
    if (!dragging) return col
    const arr = [...rest]
    arr.splice(Math.min(dropTarget.index, arr.length), 0, dragging)
    return arr
  }

  function clearDrag() {
    setDragOver(null)
    setDropTarget(null)
    setDraggingId(null)
  }

  return (
    <div className="board" data-testid="board">
      {STATUSES.map((s) => {
        const col = previewCol(s, byStatus[s] ?? [])
        const shown = col.slice(0, BOARD_COL_WINDOW)
        const hidden = (byStatus[s]?.length ?? 0) - (dropTarget?.col === s ? 0 : shown.length)
        return (
          <div
            key={s}
            className={`board-col${dragOver === s ? ' drag-over' : ''}`}
            data-status={s}
            onDragOver={(e) => {
              e.preventDefault()
              const body = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                '.board-col-body',
              )
              if (!body) return
              const index = calcDropIndex(body, e.clientY)
              // dragover 高频触发：落点未变时不 setState，避免整板重渲染
              setDragOver((prev) => (prev === s ? prev : s))
              setDropTarget((prev) =>
                prev?.col === s && prev.index === index ? prev : { col: s, index },
              )
            }}
            onDragLeave={(e) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                setDragOver(null)
                setDropTarget(null)
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              const body = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
                '.board-col-body',
              )
              handleDrop(s, body, e)
              clearDrag()
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
                  className={`board-card${draggingId === issue.id ? ' is-dragging' : ''}`}
                  draggable
                  data-card-key={issue.key}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', issue.id)
                    setDraggingId(issue.id)
                  }}
                  onDragEnd={clearDrag}
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
