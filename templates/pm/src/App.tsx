import { useState, useCallback } from 'react'
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

const ROW_H = 44
const OVERSCAN = 8

export function App() {
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
          {STATUSES.map((s) => (
            <button key={s} className="side-item" type="button">
              <span style={{ color: STATUS_COLOR[s] }}>●</span>
              <span>{STATUS_LABEL[s as IssueStatus]}</span>
            </button>
          ))}
        </aside>
        <main className="content">
          <IssueList />
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

function IssueList() {
  const issues = useLiveQuery(
    () => db.issues.orderBy('updatedAt').reverse().limit(500).toArray(),
    [],
  )

  if (!issues) return <div className="loading">加载中…</div>

  return (
    <div className="issue-page">
      <div className="issue-header">
        <h1>Issues</h1>
        <span className="issue-total">{issues.length} 条</span>
      </div>
      <VirtualIssueList issues={issues} />
    </div>
  )
}

function VirtualIssueList({ issues }: { issues: Issue[] }) {
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
        style={{ position: 'absolute', top: i * ROW_H, left: 0, right: 0, height: ROW_H }}
      >
        <span className="issue-key">{issue.key}</span>
        <span className="issue-title">{issue.title}</span>
      </div>,
    )
  }

  return (
    <div
      className="issue-scroll"
      style={{ height: '100%', overflowY: 'auto', position: 'relative' }}
      onScroll={onScroll}
    >
      <div style={{ height: issues.length * ROW_H, position: 'relative' }}>{rows}</div>
    </div>
  )
}
