import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import { db } from './db/schema'
import type { Issue, IssuePriority, IssueStatus, Member, Project } from './types'
import { ISSUE_PRIORITIES, STATUS_LABEL } from './types'
import { OSelect, OSegmented, TagChip } from './components/oas-wrappers'
import { t, loadLang, storeLang, setLang, type Lang, type DictKey } from './i18n'
import { BulkBar, useSavedViews, saveView } from './components/BulkBar'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
const STATUS_COLOR: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}
const PRIORITY_WEIGHT: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const LIST_WINDOW = 500
const GROUP_PREVIEW = 30

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
function useIssueWindow(f: Filters, currentUser: string) {
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
    // 全库搜索：search 非空时跨窗口全表匹配（key/标题，前 2000 条封顶）
    if (f.search.trim()) {
      const kw = f.search.trim().toLowerCase()
      out = await db.issues
        .filter((i) => i.title.toLowerCase().includes(kw) || i.key.toLowerCase().includes(kw))
        .limit(2000)
        .toArray()
    }
    if (f.assigneeFilter) out = out.filter((i) => i.assigneeId === f.assigneeFilter)
    if (f.myOnly) out = out.filter((i) => i.assigneeId === currentUser)
    if (f.priorityFilter) out = out.filter((i) => i.priority === f.priorityFilter)
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

/** 活动记录：字段级 diff 落库（type=字段名，from→to） */
async function logActivity(
  issueId: string,
  actorId: string,
  type: string,
  extra?: { field?: string; from?: string; to?: string },
): Promise<void> {
  await db.activities.add({
    id: nanoid(),
    issueId,
    actorId,
    type,
    ...extra,
    createdAt: Date.now(),
  })
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
  return <oas-chart ref={ref} data-testid={testid} aria-label={label} data-className="pm-chart" />
}

/** 与我相关的最近动态：他人对我负责 Issue 的变更（近 7 天，最多 20 条） */
function useMyNotifications(currentUser: string) {
  return useLiveQuery(async () => {
    const acts = await db.activities
      .where('createdAt')
      .belowOrEqual(Date.now())
      .reverse()
      .limit(300)
      .toArray()
    const mine = acts.filter((a) => a.actorId !== currentUser)
    // bulkGet 一次取齐（逐条 get 300 次会拖慢首屏渲染）
    const issues = await db.issues.bulkGet(mine.map((a) => a.issueId))
    const out: Array<{
      id: string
      actorId: string
      text: string
      issueId: string
      createdAt: number
    }> = []
    issues.forEach((issue, i) => {
      if (!issue || issue.assigneeId !== currentUser) return
      if (out.length >= 20) return
      out.push({
        id: mine[i].id,
        actorId: mine[i].actorId,
        text: issue.key + ' ' + (issue.title ?? ''),
        issueId: issue.id,
        createdAt: mine[i].createdAt,
      })
    })
    return out
  }, [currentUser])
}

function NotificationBadge({ currentUser }: { currentUser: string }) {
  const list = useMyNotifications(currentUser)
  const count = list?.length ?? 0
  if (count === 0) return null
  return (
    <oas-badge type="danger" data-testid="notify-badge">
      {String(count)}
    </oas-badge>
  )
}

function NotificationList({
  currentUser,
  onOpen,
}: {
  currentUser: string
  onOpen: (issueId: string) => void
}) {
  const list = useMyNotifications(currentUser)
  if (!list || list.length === 0) {
    return <oas-empty description="暂无与我相关的动态" />
  }
  return (
    <div className="notify-list" data-testid="notify-list">
      {list.map((n) => (
        <div
          key={n.id}
          className="notify-item"
          data-testid="notify-item"
          style={{ cursor: 'pointer' }}
          onClick={() => onOpen(n.issueId)}
        >
          <p className="notify-text">{n.text}</p>
          <p className="notify-time">{new Date(n.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}

export function App() {
  // 当前登录身份（localStorage 持久化，默认张伟）；头像点击可切换
  const [currentUser, setCurrentUser] = useState(
    () => localStorage.getItem('oas-pm-user') ?? 'member-1',
  )
  const [lang, setLangState] = useState<Lang>(loadLang())
  const toggleLang = useCallback(() => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh'
    setLangState(next)
    setLang(next)
  }, [lang])
  const savedViews = useSavedViews()
  const saveViewNameRef = useRef<HTMLElement & { value?: string }>(null)
  const applySavedView = useCallback((filtersJson: string) => {
    try {
      const f = JSON.parse(filtersJson)
      setFilters((prev) => ({ ...prev, ...f, search: '' }))
    } catch {
      // 忽略损坏的视图数据
    }
  }, [])
  const switchUser = useCallback((id: string) => {
    setCurrentUser(id)
    localStorage.setItem('oas-pm-user', id)
  }, [])
  const [view, setView] = useState<View>('issues')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [grouping, setGrouping] = useState<Grouping>('none')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const aboutRef = useRef<HTMLElement>(null)
  const userPickRef = useRef<HTMLElement>(null)
  const notifyRef = useRef<HTMLElement>(null)
  const saveViewRef = useRef<HTMLElement>(null)
  const createRef = useRef<HTMLElement>(null)

  const doSaveView = useCallback(async () => {
    const name = (saveViewNameRef.current?.value ?? '').trim()
    if (!name) return
    const { search: _s, ...rest } = filters
    await saveView(name, rest)
    if (saveViewNameRef.current) saveViewNameRef.current.value = ''
    saveViewRef.current?.removeAttribute('visible')
  }, [filters])

  const issues = useIssueWindow(filters, currentUser)
  const counts = useProjectCounts(filters.projectId)
  const members = useMembers()
  const projects = useProjects()
  const memberCounts = useWindowAssigneeCounts(issues)
  const memberMap = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])
  const memberOptions = useMemo(
    () => [
      { label: '未分配', value: '__none__' },
      ...[...(members ?? [])].map((m) => ({ label: m.name, value: m.id })),
    ],
    [members],
  )

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
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oas-pm-issues-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [issues, memberMap])

  const [createStatus, setCreateStatus] = useState<IssueStatus>('todo')
  const [createPriority, setCreatePriority] = useState<IssuePriority>('medium')
  const [createAssignee, setCreateAssignee] = useState('__none__')
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
    const status = createStatus
    const priority = createPriority
    const assigneeId = createAssignee === '__none__' ? '' : createAssignee
    const projectId = filters.projectId
    // key 严格递增：事务内读改写项目计数器
    const keyNum = await db.transaction('rw', db.projects, async () => {
      const p = await db.projects.get(projectId)
      const n = p?.nextKeyNum ?? 100001
      await db.projects.update(projectId, { nextKeyNum: n + 1 })
      return n
    })
    const projectKey = projectsRef.current.find((p) => p.id === projectId)?.key ?? 'OAS'
    const newId = nanoid()
    await db.issues.add({
      id: newId,
      projectId,
      key: `${projectKey}-${keyNum}`,
      title,
      description: '',
      status,
      priority,
      assigneeId: assigneeId || null,
      reporterId: currentUser,
      labels: [],
      startAt: null,
      dueAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: Date.now(),
    })
    await logActivity(newId, currentUser, 'create')
    if (input) input.value = ''
    createRef.current?.removeAttribute('visible')
    // projectsRef 为 ref，不进 deps；projects 仅用于 ref 同步
  }, [filters.projectId])

  // projects 的 ref：createIssue 回调里读取最新项目 key
  const projectsRef = useRef<Project[]>([])
  useEffect(() => {
    projectsRef.current = projects ?? []
  }, [projects])

  // 快捷键：C 新建（输入框聚焦时跳过）/ 聚焦搜索 / Esc 关抽屉
  const searchRef = useRef<HTMLElement & { value?: string }>(null)
  useEffect(() => {
    const el = searchRef.current
    if (!el) return
    if (filters.search === (el.value ?? '')) return
    el.value = filters.search
  }, [filters.search])
  useEffect(() => {
    const el = searchRef.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value: string }>).detail?.value ?? ''
      setF('search', v)
    }
    el.addEventListener('oas-input', h)
    return () => el.removeEventListener('oas-input', h)
  }, [setF])
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
        <button
          className="tb-user"
          type="button"
          data-testid="tb-user"
          title="切换身份"
          onClick={() => userPickRef.current?.setAttribute('visible', '')}
        >
          <Avatar member={memberMap.get(currentUser)} size={22} />
          <span>{memberMap.get(currentUser)?.name ?? ''}</span>
        </button>
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
        <oas-input
          ref={searchRef}
          className="toolbar-search"
          data-testid="toolbar-search"
          placeholder="搜索 Key 或标题…（/）"
        />
        <span className="tb-spacer" />
        <button
          className="toolbar-btn"
          type="button"
          data-testid="lang-toggle"
          onClick={toggleLang}
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>
        <button
          className="toolbar-btn"
          type="button"
          data-testid="toolbar-notify"
          title="与我相关的最近动态"
          onClick={() => notifyRef.current?.setAttribute('visible', '')}
        >
          动态
          <NotificationBadge currentUser={currentUser} />
        </button>
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
          <div className="side-view-seg">
            <OSegmented
              testid="view-seg"
              value={view}
              options={[
                { label: t('dashboard'), value: 'dashboard' },
                { label: t('list'), value: 'issues' },
                { label: t('board'), value: 'board' },
                { label: t('timeline'), value: 'timeline' },
              ]}
              onChange={(v) => setView(v as View)}
            />
          </div>
          <p className="side-title">{t('projects')}</p>
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
          <p className="side-title">{t('views')}</p>
          <button
            className={`side-item${!filters.myOnly ? ' is-active' : ''}`}
            type="button"
            data-testid="view-all"
            onClick={() => setF('myOnly', false)}
          >
            <span>{t('allIssues')}</span>
          </button>
          <button
            className={`side-item${filters.myOnly ? ' is-active' : ''}`}
            type="button"
            data-testid="view-my"
            onClick={() => setF('myOnly', true)}
          >
            <span>我的（{memberMap.get(currentUser)?.name ?? ''}）</span>
          </button>
          <p className="side-title">{t('status')}</p>
          <button
            className={`side-item${filters.statusFilter === null ? ' is-active' : ''}`}
            type="button"
            data-testid="filter-all"
            onClick={() => setF('statusFilter', null)}
          >
            <span>{t('all')}</span>
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
          <p className="side-title">{t('savedViews')}</p>
          {(savedViews ?? []).map((v) => (
            <div key={v.id} className="side-item saved-view-item">
              <button
                className="side-item"
                type="button"
                data-testid={`saved-view-${v.id}`}
                onClick={() => applySavedView(v.filters)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span>{v.name}</span>
              </button>
              <button
                className="saved-view-del"
                type="button"
                aria-label={`删除视图 ${v.name}`}
                data-testid={`saved-view-del-${v.id}`}
                onClick={() => void db.savedViews.delete(v.id)}
              >
                ×
              </button>
            </div>
          ))}
          <p className="side-title">{t('members')}</p>
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
            <DashboardView
              projectId={filters.projectId}
              memberMap={memberMap}
              currentUser={currentUser}
            />
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
              onSaveView={() => saveViewRef.current?.setAttribute('visible', '')}
              currentUser={currentUser}
            />
          )}
          {view === 'board' && (
            <KanbanBoard issues={issues ?? []} memberMap={memberMap} onOpenIssue={setSelectedId} />
          )}
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
              <OSelect
                testid="create-status"
                value={createStatus}
                options={STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))}
                onChange={(v) => setCreateStatus(v as IssueStatus)}
              />
            </div>
            <div className="create-field">
              <label htmlFor="create-priority">优先级</label>
              <OSelect
                testid="create-priority"
                value={createPriority}
                options={ISSUE_PRIORITIES.map((p) => ({ label: p, value: p }))}
                onChange={(v) => setCreatePriority(v as IssuePriority)}
              />
            </div>
            <div className="create-field">
              <label htmlFor="create-assignee">负责人</label>
              <OSelect
                testid="create-assignee"
                value={createAssignee}
                options={memberOptions}
                onChange={setCreateAssignee}
              />
              {/* 状态/优先级同样受控 */}
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
          currentUser={currentUser}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* 保存视图 */}
      <oas-modal ref={saveViewRef} no-footer data-testid="modal-save-view">
        <div className="create-body">
          <div className="create-field">
            <label htmlFor="save-view-name">视图名称</label>
            <oas-input
              ref={saveViewNameRef}
              data-testid="save-view-name"
              placeholder="如：我的进行中"
            />
          </div>
          <div className="quit-actions">
            <oas-button
              data-testid="save-view-cancel"
              onClick={() => saveViewRef.current?.removeAttribute('visible')}
            >
              取消
            </oas-button>
            <oas-button type="primary" data-testid="save-view-ok" onClick={() => void doSaveView()}>
              保存
            </oas-button>
          </div>
        </div>
      </oas-modal>

      {/* 通知（与我相关的最近动态） */}
      <oas-modal ref={notifyRef} title="与我相关的最近动态" no-footer data-testid="modal-notify">
        <NotificationList
          currentUser={currentUser}
          onOpen={(issueId) => {
            notifyRef.current?.removeAttribute('visible')
            setSelectedId(issueId)
          }}
        />
      </oas-modal>

      {/* 身份切换 */}
      <oas-modal ref={userPickRef} title="切换身份" no-footer data-testid="modal-user">
        <div className="user-picker">
          {(members ?? []).map((m) => (
            <button
              key={m.id}
              className={`user-pick-item${m.id === currentUser ? ' is-current' : ''}`}
              type="button"
              data-testid={`pick-user-${m.id}`}
              onClick={() => {
                switchUser(m.id)
                userPickRef.current?.removeAttribute('visible')
              }}
            >
              <Avatar member={m} size={26} />
              <span>{m.name}</span>
              <span className="user-pick-role">{m.role}</span>
            </button>
          ))}
        </div>
      </oas-modal>

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
  currentUser,
}: {
  projectId: string
  memberMap: Map<string, Member>
  currentUser: string
}) {
  const counts = useProjectCounts(projectId)
  const topAssignees = useLiveQuery(async () => {
    const members = await db.members.toArray()
    const rows = await Promise.all(
      members.map(async (m) => ({
        label: m.name,
        value: await db.issues.where('[projectId+assigneeId]').equals([projectId, m.id]).count(),
      })),
    )
    return rows.sort((a, b) => b.value - a.value).slice(0, 6)
  }, [projectId])

  const statusData = STATUSES.map((s) => ({
    label: STATUS_LABEL[s],
    value: counts?.byStatus[s] ?? 0,
  }))

  // 近 30 天创建趋势（createdAt 索引范围取数，按天聚合）
  const trend = useLiveQuery(async () => {
    const day = 86400000
    const from = Date.now() - 30 * day
    const rows = await db.issues.where('createdAt').between(from, Date.now()).toArray()
    const byDay = new Map<string, number>()
    for (let i = 30; i >= 0; i--) {
      byDay.set(new Date(Date.now() - i * day).toISOString().slice(5, 10), 0)
    }
    for (const r of rows) {
      const k = new Date(r.createdAt).toISOString().slice(5, 10)
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1)
    }
    return [...byDay.entries()].map(([label, value]) => ({ label, value }))
  }, [projectId])

  return (
    <div className="dash-page" data-testid="dashboard">
      <h1 className="page-h1">仪表盘</h1>
      <div className="dash-cards">
        <oas-statistic className="dash-card" data-testid="stat-total" title="全部 Issue">
          <span slot="value">{counts?.total.toLocaleString() ?? '…'}</span>
        </oas-statistic>
        {(['todo', 'in_progress', 'done'] as IssueStatus[]).map((s) => (
          <oas-statistic
            key={s}
            className="dash-card"
            data-testid={`stat-${s}`}
            title={STATUS_LABEL[s]}
          >
            <span slot="value" style={{ color: STATUS_COLOR[s] }}>
              {(counts?.byStatus[s] ?? 0).toLocaleString()}
            </span>
          </oas-statistic>
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
      <div className="dash-chart-box" data-testid="trend-box">
        <p className="dash-chart-title">近 30 天创建趋势</p>
        <Chart type="area" data={trend ?? []} testid="chart-trend" label="创建与完成趋势图" />
      </div>
      <p className="dash-note" data-testid="dashboard-member-note">
        {memberMap.get(currentUser)?.name ?? ''} 的工作台 · 数据实时来自 IndexedDB
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
  onSaveView,
  currentUser,
}: {
  issues: Issue[]
  total: number
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  grouping: Grouping
  setGrouping: (g: Grouping) => void
  memberMap: Map<string, Member>
  onSelect: (id: string) => void
  onSaveView: () => void
  currentUser: string
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

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
      style={{
        display: 'grid',
        gridTemplateColumns: '18px 110px 1fr 24px 70px 90px',
        alignItems: 'center',
        gap: 12,
        height: 44,
        padding: '0 16px',
      }}
      onClick={() => onSelect(i.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(i.id)
      }}
    >
      <input
        type="checkbox"
        className="row-check"
        checked={selectedIds.has(i.id)}
        onClick={(e) => {
          e.stopPropagation()
          toggleSelect(i.id)
        }}
        readOnly
      />
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
        <span className="issue-toolbar-label">{t('sort')}</span>
        <OSelect
          testid="sort-by"
          value={filters.sortBy}
          options={[
            { label: '最近更新', value: 'updatedAt' },
            { label: '优先级', value: 'priority' },
            { label: '创建时间', value: 'createdAt' },
          ]}
          onChange={(v) => setFilters((prev) => ({ ...prev, sortBy: v as SortBy }))}
        />
        <span className="issue-toolbar-label">{t('group')}</span>
        <OSelect
          testid="group-by"
          value={grouping}
          options={[
            { label: '不分组', value: 'none' },
            { label: '按优先级', value: 'priority' },
            { label: '按负责人', value: 'assignee' },
          ]}
          onChange={(v) => setGrouping(v as Grouping)}
        />
        <span className="issue-toolbar-label">{t('priority')}</span>
        <OSelect
          testid="filter-priority"
          value={filters.priorityFilter ?? 'all'}
          options={[
            { label: '全部', value: 'all' },
            ...ISSUE_PRIORITIES.map((p) => ({ label: p, value: p })),
          ]}
          onChange={(v) =>
            setFilters((prev) => ({
              ...prev,
              priorityFilter: (v === 'all' ? null : v) as IssuePriority | null,
            }))
          }
        />
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
            {t('clearFilters')}
          </button>
        )}
        <button
          className="issue-toolbar-clear"
          type="button"
          data-testid="save-view-btn"
          onClick={onSaveView}
        >
          {t('saveView')}
        </button>
      </div>
      <div className="issue-thead">
        <span>{t('key')}</span>
        <span>{t('title')}</span>
        <span>{t('assignee')}</span>
        <span>{t('priority')}</span>
        <span>{t('status')}</span>
      </div>
      {groups ? (
        <div className="issue-scroll">
          {groups.map(([k, arr]) => (
            <div key={k} className="issue-group">
              <p className="issue-group-title">
                {k} <oas-badge>{String(arr.length)}</oas-badge>
              </p>
              {arr.slice(0, GROUP_PREVIEW).map(rowEl)}
              {arr.length > GROUP_PREVIEW && (
                <p className="board-col-more">组内还有 {arr.length - GROUP_PREVIEW} 条未显示</p>
              )}
            </div>
          ))}
          {groups.length === 0 && (
            <oas-empty description="无匹配 Issue" data-testid="issues-empty" />
          )}
        </div>
      ) : (
        <VirtualIssueList
          issues={issues}
          onSelect={onSelect}
          memberMap={memberMap}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
        />
      )}
      <BulkBar selectedIds={selectedIds} currentUser={currentUser} onDone={clearSelection} />
    </div>
  )
}

