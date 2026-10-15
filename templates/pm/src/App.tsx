import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'
import type { Issue, IssueStatus } from './types'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}

export function App() {
  const [statusFilter, setStatusFilter] = useState<IssueStatus | null>(null)

  const issues = useLiveQuery(
    () =>
      statusFilter
        ? db.issues
            .where('[projectId+status]')
            .equals(['project-1', statusFilter])
            .reverse()
            .sortBy('updatedAt')
        : db.issues.orderBy('updatedAt').reverse().limit(500).toArray(),
    [statusFilter],
  )

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
          <span className="act-btn is-active" title="Issues">
            <oas-icon name="list" size="20" />
          </span>
        </aside>
        <aside className="side-panel">
          <p className="side-title">状态</p>
          <button
            className={`side-item${statusFilter === null ? ' is-active' : ''}`}
            type="button"
            onClick={() => setStatusFilter(null)}
          >
            <span>全部</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`side-item${statusFilter === s ? ' is-active' : ''}`}
              type="button"
              onClick={() => setStatusFilter(s)}
            >
              <span style={{ color: STATUS_COLOR[s] }}>●</span>
              <span>{s}</span>
            </button>
          ))}
        </aside>
        <main className="content">{issues && <IssueList issues={issues} />}</main>
      </div>
      <footer className="statusbar">
        <span>● 就绪</span>
        <span className="sb-spacer" />
        <span>OAS PM v0.1.0</span>
      </footer>
    </div>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  const [selected, setSelected] = useState<Issue | null>(null)

  return (
    <div className="issue-page">
      <div className="issue-header">
        <h1>Issues</h1>
        <span className="issue-total">{issues.length} 条</span>
        <oas-button type="primary" size="small" data-testid="new-issue">
          + 新建
        </oas-button>
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
  const [scrollTop, setScrollTop] = useState(0)
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const ROW_H = 44
  const OVERSCAN = 8
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const visible = Math.ceil(720 / ROW_H) + OVERSCAN * 2
  const end = Math.min(issues.length, start + visible)

  const rows: React.ReactNode[] = []
  for (let i = start; i < end; i++) {
    const issue = issues[i]
    rows.push(
      <div
        key={issue.id}
        className="issue-row"
        style={{
          position: 'absolute',
          top: i * ROW_H,
          left: 0,
          right: 0,
          height: ROW_H,
          cursor: 'pointer',
        }}
        onClick={() => onSelect(issue)}
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
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
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
            <span className={`st-${issue.status}`}>{issue.status}</span>
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
