import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import { db } from './db/schema'
import type { Issue, IssuePriority, IssueStatus, Member, Project } from './types'
import { ISSUE_PRIORITIES, STATUS_LABEL } from './types'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}
const PRIORITY_WEIGHT: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const CURRENT_USER = 'member-1'
const LIST_WINDOW = 500
const GROUP_PREVIEW = 30
const BOARD_COL_WINDOW = 200

type View = 'dashboard' | 'issues' | 'board' | 'timeline'
type SortBy = 'updatedAt' | 'priority' | 'createdAt'
type Grouping = 'none' | 'priority' | 'assignee'

interface Filters {
  projectId: string
  statusFilter: IssueStatus | null
  assigneeFilter: string | null
  priorityFilter: IssuePriority | null
  search: string
  myOnly: boolean
  sortBy: SortBy
}

const DEFAULT_FILTERS: Filters = {
  projectId: 'project-1',
  statusFilter: null,
  assigneeFilter: null,
  priorityFilter: null,
  search: '',
  myOnly: false,
  sortBy: 'updatedAt',
}

/** 数据窗口：compound index 取项目/状态维度最近 LIST_WINDOW 条，再内存细筛 */
function useIssueWindow(f: Filters) {
  return useLiveQuery(async () => {
    const items = f.statusFilter
      ? await db.issues
          .where('[projectId+status+updatedAt]')
          .between(
            ['project-placeholder', f.statusFilter, Dexie.minKey].map((v, i) =>
              i === 0 ? f.projectId : v,
            ),
            ['project-placeholder', f.statusFilter, Dexie.maxKey].map((v, i) =>
              i === 0 ? f.projectId : v,
            ),
          )
          .reverse()
          .limit(LIST_WINDOW)
          .toArray()
      : await db.issues
          .where('[projectId+updatedAt]')
          .between([f.projectId, Dexie.minKey], [f.projectId, Dexie.maxKey])
          .reverse()
          .limit(LIST_WINDOW)
          .toArray()
    let out = items
    if (f.assigneeFilter) out = out.filter((i) => i.assigneeId === f.assigneeFilter)
    if (f.myOnly) out = out.filter((i) => i.assigneeId === CURRENT_USER)
    if (f.priorityFilter) out = out.filter((i) => i.priority === f.priorityFilter)
    if (f.search.trim()) {
      const kw = f.search.trim().toLowerCase()
      out = out.filter(
        (i) => i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw),
      )
    }
    if (f.sortBy === 'priority') {
      out = [...out].sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    } else if (f.sortBy === 'createdAt') {
      out = [...out].sort((a, b) => b.createdAt - a.createdAt)
    }
    return out
  }, [
    f.projectId,
    f.statusFilter,
    f.assigneeFilter,
    f.priorityFilter,
    f.search,
    f.myOnly,
    f.sortBy,
  ])
}

/** 全项目真实计数（index count，与窗口无关） */
function useProjectCounts(projectId: string) {
  return useLiveQuery(async () => {
    const [total, ...byStatus] = await Promise.all([
      db.issues.where('projectId').equals(projectId).count(),
      ...STATUSES.map((s) => db.issues.where('[projectId+status]').equals([projectId, s]).count()),
    ])
    return { total, byStatus: Object.fromEntries(STATUSES.map((s, i) => [s, byStatus[i]])) }
  }, [projectId])
}

function useMembers(): Member[] | undefined {
  return useLiveQuery(() => db.members.toArray(), [])
}

function useProjects(): Project[] | undefined {
  return useLiveQuery(() => db.projects.toArray(), [])
}

/** 成员在当前窗口内的计数（窗口 500 内，展示用） */
function useWindowAssigneeCounts(issues: Issue[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const i of issues ?? []) {
      if (i.assigneeId) map.set(i.assigneeId, (map.get(i.assigneeId) ?? 0) + 1)
    }
    return map
  }, [issues])
}

/** fractional order：在 prev/next 之间取中值（浮点），边界用 ±1024 步进 */
function betweenOrder(prev?: number, next?: number): number {
  if (prev == null && next == null) return 0
  if (prev == null) return (next as number) - 1024
  if (next == null) return prev + 1024
  return (prev + next) / 2
}