/** 列表行 → oas-virtual-list 的 oas-item 渲染通道。
 *  行在组件 shadow 内，light DOM 样式表不生效——布局/配色全部 inline。 */
const PRIORITY_TEXT: Record<IssuePriority, string> = {
  urgent: '#dc2626',
  high: '#d97706',
  medium: '#0b6cff',
  low: '#64748b',
}
const STATUS_TEXT: Record<IssueStatus, string> = {
  backlog: '#9aa3b8',
  todo: '#0b6cff',
  in_progress: '#d97706',
  done: '#059669',
  cancelled: '#dc2626',
}

/** 行样式注入所在 shadow root（每次渲染幂等）：light CSS 不穿透，inline grid 在该容器不稳 */
function ensureRowStyles(root: ShadowRoot | null): void {
  if (!root || root.querySelector('style[data-issue-row]')) return
  const st = document.createElement('style')
  st.setAttribute('data-issue-row', '')
  st.textContent = `
    .issue-row {
      display: grid;
      grid-template-columns: 22px 96px minmax(0, 1fr) 22px 64px 84px;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 16px;
      border-bottom: 1px solid #eef2f7;
      cursor: pointer;
      font-size: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .issue-row:hover {
      background: #f8fafc;
    }
    .issue-row .issue-key {
      color: #0b6cff;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .issue-row .issue-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .issue-row .avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
    }
    .issue-row .row-check {
      width: 14px;
      height: 14px;
      accent-color: #0b6cff;
      cursor: pointer;
    }
    .issue-row .issue-priority,
    .issue-row .issue-status {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `
  root.appendChild(st)
}

