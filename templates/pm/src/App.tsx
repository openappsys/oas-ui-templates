import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Issue, IssuePriority, IssueStatus, Member, Project } from './types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES, STATUS_LABEL } from './types'
import { OSelect, OTabs } from './components/oas-wrappers'
import { t, loadLang, setLang, type Lang } from './i18n'
import { useSavedViews } from './components/BulkBar'
import { STATUS_COLOR } from './lib/colors'
import { DEFAULT_FILTERS, type Filters, type Grouping } from './lib/filters'
import { useProjectCounts } from './lib/hooks'
import { loadTheme, storeTheme, type ThemePreference } from './lib/preferences'
import { applyTheme } from './lib/theme'
import { isOverlayOpen, registerKey } from './lib/keyboard'
import { useRepositories } from './data/context'
import { useObservable } from './data/use-observable'
import { can as policyCan, type Action, type Ctx } from './permission/policy'
import { Avatar } from './components/Avatar'
import { SideList, type SideRow } from './components/SideList'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { CommandPalette } from './components/CommandPalette'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardView } from './views/dashboard/DashboardView'
import { IssueListView } from './views/list/IssueListView'
import { KanbanBoard } from './views/board/KanbanBoard'
import { TimelineView } from './views/timeline/TimelineView'
import { ResourceView } from './views/resource/ResourceView'
import { IssueDetailDrawer } from './views/issue/IssueDetailDrawer'
import { AdminView, type AdminTab } from './views/admin/AdminView'

type View = 'dashboard' | 'issues' | 'board' | 'timeline' | 'resource' | 'admin'

/** 数据窗口：compound index 取项目/状态维度最近 LIST_WINDOW 条，再内存细筛 */
function useIssueWindow(f: Filters, currentUser: string) {
  const { issues } = useRepositories()
  return useObservable(
    () =>
      issues.liveWindow(
        {
          projectId: f.projectId,
          statusFilter: f.statusFilter,
          assigneeFilter: f.assigneeFilter,
          priorityFilter: f.priorityFilter,
          search: f.search,
          myOnly: f.myOnly,
          sortBy: f.sortBy,
        },
        currentUser,
      ),
    [
      f.projectId,
      f.statusFilter,
      f.assigneeFilter,
      f.priorityFilter,
      f.search,
      f.myOnly,
      f.sortBy,
      currentUser,
    ],
  )
}

function useMembers(): Member[] | undefined {
  const { members } = useRepositories()
  return useObservable(() => members.liveAll(), [members])
}