/* ── 通用小组件 ── */
function Avatar({ member, size = 20 }: { member?: Member; size?: number }) {
  if (!member) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size }} title="未分配">
        ?
      </span>
    )
  }
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: member.avatarColor }}
      title={member.name}
    >
      {member.name[0]}
    </span>
  )
}

/** oas-chart：data/options 走 attribute（React 19 property 分派对 data 不可靠） */
function Chart({
  type,
  data,
  options,
  testid,
  label,
}: {
  type: string
  data: unknown
  options?: Record<string, unknown>
  testid: string
  label: string
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('type', type)
    el.setAttribute('data', JSON.stringify(data))
    if (options) el.setAttribute('options', JSON.stringify(options))
    el.setAttribute('class', 'pm-chart')
  }, [type, data, options])
  return <oas-chart ref={ref} data-testid={testid} aria-label={label} data-class="pm-chart" />
}

export function App() {
  const [view, setView] = useState<View>('issues')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [grouping, setGrouping] = useState<Grouping>('none')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const aboutRef = useRef<HTMLElement>(null)
  const createRef = useRef<HTMLElement>(null)

  const issues = useIssueWindow(filters)
  const counts = useProjectCounts(filters.projectId)
  const members = useMembers()
  const projects = useProjects()
  const memberCounts = useWindowAssigneeCounts(issues)
  const memberMap = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])

  const setF = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
  }, [])

  const exportCsv = useCallback(() => {
    if (!issues?.length) return
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = [
      'Key,标题,状态,优先级,负责人,创建日期',
      ...issues.map((i) =>
        [
          i.key,
          esc(i.title),
          i.status,
          i.priority,
          esc(memberMap.get(i.assigneeId ?? '')?.name ?? ''),
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
  }, [issues, memberMap])

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
    const assigneeId = (modal.querySelector('[data-testid="create-assignee"]') as HTMLSelectElement)
      .value
    const projectId = filters.projectId
    // key 严格递增：事务内读改写项目计数器
    const keyNum = await db.transaction('rw', db.projects, async () => {
      const p = await db.projects.get(projectId)
      const n = p?.nextKeyNum ?? 100001
      await db.projects.update(projectId, { nextKeyNum: n + 1 })
      return n
    })
    const projectKey = projectsRef.current.find((p) => p.id === projectId)?.key ?? 'OAS'
    await db.issues.add({
      id: nanoid(),
      projectId,
      key: `${projectKey}-${keyNum}`,
      title,
      description: '',
      status,
      priority,
      assigneeId: assigneeId || null,
      reporterId: CURRENT_USER,
      labels: [],
      startAt: null,
      dueAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: Date.now(),
    })
    if (input) input.value = ''
    createRef.current?.removeAttribute('visible')
  }, [filters.projectId, projects])

  // projects 的 ref：createIssue 回调里读取最新项目 key
  const projectsRef = useRef<Project[]>([])
  useEffect(() => {
    projectsRef.current = projects ?? []
  }, [projects])

  // 快捷键：C 新建（输入框聚焦时跳过）/ 聚焦搜索 / Esc 关抽屉
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc 无论焦点在哪都关抽屉（含评论输入框内）
      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      const t = e.target as HTMLElement
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        createRef.current?.setAttribute('visible', '')
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-frame">
      <header className="topbar" data-testid="pm-toolbar">
        <span className="tb-brand">
          <span className="tb-logo">OAS</span> PM
        </span>
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
        <input
          ref={searchRef}
          className="toolbar-search"
          type="search"
          placeholder="搜索 Key 或标题…（/）"
          data-testid="toolbar-search"
          value={filters.search}
          onChange={(e) => setF('search', e.target.value)}
        />
        <span className="tb-spacer" />
        <button
          className="toolbar-btn"
          type="button"
          data-testid="toolbar-about"
          onClick={() => aboutRef.current?.setAttribute('visible', '')}
        >
          关于
        </button>
      </header>
      <div className="main">
        <aside className="side-panel" data-testid="side-panel">
          <div className="view-seg" data-testid="view-seg">
            <button
              className={`view-seg-btn${view === 'dashboard' ? ' is-active' : ''}`}
              type="button"
              title="仪表盘"
              data-testid="nav-dashboard"
              onClick={() => setView('dashboard')}
            >
              仪表盘
            </button>
            <button
              className={`view-seg-btn${view === 'issues' ? ' is-active' : ''}`}
              type="button"
              title="Issues"
              data-testid="nav-issues"
              onClick={() => setView('issues')}
            >
              列表
            </button>
            <button
              className={`view-seg-btn${view === 'board' ? ' is-active' : ''}`}
              type="button"
              title="看板"
              data-testid="nav-board"
              onClick={() => setView('board')}
            >
              看板
            </button>
            <button
              className={`view-seg-btn${view === 'timeline' ? ' is-active' : ''}`}
              type="button"
              title="时间线"
              data-testid="nav-timeline"
              onClick={() => setView('timeline')}
            >
              时间线
            </button>
          </div>
          <p className="side-title">项目</p>
          {(projects ?? []).map((p) => (
            <button
              key={p.id}
              className={`side-item${filters.projectId === p.id ? ' is-active' : ''}`}
              type="button"
              data-testid={`project-${p.id}`}
              onClick={() => {
                setFilters((prev) => ({ ...prev, projectId: p.id, statusFilter: null }))
              }}
            >
              <span>{p.name}</span>
            </button>
          ))}
          <p className="side-title">视图</p>
          <button
            className={`side-item${!filters.myOnly ? ' is-active' : ''}`}
            type="button"
            data-testid="view-all"
            onClick={() => setF('myOnly', false)}
          >
            <span>全部 Issues</span>
          </button>
          <button
            className={`side-item${filters.myOnly ? ' is-active' : ''}`}
            type="button"
            data-testid="view-my"
            onClick={() => setF('myOnly', true)}
          >
            <span>我的（{memberMap.get(CURRENT_USER)?.name ?? ''}）</span>
          </button>
          <p className="side-title">状态</p>
          <button
            className={`side-item${filters.statusFilter === null ? ' is-active' : ''}`}
            type="button"
            data-testid="filter-all"
            onClick={() => setF('statusFilter', null)}
          >
            <span>全部</span>
            <span className="side-count">{counts?.total.toLocaleString() ?? '…'}</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`side-item${filters.statusFilter === s ? ' is-active' : ''}`}
              type="button"
              data-testid={`filter-${s}`}
              onClick={() => setF('statusFilter', s)}
            >
              <span style={{ color: STATUS_COLOR[s] }}>●</span>
              <span>{STATUS_LABEL[s]}</span>
              <span className="side-count">{counts?.byStatus[s]?.toLocaleString() ?? '…'}</span>
            </button>
          ))}
          <p className="side-title">成员（窗口内）</p>
          {(members ?? []).map((m) => (
            <button
              key={m.id}
              className={`side-item${filters.assigneeFilter === m.id ? ' is-active' : ''}`}
              type="button"
              data-testid={`member-${m.id}`}
              onClick={() => setF('assigneeFilter', filters.assigneeFilter === m.id ? null : m.id)}
            >
              <Avatar member={m} size={16} />
              <span>{m.name}</span>
              <span className="side-count">{memberCounts.get(m.id) ?? 0}</span>
            </button>
          ))}
        </aside>
        <main className="content">
          {view === 'dashboard' && (
            <DashboardView projectId={filters.projectId} memberMap={memberMap} />
          )}
          {view === 'issues' && issues && (
            <IssueListView
              issues={issues}
              total={counts?.total ?? issues.length}
              filters={filters}
              setFilters={setFilters}
              grouping={grouping}
              setGrouping={setGrouping}
              memberMap={memberMap}
              onSelect={setSelectedId}
            />
          )}
          {view === 'board' && <KanbanBoard issues={issues ?? []} memberMap={memberMap} />}
          {view === 'timeline' && <TimelineView issues={issues ?? []} />}
        </main>
      </div>

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
                {ISSUE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="create-field">
              <label htmlFor="create-assignee">负责人</label>
              <select data-testid="create-assignee" defaultValue="">
                <option value="">未分配</option>
                {(members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
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

      {/* Issue 详情抽屉 */}
      {selectedId && (
        <IssueDetailDrawer
          issueId={selectedId}
          memberMap={memberMap}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* 关于 */}
      <oas-modal ref={aboutRef} no-footer data-testid="modal-about">
        <div className="about-body">
          <span className="about-logo">OAS</span>
          <p className="about-name">OAS PM</p>
          <p className="about-ver">v0.2.0 · oas-ui 2.6.1</p>
          <p className="about-desc">
            项目管理模板——React 19 + Dexie.js IndexedDB 本地优先，支持 10W~100W 级 Issue
            的仪表盘、列表、看板与甘特图。
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

/* ── 仪表盘 ── */
function DashboardView({
  projectId,
  memberMap,
}: {
  projectId: string
  memberMap: Map<string, Member>
}) {
  const counts = useProjectCounts(projectId)
  const topAssignees = useLiveQuery(async () => {
    const members = await db.members.toArray()
    const rows = await Promise.all(
      members.map(async (m) => ({
        name: m.name,
        value: await db.issues.where('[projectId+assigneeId]').equals([projectId, m.id]).count(),
      })),
    )
    return rows.sort((a, b) => b.value - a.value).slice(0, 6)
  }, [projectId])

  const statusData = STATUSES.map((s) => ({
    label: STATUS_LABEL[s],
    value: counts?.byStatus[s] ?? 0,
  }))

  return (
    <div className="dash-page" data-testid="dashboard">
      <h1 className="page-h1">仪表盘</h1>
      <div className="dash-cards">
        <div className="dash-card" data-testid="stat-total">
          <p className="dash-card-num">{counts?.total.toLocaleString() ?? '…'}</p>
          <p className="dash-card-label">全部 Issue</p>
        </div>
        {(['todo', 'in_progress', 'done'] as IssueStatus[]).map((s) => (
          <div key={s} className="dash-card" data-testid={`stat-${s}`}>
            <p className="dash-card-num" style={{ color: STATUS_COLOR[s] }}>
              {(counts?.byStatus[s] ?? 0).toLocaleString()}
            </p>
            <p className="dash-card-label">{STATUS_LABEL[s]}</p>
          </div>
        ))}
      </div>
      <div className="dash-charts">
        <div className="dash-chart-box">
          <p className="dash-chart-title">状态分布</p>
          <Chart type="donut" data={statusData} testid="chart-status" label="状态分布图" />
        </div>
        <div className="dash-chart-box">
          <p className="dash-chart-title">成员 Issue 数 Top 6</p>
          <Chart
            type="bar"
            data={topAssignees ?? []}
            testid="chart-assignee"
            label="成员 Issue 分布图"
          />
        </div>
      </div>
      <p className="dash-note" data-testid="dashboard-member-note">
        {memberMap.get(CURRENT_USER)?.name ?? ''} 的工作台 · 数据实时来自 IndexedDB
      </p>
    </div>
  )
}

/* ── Issue 列表（筛选/排序/分组工具条） ── */
function IssueListView({
  issues,
  total,
  filters,
  setFilters,
  grouping,
  setGrouping,
  memberMap,
  onSelect,
}: {
  issues: Issue[]
  total: number
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  grouping: Grouping
  setGrouping: (g: Grouping) => void
  memberMap: Map<string, Member>
  onSelect: (id: string) => void
}) {
  const groups = useMemo(() => {
    if (grouping === 'none') return null
    const map = new Map<string, Issue[]>()
    for (const i of issues) {
      const k = grouping === 'priority' ? i.priority : (i.assigneeId ?? '未分配')
      const arr = map.get(k) ?? []
      arr.push(i)
      map.set(k, arr)
    }
    return [...map.entries()]
  }, [issues, grouping])

  const rowEl = (i: Issue) => (
    <div
      key={i.id}
      className="issue-row"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(i.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(i.id)
      }}
    >
      <span className="issue-key">{i.key}</span>
      <span className="issue-title">{i.title}</span>
      <Avatar member={memberMap.get(i.assigneeId ?? '')} size={18} />
      <span className={`issue-priority pri-${i.priority}`}>{i.priority}</span>
      <span className={`issue-status st-${i.status}`}>{i.status}</span>
    </div>
  )

  return (
    <div className="issue-page">
      <div className="issue-header">
        <h1>Issues</h1>
        <span className="issue-total" data-testid="issue-total">
          {total.toLocaleString()} 条{total > issues.length ? `（窗口 ${issues.length} 条）` : ''}
        </span>
      </div>
      <div className="issue-toolbar" data-testid="issue-toolbar">
        <span className="issue-toolbar-label">排序</span>
        <select
          data-testid="sort-by"
          value={filters.sortBy}
          onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as SortBy }))}
        >
          <option value="updatedAt">最近更新</option>
          <option value="priority">优先级</option>
          <option value="createdAt">创建时间</option>
        </select>
        <span className="issue-toolbar-label">分组</span>
        <select
          data-testid="group-by"
          value={grouping}
          onChange={(e) => setGrouping(e.target.value as Grouping)}
        >
          <option value="none">不分组</option>
          <option value="priority">按优先级</option>
          <option value="assignee">按负责人</option>
        </select>
        <span className="issue-toolbar-label">优先级</span>
        <select
          data-testid="filter-priority"
          value={filters.priorityFilter ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              priorityFilter: (e.target.value || null) as IssuePriority | null,
            }))
          }
        >
          <option value="">全部</option>
          {ISSUE_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {(filters.search || filters.assigneeFilter || filters.priorityFilter || filters.myOnly) && (
          <button
            className="issue-toolbar-clear"
            type="button"
            data-testid="filter-clear"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                search: '',
                assigneeFilter: null,
                priorityFilter: null,
                myOnly: false,
              }))
            }
          >
            清除筛选
          </button>
        )}
      </div>
      <div className="issue-thead">
        <span>Key</span>
        <span>标题</span>
        <span>负责人</span>
        <span>优先级</span>
        <span>状态</span>
      </div>
      {groups ? (
        <div className="issue-scroll">
          {groups.map(([k, arr]) => (
            <div key={k} className="issue-group">
              <p className="issue-group-title">
                {k} <span className="side-count">{arr.length}</span>
              </p>
              {arr.slice(0, GROUP_PREVIEW).map(rowEl)}
              {arr.length > GROUP_PREVIEW && (
                <p className="board-col-more">组内还有 {arr.length - GROUP_PREVIEW} 条未显示</p>
              )}
            </div>
          ))}
          {groups.length === 0 && <p className="timeline-empty">无匹配 Issue</p>}
        </div>
      ) : (
        <VirtualIssueList issues={issues} onSelect={onSelect} memberMap={memberMap} />
      )}
    </div>
  )
}