function renderIssueRow(
  element: HTMLElement,
  issue: Issue,
  memberMap: Map<string, Member>,
  onSelect: (id: string) => void,
  selectedIds: Set<string>,
  toggleSelect: (id: string) => void,
) {
  element.textContent = ''
  element.style.display = 'block'
  element.style.width = '100%'
  ensureRowStyles(element.getRootNode() as ShadowRoot)
  const row = document.createElement('div')
  row.className = 'issue-row'
  row.setAttribute('role', 'button')
  row.setAttribute('tabindex', '0')
  const add = (
    cls: string,
    text: string,
    opts: { color?: string; weight?: string; mono?: boolean } = {},
  ) => {
    const s = document.createElement('span')
    s.className = cls
    s.textContent = text
    if (opts.color) s.style.color = opts.color
    if (opts.mono) s.style.fontFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace'
    row.appendChild(s)
    return s
  }
  add('issue-key', issue.key)
  add('issue-title', issue.title)
  const m = memberMap.get(issue.assigneeId ?? '')
  const av = document.createElement('span')
  av.className = 'avatar'
  av.style.background = m?.avatarColor ?? '#cbd5e1'
  av.textContent = m ? m.name[0] : '?'
  if (m) av.title = m.name
  row.appendChild(av)
  add(`issue-priority pri-${issue.priority}`, issue.priority, {
    color: PRIORITY_TEXT[issue.priority],
  })
  add(`issue-status st-${issue.status}`, STATUS_LABEL[issue.status], {
    color: STATUS_TEXT[issue.status],
  })
  row.addEventListener('click', () => onSelect(issue.id))
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') onSelect(issue.id)
  })
  // 行首多选框：点击不触发行打开
  const check = document.createElement('input')
  check.type = 'checkbox'
  check.className = 'row-check'
  check.checked = selectedIds.has(issue.id)
  check.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleSelect(issue.id)
  })
  row.insertBefore(check, row.firstChild)
  element.appendChild(row)
}

