import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Dexie from 'dexie'
import { nanoid } from 'nanoid'
import { db } from './db/schema'
import type { Issue, IssuePriority, IssueStatus, Member, Project } from './types'
import { ISSUE_PRIORITIES, STATUS_LABEL } from './types'
import { OSelect, OSegmented } from './components/oas-wrappers'
import { t, loadLang, storeLang, setLang, type Lang, type DictKey } from './i18n'
import { useSavedViews, saveView } from './components/BulkBar'
import { STATUS_COLOR } from './lib/colors'
import { PRIORITY_WEIGHT } from './lib/order'
import { DEFAULT_FILTERS, LIST_WINDOW, type Filters, type Grouping } from './lib/filters'
import { logActivity } from './lib/activity'
import { useProjectCounts } from './lib/hooks'
import { Avatar } from './components/Avatar'
import { DashboardView } from './views/dashboard/DashboardView'
import { IssueListView } from './views/list/IssueListView'
import { KanbanBoard } from './views/board/KanbanBoard'
import { TimelineView } from './views/timeline/TimelineView'
import { IssueDetailDrawer } from './views/issue/IssueDetailDrawer'

const STATUSES: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled']

type View = 'dashboard' | 'issues' | 'board' | 'timeline'

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