function useProjects(): Project[] | undefined {
  const { projects } = useRepositories()
  return useObservable(() => projects.liveAll(), [projects])
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
  const { issues: issuesRepo, activities: activitiesRepo } = useRepositories()
  const acts = useObservable(() => activitiesRepo.liveRecent(300), [activitiesRepo])
  const [list, setList] =
    useState<
      Array<{ id: string; actorId: string; text: string; issueId: string; createdAt: number }>
    >()
  useEffect(() => {
    if (!acts) return
    let alive = true
    const mine = acts.filter((a) => a.actorId !== currentUser)
    // bulkGet 一次取齐（逐条 get 300 次会拖慢首屏渲染）
    issuesRepo
      .bulkGet(mine.map((a) => a.issueId))
      .then((issues) => {
        if (!alive) return
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
        setList(out)
      })
      .catch((e) => console.error('[useMyNotifications]', (e as Error)?.message ?? e))
    return () => {
      alive = false
    }
  }, [acts, currentUser, issuesRepo])
  return list
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
  const {
    issues: issuesRepo,
    activities: activitiesRepo,
    savedViews: savedViewsRepo,
  } = useRepositories()
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
  const [themePref, setThemePref] = useState<ThemePreference>(loadTheme())
  const applyThemeAndStore = useCallback((next: ThemePreference) => {
    setThemePref(next)
    storeTheme(next)
    applyTheme(next)
  }, [])
  const cycleTheme = useCallback(() => {
    const next: ThemePreference =
      themePref === 'light' ? 'dark' : themePref === 'dark' ? 'system' : 'light'
    applyThemeAndStore(next)
  }, [themePref, applyThemeAndStore])
  const setLangAndApply = useCallback((next: Lang) => {
    setLangState(next)
    setLang(next)
  }, [])
  const themeLabel =
    themePref === 'light'
      ? t('themeLight')
      : themePref === 'dark'
        ? t('themeDark')
        : t('themeSystem')
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
  const [adminTab, setAdminTab] = useState<AdminTab>('overview')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [grouping, setGrouping] = useState<Grouping>('none')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const aboutRef = useRef<HTMLElement>(null)
  const userPickRef = useRef<HTMLElement>(null)
  const notifyRef = useRef<HTMLElement>(null)
  const saveViewRef = useRef<HTMLElement>(null)
  const createRef = useRef<HTMLElement>(null)

  const doSaveView = useCallback(async () => {
    const name = (saveViewNameRef.current?.value ?? '').trim()
    if (!name) return
    const { search: _s, ...rest } = filters
    await savedViewsRepo.create(name, rest)
    if (saveViewNameRef.current) saveViewNameRef.current.value = ''
    saveViewRef.current?.removeAttribute('visible')
  }, [filters, savedViewsRepo])

  const issues = useIssueWindow(filters, currentUser)
  const counts = useProjectCounts(filters.projectId)
  const members = useMembers()
  const projects = useProjects()
  const memberCounts = useWindowAssigneeCounts(issues)
  const memberMap = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])
  const can = useCallback(
    (action: Action, ctx?: Ctx) =>
      policyCan(
        {
          id: currentUser,
          role: members?.find((m) => m.id === currentUser)?.role ?? 'viewer',
        },
        action,
        ctx,
      ),
    [currentUser, members],
  )
  const canCreateIssue = can('issue:create')
  const canManage = can('project:manage')
  useEffect(() => {
    if (view === 'admin' && !canManage) setView('issues')
  }, [view, canManage])
  const openProject = useCallback((projectId: string) => {
    setFilters((prev) => ({ ...prev, projectId, statusFilter: null }))
    setView('issues')
  }, [])
  const handleMemberDeleted = useCallback(
    (id: string) => {
      if (id !== currentUser) return
      const next = (members ?? []).find((m) => m.role === 'admin' && m.id !== id)
      switchUser(next?.id ?? 'member-1')
    },
    [currentUser, members, switchUser],
  )
  const canCreateRef = useRef(canCreateIssue)
  canCreateRef.current = canCreateIssue
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

  const canDeleteView = can('view:delete')
  const sideRows: SideRow[] = []
  for (const p of projects ?? []) {
    sideRows.push({
      group: t('projects'),
      kind: 'project',
      value: `project:${p.id}`,
      id: p.id,
      testid: `project-${p.id}`,
      label: p.name,
      active: filters.projectId === p.id,
    })
  }
  sideRows.push(
    {
      group: t('views'),
      kind: 'view',
      value: 'view:all',
      id: 'all',
      testid: 'view-all',
      label: t('allIssues'),
      active: !filters.myOnly,
    },
    {
      group: t('views'),
      kind: 'view',
      value: 'view:my',
      id: 'my',
      testid: 'view-my',
      label: `我的（${memberMap.get(currentUser)?.name ?? ''}）`,
      active: filters.myOnly,
    },
    {
      group: t('status'),
      kind: 'status',
      value: 'status:all',
      id: 'all',
      testid: 'filter-all',
      label: t('all'),
      active: filters.statusFilter === null,
      count: counts?.total.toLocaleString() ?? '…',
    },
  )
  for (const s of ISSUE_STATUSES) {
    sideRows.push({
      group: t('status'),
      kind: 'status',
      value: `status:${s}`,
      id: s,
      testid: `filter-${s}`,
      label: STATUS_LABEL[s],
      active: filters.statusFilter === s,
      statusColor: STATUS_COLOR[s],
      count: counts?.byStatus[s]?.toLocaleString() ?? '…',
    })
  }
  for (const v of savedViews ?? []) {
    sideRows.push({
      group: t('savedViews'),
      kind: 'savedview',
      value: `savedview:${v.id}`,
      id: v.id,
      testid: `saved-view-${v.id}`,
      label: v.name,
      savedFilters: v.filters,
      deletable: canDeleteView,
    })
  }
  for (const m of members ?? []) {
    sideRows.push({
      group: t('members'),
      kind: 'member',
      value: `member:${m.id}`,
      id: m.id,
      testid: `member-${m.id}`,
      label: m.name,
      active: filters.assigneeFilter === m.id,
      avatarColor: m.avatarColor,
      avatarText: m.name[0],
      count: String(memberCounts.get(m.id) ?? 0),
    })
  }

  const handleSideRowClick = useCallback(
    (row: SideRow) => {
      switch (row.kind) {
        case 'project':
          setFilters((prev) => ({ ...prev, projectId: row.id ?? '', statusFilter: null }))
          break
        case 'view':
          setF('myOnly', row.id === 'my')
          break
        case 'status':
          setF('statusFilter', row.id === 'all' ? null : (row.id as IssueStatus))
          break
        case 'savedview':
          if (row.savedFilters) applySavedView(row.savedFilters)
          break
        case 'member': {
          const memberId = row.id
          if (!memberId) break
          setFilters((prev) => ({
            ...prev,
            assigneeFilter: prev.assigneeFilter === memberId ? null : memberId,
          }))
          break
        }
      }
    },
    [setF, applySavedView],
  )

  const handleDeleteSavedView = useCallback(
    (id: string) => {
      void savedViewsRepo.delete(id)
    },
    [savedViewsRepo],
  )

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
    const created = await issuesRepo.create({
      projectId,
      title,
      status,
      priority,
      assigneeId: assigneeId || null,
      reporterId: currentUser,
    })
    await activitiesRepo.log({ issueId: created.id, actorId: currentUser, type: 'create' })
    if (input) input.value = ''
    createRef.current?.removeAttribute('visible')
  }, [
    filters.projectId,
    currentUser,
    createStatus,
    createPriority,
    createAssignee,
    issuesRepo,
    activitiesRepo,
  ])

  // 快捷键：C 新建（输入框聚焦时跳过）/ 聚焦搜索 / Esc 关抽屉 / ? 帮助
  const searchRef = useRef<HTMLElement & { value?: string }>(null)
  const [helpOpen, setHelpOpen] = useState(false)
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
    // Esc 无论焦点在哪都关抽屉（含评论输入框内）
    const openCreate = (e: KeyboardEvent) => {
      e.preventDefault()
      createRef.current?.setAttribute('visible', '')
    }
    const whenCreate = () => canCreateRef.current
    const whenNoOverlay = () => !isOverlayOpen()
    const unsubs = [
      registerKey('Escape', () => setSelectedId(null)),
      registerKey(
        'k',
        (e) => {
          e.preventDefault()
          setPaletteOpen((v) => !v)
        },
        undefined,
        { mod: true },
      ),
      registerKey('c', openCreate, whenCreate),
      registerKey('C', openCreate, whenCreate),
      registerKey('/', (e) => {
        e.preventDefault()
        searchRef.current?.focus()
      }),
      registerKey('?', () => setHelpOpen(true), whenNoOverlay),
    ]
    return () => {
      for (const u of unsubs) u()
    }
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
        {canManage && (
          <oas-button
            type="text"
            size="small"
            data-testid="admin-entry"
            onClick={() => setView('admin')}
          >
            <oas-icon name="gear" size={14} />
            {t('adminEntry')}
          </oas-button>
        )}
        {canCreateIssue && (
          <oas-button
            type="primary"
            data-testid="toolbar-new"
            onClick={() => createRef.current?.setAttribute('visible', '')}
          >
            ＋ 新建 Issue
          </oas-button>
        )}
        <oas-button type="text" size="small" data-testid="toolbar-export" onClick={exportCsv}>
          导出 CSV（当前窗口）
        </oas-button>
        <oas-button
          type="text"
          size="small"
          data-testid="command-open"
          title={t('shortcutPalette')}
          onClick={() => setPaletteOpen(true)}
        >
          <oas-icon name="search" size={14} />
        </oas-button>
        <oas-input
          ref={searchRef}
          className="toolbar-search"
          data-testid="toolbar-search"
          placeholder="搜索 Key 或标题…（/）"
        />
        <span className="tb-spacer" />
        <oas-button
          type="text"
          size="small"
          data-testid="theme-toggle"
          title={themeLabel}
          onClick={cycleTheme}
        >
          {themeLabel}
        </oas-button>
        <oas-button type="text" size="small" data-testid="lang-toggle" onClick={toggleLang}>
          {lang === 'zh' ? 'EN' : '中'}
        </oas-button>
        <oas-button
          type="text"
          size="small"
          data-testid="toolbar-notify"
          title="与我相关的最近动态"
          onClick={() => notifyRef.current?.setAttribute('visible', '')}
        >
          动态
          <NotificationBadge currentUser={currentUser} />
        </oas-button>
        <oas-button
          type="text"
          size="small"
          data-testid="toolbar-about"
          onClick={() => aboutRef.current?.setAttribute('visible', '')}
        >
          关于
        </oas-button>
      </header>
      <div className="main">
        {view === 'admin' ? (
          <AdminView
            tab={adminTab}
            onTab={setAdminTab}
            onBack={() => setView('issues')}
            memberMap={memberMap}
            onOpenProject={openProject}
            currentUser={currentUser}
            onMemberDeleted={handleMemberDeleted}
            themePref={themePref}
            onSetTheme={applyThemeAndStore}
            lang={lang}
            onSetLang={setLangAndApply}
          />
        ) : (
          <>
            <aside className="side-panel" data-testid="side-panel">
              <div className="side-view-seg">
                <OTabs
                  testid="view-seg"
                  value={view}
                  options={[
                    { label: t('dashboard'), value: 'dashboard' },
                    { label: t('list'), value: 'issues' },
                    { label: t('board'), value: 'board' },
                    { label: t('timeline'), value: 'timeline' },
                    { label: t('resource'), value: 'resource' },
                  ]}
                  onChange={(v) => setView(v as View)}
                />
              </div>
              <SideList
                rows={sideRows}
                onRowClick={handleSideRowClick}
                onDeleteSavedView={handleDeleteSavedView}
              />
            </aside>
            <main className="content">
              {view === 'dashboard' && (
                <ErrorBoundary key={view}>
                  <DashboardView
                    projectId={filters.projectId}
                    memberMap={memberMap}
                    currentUser={currentUser}
                  />
                </ErrorBoundary>
              )}
              {view === 'issues' && (
                <ErrorBoundary key={view}>
                  <IssueListView
                    issues={issues}
                    total={counts?.total ?? issues?.length ?? 0}
                    filters={filters}
                    setFilters={setFilters}
                    grouping={grouping}
                    setGrouping={setGrouping}
                    memberMap={memberMap}
                    onSelect={setSelectedId}
                    onSaveView={() => saveViewRef.current?.setAttribute('visible', '')}
                    currentUser={currentUser}
                    can={can}
                    navActive={view === 'issues' && selectedId === null}
                  />
                </ErrorBoundary>
              )}
              {view === 'board' && (
                <ErrorBoundary key={view}>
                  <KanbanBoard
                    issues={issues ?? []}
                    memberMap={memberMap}
                    onOpenIssue={setSelectedId}
                    can={can}
                  />
                </ErrorBoundary>
              )}
              {view === 'timeline' && (
                <ErrorBoundary key={view}>
                  <TimelineView issues={issues ?? []} can={can} />
                </ErrorBoundary>
              )}
              {view === 'resource' && (
                <ErrorBoundary key={view}>
                  <ResourceView issues={issues ?? []} can={can} onOpenIssue={setSelectedId} />
                </ErrorBoundary>
              )}
            </main>
          </>
        )}
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
                options={ISSUE_STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))}
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
          can={can}
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

      {/* 命令面板 */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        can={can}
        onView={(v) => setView(v)}
        onNewIssue={() => createRef.current?.setAttribute('visible', '')}
        onExportCsv={exportCsv}
        onSaveView={() => saveViewRef.current?.setAttribute('visible', '')}
        onToggleTheme={cycleTheme}
        onToggleLang={toggleLang}
        onShortcuts={() => setHelpOpen(true)}
        onSwitchUser={switchUser}
        onOpenIssue={setSelectedId}
        lang={lang}
      />

      {/* 快捷键帮助 */}
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

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