function VirtualIssueList({
  issues,
  onSelect,
  memberMap,
  selectedIds,
  toggleSelect,
}: {
  issues: Issue[]
  onSelect: (id: string) => void
  memberMap: Map<string, Member>
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
}) {
  const listRef = useRef<HTMLElement>(null)
  const lastTopRef = useRef(0)
  // 稳定的渲染回调：避免 items 变化以外的原因重挂监听
  const renderRef = useRef({ onSelect, memberMap, selectedIds, toggleSelect })
  renderRef.current = { onSelect, memberMap, selectedIds, toggleSelect }

  // oas-item 渲染通道必须先于 items 挂上（effect 按声明序执行）：
  // 切回视图时数据即刻就位，items setter 同步渲染，通道缺席则列表永远空白
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    ;(el as unknown as { 'item-height'?: number })['item-height'] = 44
    const onItem = (e: Event) => {
      const d = (e as CustomEvent<{ index: number; item: unknown; element: HTMLElement }>).detail
      const issue = d.item as Issue
      renderIssueRow(
        d.element,
        issue,
        renderRef.current.memberMap,
        renderRef.current.onSelect,
        renderRef.current.selectedIds,
        renderRef.current.toggleSelect,
      )
    }
    el.addEventListener('oas-item', onItem)
    // 记录滚动位置：items 更新后 scrollToIndex 恢复视口用
    const onScroll = (e: Event) => {
      lastTopRef.current = (e as CustomEvent<{ scrollTop: number }>).detail?.scrollTop ?? 0
    }
    el.addEventListener('oas-scroll', onScroll)
    return () => {
      el.removeEventListener('oas-item', onItem)
      el.removeEventListener('oas-scroll', onScroll)
    }
  }, [])

  // 组件对「同长度 items 引用更新」不自动重派 oas-item（筛选/切换项目场景列表空白）：
  // items 落库后 scrollToIndex 重算窗口强制重渲染，oas-scroll 记录的视口位置得以保持
  useEffect(() => {
    const el = listRef.current as
      | (HTMLElement & {
          items?: unknown[]
          scrollToIndex?: (i: number, o?: { align?: string }) => void
        })
      | null
    if (!el) return
    el.items = issues
    el.scrollToIndex?.(Math.round(lastTopRef.current / 44), { align: 'start' })
  }, [issues])

  return (
    <oas-virtual-list
      ref={listRef}
      className="issue-scroll"
      data-testid="issue-vlist"
      style={{ flex: 1, minHeight: 0 }}
    />
  )
}