function VirtualIssueList({
  issues,
  onSelect,
  memberMap,
}: {
  issues: Issue[]
  onSelect: (id: string) => void
  memberMap: Map<string, Member>
}) {
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
        onClick={() => onSelect(issue.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect(issue.id)
        }}
      >
        <span className="issue-key">{issue.key}</span>
        <span className="issue-title">{issue.title}</span>
        <Avatar member={memberMap.get(issue.assigneeId ?? '')} size={18} />
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

/* ── 评论区（详情抽屉） ── */
function CommentsBlock({ issueId }: { issueId: string }) {
  const comments = useLiveQuery(
    () =>
      db.comments
        .where('[issueId+createdAt]')
        .between([issueId, Dexie.minKey], [issueId, Dexie.maxKey])
        .toArray(),
    [issueId],
  )
  const [draft, setDraft] = useState('')

  const submit = async () => {
    const body = draft.trim()
    if (!body) return
    await db.comments.add({
      id: nanoid(),
      issueId,
      authorId: CURRENT_USER,
      body,
      createdAt: Date.now(),
    })
    setDraft('')
  }

  return (
    <div className="comments-block" data-testid="comments-block">
      <span>评论（{comments?.length ?? 0}）</span>
      <div className="comments-list">
        {(comments ?? []).map((c) => (
          <div key={c.id} className="comment-item" data-testid="comment-item">
            <p className="comment-body">{c.body}</p>
            <p className="comment-meta">{new Date(c.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="comment-input-row">
        <input
          className="comment-input"
          data-testid="comment-input"
          placeholder="写下评论…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        <button
          className="comment-send"
          type="button"
          data-testid="comment-send"
          onClick={() => void submit()}
        >
          发送
        </button>
      </div>
    </div>
  )
}

/* ── Issue 详情抽屉（即时保存） ── */
const LABELS = ['frontend', 'backend', 'design', 'bug', 'feature', 'tech-debt', 'docs', 'infra']

function IssueDetailDrawer({
  issueId,
  memberMap,
  onClose,
}: {
  issueId: string
  memberMap: Map<string, Member>
  onClose: () => void
}) {
  const issue = useLiveQuery(() => db.issues.get(issueId), [issueId])
  const [desc, setDesc] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!issue) {
    return (
      <div className="detail-overlay" onClick={onClose}>
        <div className="detail-panel" onClick={(e) => e.stopPropagation()} />
      </div>
    )
  }

  const save = (changes: Partial<Issue>) => void db.issues.update(issue.id, changes)

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
      <div className="detail-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
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
            <select
              data-testid="detail-status"
              value={issue.status}
              onChange={(e) => save({ status: e.target.value as IssueStatus })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span>优先级</span>
            <select
              data-testid="detail-priority"
              value={issue.priority}
              onChange={(e) => save({ priority: e.target.value as IssuePriority })}
            >
              {ISSUE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span>负责人</span>
            <select
              data-testid="detail-assignee"
              value={issue.assigneeId ?? ''}
              onChange={(e) => save({ assigneeId: e.target.value || null })}
            >
              <option value="">未分配</option>
              {[...memberMap.values()].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="detail-desc-block">
          <span>描述</span>
          <textarea
            data-testid="detail-desc"
            placeholder="补充描述…"
            value={desc ?? issue.description}
            onChange={(e) => setDesc(e.target.value)}
          />
          {desc !== null && desc !== issue.description && (
            <button
              className="detail-save-desc"
              type="button"
              data-testid="detail-desc-save"
              onClick={() => {
                save({ description: desc })
                setDesc(null)
              }}
            >
              保存描述
            </button>
          )}
        </div>
        <div className="detail-labels-block">
          <span>标签</span>
          <div className="detail-labels">
            {issue.labels.map((l) => (
              <span key={l} className="label-chip">
                {l}
                <button
                  type="button"
                  className="label-chip-x"
                  aria-label={`移除标签 ${l}`}
                  data-testid={`label-remove-${l}`}
                  onClick={() => save({ labels: issue.labels.filter((x) => x !== l) })}
                >
                  ×
                </button>
              </span>
            ))}
            <select
              className="label-add"
              data-testid="label-add"
              value=""
              onChange={(e) => {
                const l = e.target.value
                if (l && !issue.labels.includes(l)) save({ labels: [...issue.labels, l] })
              }}
            >
              <option value="">＋ 标签…</option>
              {LABELS.filter((l) => !issue.labels.includes(l)).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CommentsBlock issueId={issue.id} />
        <div className="detail-foot">
          <span className="detail-dates">
            创建 {new Date(issue.createdAt).toLocaleDateString()} · 更新{' '}
            {new Date(issue.updatedAt).toLocaleString()}
          </span>
          <button
            className={`detail-delete${confirmDelete ? ' is-confirm' : ''}`}
            type="button"
            data-testid="detail-delete"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true)
                return
              }
              void db.issues.delete(issue.id).then(onClose)
            }}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? '再点一次确认删除' : '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 看板（列内 order 升序；拖拽预览重排） ── */
function KanbanBoard({ issues, memberMap }: { issues: Issue[]; memberMap: Map<string, Member> }) {
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
    for (const s of STATUSES) map[s]!.sort((a, b) => a.order - b.order)
    return map
  }, [issues])

  async function moveIssue(issueId: string, toStatus: IssueStatus, order: number) {
    await db.issues.update(issueId, { status: toStatus, order, updatedAt: Date.now() })
  }

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
    const rest = col.filter((c) => c.id !== id)
    const prevOrder = index > 0 ? rest[index - 1]?.order : undefined
    const nextOrder = rest[index]?.order
    const order =
      prevOrder != null && nextOrder != null && prevOrder === nextOrder
        ? prevOrder + 1
        : betweenOrder(prevOrder, nextOrder)
    void moveIssue(id, s, order)
  }

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
                  <div className="board-card-top">
                    <span className="board-card-key">{issue.key}</span>
                    <Avatar member={memberMap.get(issue.assigneeId ?? '')} size={16} />
                  </div>
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
          id: i.id,
          name: `${i.key} ${i.title}`,
          start: new Date(i.startAt ?? i.createdAt).toISOString().slice(0, 10),
          end: new Date(i.dueAt as number).toISOString().slice(0, 10),
          type: 'task' as const,
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
      void db.issues.update(d.id, patch)
    }
    el.addEventListener('task-change', onChange)
    return () => el.removeEventListener('task-change', onChange)
  }, [])

  if (tasks.length === 0) {
    return <div className="timeline-empty">暂无带截止日期的 Issue</div>
  }

  return (
    <div className="timeline-page">
      <oas-gantt ref={ganttRef} data-testid="gantt" style={{ width: '100%', height: '500px' }} />
    </div>
  )
}