/* ── 活动历史（详情抽屉） ── */
function DrawerActivities({
  issueId,
  memberMap,
}: {
  issueId: string
  memberMap: Map<string, Member>
}) {
  const acts = useLiveQuery(
    () =>
      db.activities
        .where('[issueId+createdAt]')
        .between([issueId, Dexie.minKey], [issueId, Dexie.maxKey])
        .reverse()
        .toArray(),
    [issueId],
  )
  const TYPE_LABEL: Record<string, string> = {
    create: '创建了 Issue',
    status: '变更了状态',
    priority: '变更了优先级',
    assignee: '变更了负责人',
    labels: '更新了标签',
    description: '更新了描述',
    title: '更新了标题',
    dates: '调整了排期',
  }
  return (
    <div className="activities-block" data-testid="activities-block">
      <span>
        {t('activities')}（{acts?.length ?? 0}）
      </span>
      <div className="activities-list">
        {(acts ?? []).map((a) => (
          <div key={a.id} className="activity-item" data-testid="activity-item">
            <span className="activity-actor">{memberMap.get(a.actorId)?.name ?? '某人'}</span>
            <span className="activity-text">
              {TYPE_LABEL[a.type] ?? a.type}
              {a.field === '状态' && a.to ? ` → ${STATUS_LABEL[a.to as IssueStatus] ?? a.to}` : ''}
              {a.field && a.type !== 'status' && a.to ? ` → ${a.to}` : ''}
            </span>
            <span className="activity-time">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 评论区（详情抽屉，oas-comment + oas-input） ── */
function CommentsBlock({
  issueId,
  memberMap,
  currentUser,
}: {
  issueId: string
  memberMap: Map<string, Member>
  currentUser: string
}) {
  const comments = useLiveQuery(
    () =>
      db.comments
        .where('[issueId+createdAt]')
        .between([issueId, Dexie.minKey], [issueId, Dexie.maxKey])
        .toArray(),
    [issueId],
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLElement & { value?: string }>(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const submit = async () => {
    const body = (inputRef.current?.value ?? '').trim()
    if (!body) return
    await db.comments.add({
      id: nanoid(),
      issueId,
      authorId: currentUser,
      body,
      createdAt: Date.now(),
    })
    await logActivity(issueId, currentUser, 'comment')
    if (inputRef.current) inputRef.current.value = ''
  }

  /** @提及渲染：@中文/英文名 → 高亮 span（纯文本安全拆分） */
  const renderMentions = (body: string) => {
    const parts = body.split(/(@[\u4e00-\u9fa5a-zA-Z0-9]+)/g)
    return parts.map((seg, i) =>
      seg.startsWith('@') ? (
        <span key={i} style={{ color: '#0b6cff', fontWeight: 600 }}>
          {seg}
        </span>
      ) : (
        <span key={i}>{seg}</span>
      ),
    )
  }

  return (
    <div className="comments-block" data-testid="comments-block">
      <span>
        {t('comments')}（{comments?.length ?? 0}）
      </span>
      <div className="comments-list">
        {(comments ?? []).map((cm) => (
          <div key={cm.id} data-testid="comment-item" style={{ position: 'relative' }}>
            {editingId === cm.id ? (
              <div className="comment-edit-row">
                <oas-textarea
                  ref={editRef}
                  data-testid="comment-edit"
                  className="comment-input"
                  style={{ minHeight: 60 }}
                />
                <div className="quit-actions">
                  <oas-button
                    size="small"
                    data-testid="comment-cancel"
                    onClick={() => setEditingId(null)}
                  >
                    取消
                  </oas-button>
                  <oas-button
                    size="small"
                    type="primary"
                    data-testid="comment-save"
                    onClick={() => {
                      const v = editRef.current?.value ?? ''
                      if (v.trim()) {
                        void db.comments.update(cm.id, { body: v.trim() })
                        void logActivity(cm.issueId, currentUser, 'comment-edit')
                      }
                      setEditingId(null)
                    }}
                  >
                    保存
                  </oas-button>
                </div>
              </div>
            ) : (
              <oas-comment
                author={memberMap.get(cm.authorId)?.name ?? '匿名'}
                datetime={new Date(cm.createdAt).toLocaleString()}
              >
                <span slot="content">{renderMentions(cm.body)}</span>
                {cm.authorId === currentUser && (
                  <span slot="actions" className="comment-ops">
                    <button
                      type="button"
                      className="comment-op"
                      data-testid="comment-edit-btn"
                      onClick={() => {
                        setEditingId(cm.id)
                        setTimeout(() => {
                          if (editRef.current) editRef.current.value = cm.body
                        }, 50)
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="comment-op comment-op-del"
                      data-testid="comment-del"
                      onClick={() => void db.comments.delete(cm.id)}
                    >
                      删除
                    </button>
                  </span>
                )}
              </oas-comment>
            )}
          </div>
        ))}
      </div>
      <div className="comment-input-row">
        <input
          ref={inputRef}
          className="comment-input"
          data-testid="comment-input"
          placeholder={t('commentPlaceholder')}
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
          {t('send')}
        </button>
      </div>
    </div>
  )
}

/* ── Issue 详情抽屉（oas-drawer + OSelect + oas-textarea + oas-tag + popconfirm，即时保存） ── */
const RELATION_LABEL: Record<string, string> = {
  blocks: '阻塞',
  'blocked-by': '被阻塞',
  relates: '相关',
}
const LABELS = ['frontend', 'backend', 'design', 'bug', 'feature', 'tech-debt', 'docs', 'infra']

function IssueDetailDrawer({
  issueId,
  memberMap,
  currentUser,
  onClose,
}: {
  issueId: string
  memberMap: Map<string, Member>
  currentUser: string
  onClose: () => void
}) {
  const issue = useLiveQuery(() => db.issues.get(issueId), [issueId])
  const subs = useLiveQuery(() => db.issues.where('parentId').equals(issueId).toArray(), [issueId])
  const subInputRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const popRef = useRef<HTMLElement>(null)
  const [descDirty, setDescDirty] = useState(false)

  useEffect(() => {
    const el = drawerRef.current
    if (!el) return
    // 挂载即开（visible 属性；title 是 HTMLElement 全局 property，React 分派落不到 attribute）
    el.setAttribute('visible', '')
    el.setAttribute('title', issue ? issue.key : '')
  }, [issue?.id])
  useEffect(() => {
    drawerRef.current?.setAttribute('title', issue ? issue.key : '')
  }, [issue?.key])

  const addSub = useCallback(async () => {
    const title = (subInputRef.current?.value ?? '').trim()
    if (!title || !issue) return
    const newId = nanoid()
    await db.issues.add({
      id: newId,
      projectId: issue.projectId,
      key: `SUB-${Date.now().toString().slice(-6)}`,
      title,
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeId: issue.assigneeId,
      reporterId: currentUser,
      labels: [],
      startAt: null,
      dueAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: issue.order,
      parentId: issue.id,
    })
    if (subInputRef.current) subInputRef.current.value = ''
    await logActivity(newId, currentUser, 'create')
  }, [issue, currentUser])

  // 标签编辑（oas-dynamic-tags）：modelValue 双向同步 issue.labels
  const labelsTagsRef = useRef<HTMLElement & { modelValue?: string[]; value?: string[] }>(null)
  useEffect(() => {
    const el = labelsTagsRef.current
    if (!el) return
    el.modelValue = issue?.labels ?? []
  }, [issue?.labels, issueId])
  useEffect(() => {
    const el = labelsTagsRef.current
    if (!el) return
    const h = (e: Event) => {
      const v = (e as CustomEvent<{ value?: string[] }>).detail?.value
      if (Array.isArray(v)) save({ labels: v })
    }
    el.addEventListener('oas-change', h)
    return () => el.removeEventListener('oas-change', h)
  }, [issueId])

  // 描述编辑态在切换 issue 时重置；textarea value 跟随 issue.description
  const descRefValue = useRef<HTMLElement & { value?: string }>(null)
  useEffect(() => {
    setDescDirty(false)
    if (descRefValue.current) descRefValue.current.value = issue?.description ?? ''
  }, [issueId, issue?.description])
  useEffect(() => {
    const el = descRefValue.current
    if (!el) return
    // 组件输入事件名不透明：轮询值对比驱动 dirty（500ms，编辑场景足够）
    const t = setInterval(() => {
      const cur = descRefValue.current?.value ?? ''
      setDescDirty(cur !== (issue?.description ?? ''))
    }, 500)
    return () => clearInterval(t)
  }, [issueId, issue?.description])
  // popconfirm 确认（reason='ok'）→ 删除并关抽屉
  useEffect(() => {
    const el = popRef.current
    if (!el) return
    const h = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason
      if (reason === 'ok') void db.issues.delete(issueId).then(onClose)
    }
    el.addEventListener('oas-open-change', h)
    return () => el.removeEventListener('oas-open-change', h)
  }, [issueId, onClose])

  // 关联选择 state：必须在早退之前（hooks 顺序恒定）
  const [relType, setRelType] = useState('__none__')
  const relCandidates = useLiveQuery(
    () =>
      db.issues
        .where('projectId')
        .equals(issue?.projectId ?? '')
        .limit(100)
        .toArray(),
    [issueId],
  )

  if (!issue) return <oas-drawer ref={drawerRef} />

  const relationTarget = (id: string) => relCandidates?.find((x) => x.id === id)
  const save = (changes: Partial<Issue>) => {
    const FIELD_LABEL: Partial<Record<keyof Issue, string>> = {
      status: '状态',
      priority: '优先级',
      assigneeId: '负责人',
      description: '描述',
      title: '标题',
    }
    const acts: Promise<unknown>[] = []
    for (const k of Object.keys(changes) as Array<keyof Issue>) {
      if (k === 'updatedAt' || !(k in FIELD_LABEL)) continue
      const to = String(changes[k] ?? '')
      const from = String(issue[k] ?? '')
      if (from === to) continue
      acts.push(
        logActivity(issue.id, currentUser, k as string, { field: FIELD_LABEL[k], from, to }),
      )
      if (k === 'status') changes.completedAt = to === 'done' ? Date.now() : null
    }
    Promise.all(acts)
      .then(() => db.issues.update(issue.id, changes))
      .catch((e) => console.error('[save acts]', (e as Error)?.message ?? e))
  }
  const memberOptions = [
    { label: '未分配', value: '__none__' },
    ...[...memberMap.values()].map((m) => ({ label: m.name, value: m.id })),
  ]

  return (
    <oas-drawer ref={drawerRef} no-footer data-testid="detail-drawer">
      <div className="detail-body">
        <h2 className="detail-title">{issue.title}</h2>
        <div className="detail-meta">
          <div className="detail-field">
            <span>状态</span>
            <OSelect
              testid="detail-status"
              value={issue.status}
              options={STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))}
              onChange={(v) => save({ status: v as IssueStatus })}
            />
          </div>
          <div className="detail-field">
            <span>优先级</span>
            <OSelect
              testid="detail-priority"
              value={issue.priority}
              options={ISSUE_PRIORITIES.map((p) => ({ label: p, value: p }))}
              onChange={(v) => save({ priority: v as IssuePriority })}
            />
          </div>
          <div className="detail-field">
            <span>负责人</span>
            <OSelect
              testid="detail-assignee"
              value={issue.assigneeId ?? '__none__'}
              options={memberOptions}
              onChange={(v) => save({ assigneeId: v === '__none__' ? null : v })}
            />
          </div>
        </div>
        <div className="detail-subs-block">
          <span>
            {t('subtasks')}（{subs?.length ?? 0}）
          </span>
          <div className="subs-list">
            {(subs ?? []).map((s) => (
              <div key={s.id} className="sub-item" data-testid="sub-item">
                <input
                  type="checkbox"
                  className="row-check"
                  checked={s.status === 'done'}
                  onClick={(e) => {
                    e.stopPropagation()
                    const done = s.status === 'done'
                    void db.issues.update(s.id, {
                      status: done ? 'todo' : 'done',
                      completedAt: done ? null : Date.now(),
                      updatedAt: Date.now(),
                    })
                    void logActivity(s.id, currentUser, 'status', {
                      field: '状态',
                      to: done ? 'todo' : 'done',
                    })
                  }}
                  readOnly
                />
                <span
                  className={`issue-title${s.status === 'done' ? ' sub-done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.key} {s.title}
                </span>
                <oas-tag size="small" type={s.status === 'done' ? 'success' : 'info'}>
                  {STATUS_LABEL[s.status]}
                </oas-tag>
              </div>
            ))}
          </div>
          <div className="sub-add-row">
            <input
              ref={subInputRef}
              className="comment-input"
              data-testid="sub-add-input"
              placeholder="新子任务标题…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addSub()
              }}
            />
            <oas-button size="small" data-testid="sub-add" onClick={() => void addSub()}>
              添加
            </oas-button>
          </div>
        </div>
        <div className="detail-desc-block">
          <span>{t('description')}</span>
          <oas-textarea
            ref={descRefValue}
            data-testid="detail-desc"
            placeholder="Description…"
            className="detail-textarea"
          />
          {descDirty && (
            <button
              className="detail-save-desc"
              type="button"
              data-testid="detail-desc-save"
              onClick={() => {
                save({ description: descRefValue.current?.value ?? '' })
                setDescDirty(false)
              }}
            >
              保存描述
            </button>
          )}
        </div>
        <div className="detail-relations-block">
          <span>{t('relations')}</span>
          <div className="detail-labels">
            {(issue.relations ?? []).map((r, i) => {
              const target = relationTarget(r.targetId)
              return (
                <TagChip
                  key={`${r.type}-${r.targetId}`}
                  label={`${RELATION_LABEL[r.type] ?? r.type} ${target?.key ?? r.targetId.slice(0, 10)}`}
                  testid={`relation-chip-${i}`}
                  onRemove={() => {
                    const next = (issue.relations ?? []).filter((_, j) => j !== i)
                    save({ relations: next })
                    void logActivity(issue.id, currentUser, 'relations', {
                      field: '关联',
                      to: `${r.type} ${target?.key ?? r.targetId}`,
                    })
                  }}
                />
              )
            })}
            <OSelect
              testid="relation-add-type"
              value={relType}
              options={[
                { label: '关联…', value: '__none__' },
                { label: 'blocks（阻塞）', value: 'blocks' },
                { label: 'blocked-by（被阻塞）', value: 'blocked-by' },
                { label: 'relates（相关）', value: 'relates' },
              ]}
              onChange={setRelType}
            />
            {relType !== '__none__' && (
              <OSelect
                testid="relation-add-target"
                value="__none__"
                options={[
                  { label: '选择 Issue…', value: '__none__' },
                  ...(relCandidates ?? []).map((x) => ({
                    label: `${x.key} ${x.title.slice(0, 14)}`,
                    value: x.id,
                  })),
                ]}
                onChange={(tid) => {
                  if (tid === '__none__') return
                  const next = [
                    ...(issue.relations ?? []),
                    { type: relType as 'blocks', targetId: tid },
                  ]
                  save({ relations: next })
                  setRelType('__none__')
                  void logActivity(issue.id, currentUser, 'relations', {
                    field: '关联',
                    to: `${relType} ${tid}`,
                  })
                }}
              />
            )}
          </div>
        </div>
        <div className="detail-labels-block">
          <span>{t('labels')}</span>
          <div className="detail-labels">
            {issue.labels.map((l) => (
              <TagChip
                key={l}
                label={l}
                testid={`label-chip-${l}`}
                onRemove={() => save({ labels: issue.labels.filter((x) => x !== l) })}
              />
            ))}
            <OSelect
              testid="label-add"
              value="__none__"
              options={[
                { label: '＋ 标签…', value: '__none__' },
                ...LABELS.filter((l) => !issue.labels.includes(l)).map((l) => ({
                  label: l,
                  value: l,
                })),
              ]}
              onChange={(l) => {
                if (l && !issue.labels.includes(l)) save({ labels: [...issue.labels, l] })
              }}
            />
          </div>
        </div>
        <CommentsBlock issueId={issue.id} memberMap={memberMap} currentUser={currentUser} />
        <DrawerActivities issueId={issue.id} memberMap={memberMap} />
        <div className="detail-foot">
          <span className="detail-dates">
            创建 {new Date(issue.createdAt).toLocaleDateString()} · 更新{' '}
            {new Date(issue.updatedAt).toLocaleString()}
          </span>
          <oas-popconfirm ref={popRef} title="删除后不可恢复，确认？" data-testid="detail-delete">
            <oas-button slot="trigger" type="danger" data-testid="detail-delete-btn">
              删除
            </oas-button>
          </oas-popconfirm>
        </div>
      </div>
    </oas-drawer>
  )
}

/* ── 看板（oas-kanban：拖拽/多选/键盘/触屏全部组件库内建） ── */
interface KanbanElement extends HTMLElement {
  columns?: unknown
  cards?: Array<Record<string, unknown>>
  renderCard?: ((card: Record<string, unknown>) => Node | string) | null
}

function KanbanBoard({
  issues,
  memberMap,
  onOpenIssue,
}: {
  issues: Issue[]
  memberMap: Map<string, Member>
  onOpenIssue: (id: string) => void
}) {
  const boardRef = useRef<KanbanElement>(null)
  const onOpenIssueRef = useRef(onOpenIssue)
  onOpenIssueRef.current = onOpenIssue

  const columns = useMemo(() => STATUSES.map((s) => ({ key: s, title: STATUS_LABEL[s] })), [])

  // 列内显示顺序 = cards 数组序：按 order 升序铺入
  const cards = useMemo(
    () =>
      [...issues]
        .sort((a, b) => a.order - b.order)
        .map((i) => ({
          id: i.id,
          column: i.status,
          title: i.title,
          order: i.order,
          key: i.key,
          priority: i.priority,
          assigneeId: i.assigneeId ?? '',
        })),
    [issues],
  )

  // renderCard/数据走 property 通道；拖放后组件内存持有，宿主经 oas-change 落库
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    el.columns = columns
    el.cards = cards
    el.renderCard = (card) => {
      const wrap = document.createElement('div')
      wrap.className = 'kb-card'
      wrap.style.cursor = 'pointer'
      wrap.addEventListener('click', (e) => {
        e.stopPropagation()
        onOpenIssueRef.current(String(card.id ?? ''))
      })
      const top = document.createElement('div')
      top.className = 'board-card-top'
      const k = document.createElement('span')
      k.className = 'board-card-key'
      k.textContent = String(card.key ?? '')
      top.appendChild(k)
      const m = memberMap.get(String(card.assigneeId ?? ''))
      const av = document.createElement('span')
      if (m) {
        av.className = 'avatar'
        av.style.background = m.avatarColor
        av.textContent = m.name[0]
      } else {
        av.className = 'avatar avatar-empty'
        av.textContent = '?'
      }
      top.appendChild(av)
      const t = document.createElement('p')
      t.className = 'board-card-title'
      t.textContent = String(card.title ?? '')
      const pr = document.createElement('span')
      pr.className = `issue-priority pri-${String(card.priority ?? '')}`
      pr.textContent = String(card.priority ?? '')
      wrap.append(top, t, pr)
      return wrap
    }
  }, [columns, cards, memberMap])

  // oas-change（from/to/index/ids）→ 落点前后卡 order 取中值落库（status 变更/列内排序统一）
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const onChange = (e: Event) => {
      const d = (
        e as CustomEvent<{
          id: string
          from: string
          to: string
          index: number
          ids?: string[]
        }>
      ).detail
      if (!d?.id || !d.to) return
      const to = d.to as IssueStatus
      const ids = d.ids ?? [d.id]
      const colCards = (el.cards ?? []).filter((c) => c.column === to)
      const moving = colCards.filter((c) => ids.includes(String(c.id)))
      const rest = colCards.filter((c) => !ids.includes(String(c.id)))
      const finalArr = [...rest]
      finalArr.splice(Math.min(d.index, finalArr.length), 0, ...moving)
      void db.transaction('rw', db.issues, async () => {
        const now = Date.now()
        for (const iid of ids) {
          const pos = finalArr.findIndex((c) => String(c.id) === iid)
          const prevOrder = pos > 0 ? (finalArr[pos - 1].order as number) : undefined
          const nextOrder =
            pos < finalArr.length - 1 ? (finalArr[pos + 1].order as number) : undefined
          await db.issues.update(iid, {
            status: to,
            order: betweenOrder(prevOrder, nextOrder),
            updatedAt: now,
          })
        }
      })
    }
    el.addEventListener('oas-change', onChange)
    return () => el.removeEventListener('oas-change', onChange)
  }, [])

  return (
    <div className="board">
      <oas-kanban ref={boardRef} data-testid="board" />
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
      <oas-gantt
        ref={ganttRef}
        data-testid="gantt"
        style={{ width: '100%', flex: 1, minHeight: 420 }}
      />
    </div>
  )
}
