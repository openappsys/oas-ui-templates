import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Cycle, IssuePriority, IssueStatus, Member, Project } from './types'
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from './types'
import { OMultiSelect, OSelect, OSegmented, OTabs } from './components/oas-wrappers'
import { FilterBar } from './components/FilterBar'
import { t, loadLang, setLang, statusLabel, priorityLabel, type Lang } from './i18n'
import { useSavedViews } from './components/BulkBar'
import { PRIORITY_TEXT, STATUS_COLOR } from './lib/colors'
import { buildAssigneeOptions } from './lib/assignee-options'
import { CYCLE_SIDEBAR_LIMIT, CURRENT_CYCLE, NO_CYCLE, currentCycleIds } from './lib/cycles'
import {
  ALL_PROJECTS,
  DEFAULT_FILTERS,
  LIST_WINDOW,
  LIST_WINDOW_STEP,
  parseFilters,
  toggleIn,
  UNASSIGNED,
  type Filters,
  type Grouping,
} from './lib/filters'
import { useProjectCounts } from './lib/hooks'
import {
  loadFilterPlacement,
  loadTheme,
  showsSidebarFilters,
  showsTopbarFilters,
  storeFilterPlacement,
  storeTheme,
  type FilterPlacement,
  type ThemePreference,
} from './lib/preferences'
import { applyTheme } from './lib/theme'
import { isOverlayOpen, registerKey } from './lib/keyboard'
import { useRepositories } from './data/context'
import { useObservable, useObservableState } from './data/use-observable'
import { activeDataSource, storeDataSource } from './data/source'
import { fetchMe, logout as logoutSession, type LoginResult } from './data/api/auth'
import { getToken, onApiError, onSessionExpired } from './data/api/session'
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
import { ScheduleView } from './views/schedule/ScheduleView'
import { IssueDetailDrawer } from './views/issue/IssueDetailDrawer'
import { AdminView, type AdminTab } from './views/admin/AdminView'
import { LoginView } from './views/auth/LoginView'
import { NotificationBell, NotificationPanel } from './components/NotificationCenter'

type View = 'dashboard' | 'issues' | 'board' | 'timeline' | 'resource' | 'schedule' | 'admin'

/** 删除撤销窗口：提示条存活时长（超时后仍可从管理台回收站恢复） */
const UNDO_MS = 6000

/** 数据窗口：compound index 取项目/状态维度最近 listLimit 条，再内存细筛；
 *  触底续载：滚动近底时 listLimit 递增（每批 LIST_WINDOW_STEP 条）。
 *  retryNonce 变化 = 重新订阅（API 模式首屏失败后的「重试」入口） */
function useIssueWindow(f: Filters, currentUser: string, listLimit: number, retryNonce: number) {
  const { issues } = useRepositories()
  return useObservableState(
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
          cycleFilter: f.cycleFilter,
        },
        currentUser,
        listLimit,
      ),
    [
      f.projectId,
      f.statusFilter,
      f.assigneeFilter,
      f.priorityFilter,
      f.search,
      f.myOnly,
      f.sortBy,
      f.cycleFilter,
      currentUser,
      listLimit,
      retryNonce,
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

/** 当前项目作用域下的迭代（startAt 倒序）；「全部项目」= 跨项目并集 */
function useCycles(projectId: string): Cycle[] | undefined {
  const { cycles } = useRepositories()
  return useObservable(() => cycles.liveAll(projectId), [cycles, projectId])
}

/** 迭代组计数：cycleId → 该周期工作项总数（侧栏角标用）。
 *  全部迭代行不显示；「当前迭代」行是派生行，按当前周期集合求和 */
function useCycleCountTotals(projectId: string) {
  const { issues } = useRepositories()
  const rows = useObservable(() => issues.liveCycleCounts(projectId), [issues, projectId])
  return useMemo(() => {
    const byCycle = new Map<string, number>()
    for (const r of rows ?? []) if (r.cycleId) byCycle.set(r.cycleId, r.total)
    return byCycle
  }, [rows])
}

/** 成员全量计数（项目全量，不随列表窗口截断）：成员 id → 条数，UNASSIGNED 键为未分配。
 *  项目总量来自 liveCounts（索引计数），各成员来自 liveAssigneeWorkload（跳过未分配），
 *  两者都排除软删行——未分配 = 总量 − 已分配之和，不需要为此再扫一遍分配索引。 */
function useFullAssigneeCounts(projectId: string, total: number | undefined) {
  const { issues } = useRepositories()
  const workload = useObservable(() => issues.liveAssigneeWorkload(projectId), [issues, projectId])
  return useMemo(() => {
    const map = new Map<string, number>()
    if (!workload) return map
    let assigned = 0
    for (const w of workload) {
      map.set(w.memberId, w.count)
      assigned += w.count
    }
    map.set(UNASSIGNED, Math.max(0, (total ?? assigned) - assigned))
    return map
  }, [workload, total])
}

/** 数据源徽标：DEV 下可点切换（写 localStorage + reload）；构建产物只读，
 *  公开 demo 永远本地模式，避免点到不存在的 /api */
function DataSourceBadge() {
  const source = activeDataSource()
  const label = source === 'api' ? t('dataApi') : t('dataLocal')
  const className = `tb-source${source === 'api' ? ' tb-source-api' : ''}`
  if (!import.meta.env.DEV) {
    return (
      <span className={className} data-testid="data-source-badge" title={t('dataSourceHint')}>
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={`${className} tb-source-btn`}
      data-testid="data-source-badge"
      title={t('dataSourceHint')}
      onClick={() => {
        storeDataSource(source === 'api' ? 'dexie' : 'api')
        location.reload()
      }}
    >
      {label}
    </button>
  )
}

export function App() {
  const apiMode = activeDataSource() === 'api'
  // API 模式的会话先决：token 校验通过才挂载工作台（数据订阅在登录前后不空转）
  const [session, setSession] = useState<Member | null>(null)
  const [ready, setReady] = useState(!apiMode)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!apiMode) return
    if (!getToken()) {
      setReady(true)
      return
    }
    let alive = true
    fetchMe()
      .then((member) => {
        if (!alive) return
        setSession(member)
        setReady(true)
      })
      .catch((e) => {
        console.error('[session]', e)
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [apiMode])

  // token 被服务端判失效（任何请求收到 401）：回登录页并说明原因
  useEffect(() => {
    if (!apiMode) return
    return onSessionExpired(() => {
      setSession(null)
      setNotice(t('sessionExpired'))
    })
  }, [apiMode])

  const signedIn = useCallback((result: LoginResult) => {
    localStorage.setItem('oas-pm-user', result.member.id)
    setNotice('')
    setSession(result.member)
  }, [])

  const signOut = useCallback(() => {
    setNotice('')
    setSession(null)
    void logoutSession()
  }, [])

  if (!ready) {
    return (
      <div className="login-page" data-testid="session-check">
        <p className="login-hint">{t('loginChecking')}</p>
      </div>
    )
  }
  if (apiMode && !session) return <LoginView notice={notice} onSignedIn={signedIn} />
  return <Workspace apiMode={apiMode} session={session} onSignOut={signOut} />
}

function Workspace({
  apiMode,
  session,
  onSignOut,
}: {
  apiMode: boolean
  session: Member | null
  onSignOut: () => void
}) {
  const {
    issues: issuesRepo,
    activities: activitiesRepo,
    savedViews: savedViewsRepo,
  } = useRepositories()
  // 当前登录身份：API 模式取会话成员；Dexie 模式沿用 localStorage 演示身份（默认张伟，头像点击切换）
  const [currentUser, setCurrentUser] = useState(
    () => session?.id ?? localStorage.getItem('oas-pm-user') ?? 'member-1',
  )
  const [lang, setLangState] = useState<Lang>(loadLang())
  const toggleLang = useCallback(() => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh'
    setLangState(next)
    setLang(next)
  }, [lang])
  const [themePref, setThemePref] = useState<ThemePreference>(loadTheme())
  // 筛选位置：偏好持久化在 localStorage，切换即时生效（同一份 Filters，两处渲染天然同步）
  const [placement, setPlacement] = useState<FilterPlacement>(loadFilterPlacement)
  const changePlacement = useCallback((next: FilterPlacement) => {
    setPlacement(next)
    storeFilterPlacement(next)
  }, [])
  const sidebarFilters = showsSidebarFilters(placement)
  const topbarFilters = showsTopbarFilters(placement)
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
  // 403 提示条：非 admin 触到管理端点时由服务端拒绝，前端给可见反馈（6s 自动收起）
  const [apiNotice, setApiNotice] = useState('')
  const apiNoticeTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!apiMode) return
    return onApiError((status) => {
      if (status !== 403) return
      setApiNotice(t('apiForbidden'))
      window.clearTimeout(apiNoticeTimer.current)
      apiNoticeTimer.current = window.setTimeout(() => setApiNotice(''), 6000)
    })
  }, [apiMode])
  useEffect(() => () => window.clearTimeout(apiNoticeTimer.current), [])
  // 删除撤销：软删除后 6 秒内可一键恢复（超时提示收起，回收站仍可恢复）。
  // 只存 id 与 key，文案在渲染时取自 t()——切换语言提示条跟着变
  const [undo, setUndo] = useState<{ ids: string[]; key?: string } | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)
  const showUndo = useCallback((ids: string[], key?: string) => {
    window.clearTimeout(undoTimer.current)
    setUndo({ ids, key })
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(undoTimer.current), [])
  const undoIds = useMemo(() => undo?.ids ?? [], [undo])
  const runUndo = useCallback(async () => {
    window.clearTimeout(undoTimer.current)
    setUndo(null)
    try {
      for (const id of undoIds) await issuesRepo.restore(id)
    } catch (e) {
      // 撤销失败（会话失效/行已被永久删除）：提示条已收起，回收站仍可手动恢复
      console.error('[undo: restore]', (e as Error)?.message ?? e)
    }
  }, [undoIds, issuesRepo])
  const applySavedView = useCallback((filtersJson: string) => {
    // 旧视图存的是单值/null：读取处归一为多选结构，不迁移存量数据
    const next = parseFilters(filtersJson)
    if (!next) return
    setFilters((prev) => ({ ...prev, ...next, search: '' }))
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

  const [listLimit, setListLimit] = useState(LIST_WINDOW)
  const extendList = useCallback(() => setListLimit((n) => n + LIST_WINDOW_STEP), [])
  // 窗口订阅失败的重试入口：改 nonce → 重新订阅（错误态复位为加载态）
  const [windowRetry, setWindowRetry] = useState(0)
  const retryWindow = useCallback(() => setWindowRetry((n) => n + 1), [])
  const issueWindow = useIssueWindow(filters, currentUser, listLimit, windowRetry)
  const issues = issueWindow.value
  const counts = useProjectCounts(filters.projectId)
  const members = useMembers()
  const projects = useProjects()
  const cycles = useCycles(filters.projectId)
  const cycleCounts = useCycleCountTotals(filters.projectId)
  const memberCounts = useFullAssigneeCounts(filters.projectId, counts?.total)
  const memberMap = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])
  const can = useCallback(
    (action: Action, ctx?: Ctx) =>
      policyCan(
        {
          id: currentUser,
          // 角色取成员表；表被清空/未到时用会话快照，避免 admin 掉成 viewer
          role: members?.find((m) => m.id === currentUser)?.role ?? session?.role ?? 'viewer',
        },
        action,
        ctx,
      ),
    [currentUser, members, session],
  )
  const canCreateIssue = can('issue:create')
  const canManage = can('project:manage')
  useEffect(() => {
    if (view === 'admin' && !canManage) setView('issues')
  }, [view, canManage])
  const openProject = useCallback((projectId: string) => {
    // 换项目即离开原项目的迭代：cycleFilter 复位（周期 id 不跨项目复用）
    setFilters((prev) => ({ ...prev, projectId, statusFilter: [], cycleFilter: null }))
    setView('issues')
  }, [])
  // 全部项目作用域下新建 Issue 必须落到一个真实项目（key 前缀来自项目）：
  // 记住「上次选中的真实项目」，缺省回退第一个项目；全部项目本身不是可写入的作用域
  const [lastProjectId, setLastProjectId] = useState('project-1')
  const [createProjectId, setCreateProjectId] = useState('project-1')
  const resolveCreateProject = useCallback(() => {
    if (filters.projectId !== ALL_PROJECTS) return filters.projectId
    const ids = (projects ?? []).map((p) => p.id)
    if (ids.length === 0) return lastProjectId
    return ids.includes(lastProjectId) ? lastProjectId : ids[0]
  }, [filters.projectId, lastProjectId, projects])
  const openCreate = useCallback(() => {
    setCreateProjectId(resolveCreateProject())
    createRef.current?.setAttribute('visible', '')
  }, [resolveCreateProject])
  const openCreateRef = useRef(openCreate)
  openCreateRef.current = openCreate
  const handleMemberDeleted = useCallback(
    (id: string) => {
      if (id !== currentUser) return
      // API 模式的身份由 token 决定：删掉自己不能「切到另一个演示身份」，否则界面身份与令牌分叉
      if (apiMode) return
      const next = (members ?? []).find((m) => m.role === 'admin' && m.id !== id)
      switchUser(next?.id ?? 'member-1')
    },
    [apiMode, currentUser, members, switchUser],
  )
  const canCreateRef = useRef(canCreateIssue)
  canCreateRef.current = canCreateIssue
  // biome-ignore lint/correctness/useExhaustiveDependencies: t() 读模块级语言态，lang 是语言切换时的重算触发器
  const memberOptions = useMemo(
    () => [
      { label: t('resourceUnassigned'), value: '__none__' },
      ...[...(members ?? [])].map((m) => ({ label: m.name, value: m.id })),
    ],
    [members, lang],
  )
  // 工具条成员多选：成员名 + 全量计数后缀（项目全量，不随窗口变），「未分配」置首
  // biome-ignore lint/correctness/useExhaustiveDependencies: t() 读模块级语言态，lang 是语言切换时的重算触发器
  const assigneeFilterOptions = useMemo(
    () => buildAssigneeOptions(members, memberCounts, { unassigned: t('unassignedMember') }),
    [members, memberCounts, lang],
  )
  // 顶部筛选栏/侧栏共用同一批选项（含全量计数后缀）：两处控件文案必须同源，
  // 否则「同一筛选两处看」会读到不同计数
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang 是语言切换时的重算触发器
  const statusFilterOptions = useMemo(
    () =>
      ISSUE_STATUSES.map((s) => ({
        label: `${statusLabel(s)} (${counts?.byStatus[s] ?? 0})`,
        value: s,
      })),
    [counts, lang],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang 是语言切换时的重算触发器
  const priorityFilterOptions = useMemo(
    () =>
      ISSUE_PRIORITIES.map((p) => ({
        label: `${priorityLabel(p)} (${counts?.byPriority[p] ?? 0})`,
        value: p,
      })),
    [counts, lang],
  )
  // 迭代下拉：全部 / 当前迭代（派生，无周期时不列）/ 各周期 / 无迭代（哨兵与 cycleFilter 直接对接）
  // biome-ignore lint/correctness/useExhaustiveDependencies: lang 是语言切换时的重算触发器
  const cycleFilterOptions = useMemo(
    () => [
      { label: t('allCycles'), value: 'all' },
      ...((cycles ?? []).length > 0 ? [{ label: t('currentCycle'), value: CURRENT_CYCLE }] : []),
      ...(cycles ?? []).map((c) => ({ label: c.name, value: c.id })),
      { label: t('noCycle'), value: NO_CYCLE },
    ],
    [cycles, lang],
  )
  // 新建 Issue 的项目下拉：只列真实项目（「全部项目」不是可写入作用域）
  const projectOptions = useMemo(
    () => (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
    [projects],
  )

  const setF = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
  }, [])

  const canDeleteView = can('view:delete')
  const sideRows: SideRow[] = [
    // Projects 组保持单选（项目 = 作用域）：首行「全部项目」是 workspace 级作用域
    {
      group: t('projects'),
      kind: 'project',
      value: `project:${ALL_PROJECTS}`,
      id: ALL_PROJECTS,
      label: t('allProjects'),
    },
  ]
  for (const p of projects ?? []) {
    sideRows.push({
      group: t('projects'),
      kind: 'project',
      value: `project:${p.id}`,
      id: p.id,
      label: p.name,
    })
  }
  sideRows.push(
    {
      group: t('views'),
      kind: 'view',
      value: 'view:all',
      id: 'all',
      label: t('allIssues'),
    },
    {
      group: t('views'),
      kind: 'view',
      value: 'view:my',
      id: 'my',
      label: t('myView').replace('{name}', memberMap.get(currentUser)?.name ?? ''),
    },
  )
  // 筛选组只在侧栏承载筛选时出现（位置 = 顶部时由内容区顶部筛选栏接管；两处同源）
  if (sidebarFilters) {
    sideRows.push({
      group: t('status'),
      kind: 'status',
      value: 'status:all',
      id: 'all',
      label: t('allStatuses'),
      count: counts?.total.toLocaleString() ?? '…',
    })
    for (const s of ISSUE_STATUSES) {
      sideRows.push({
        group: t('status'),
        kind: 'status',
        value: `status:${s}`,
        id: s,
        label: statusLabel(s),
        statusColor: STATUS_COLOR[s],
        count: counts?.byStatus[s]?.toLocaleString() ?? '…',
      })
    }
    sideRows.push({
      group: t('priority'),
      kind: 'priority',
      value: 'priority:all',
      id: 'all',
      label: t('allPriorities'),
      count: counts?.total.toLocaleString() ?? '…',
    })
    for (const p of ISSUE_PRIORITIES) {
      sideRows.push({
        group: t('priority'),
        kind: 'priority',
        value: `priority:${p}`,
        id: p,
        label: priorityLabel(p),
        iconColor: PRIORITY_TEXT[p],
        count: counts?.byPriority[p]?.toLocaleString() ?? '…',
      })
    }
    // 迭代组：单选（周期有序，多选无交集意义）。行 = 全部迭代 / 当前迭代（派生）/
    // 本项目周期（startAt 倒序，最多 CYCLE_SIDEBAR_LIMIT 个）。项目无周期时只留「全部迭代」，
    // 「当前迭代」指向必然为空的集合，不列入
    sideRows.push({
      group: t('cycles'),
      kind: 'cycle',
      value: 'cycle:all',
      id: 'all',
      label: t('allCycles'),
    })
    if ((cycles ?? []).length > 0) {
      const currentIds = currentCycleIds(cycles ?? [], Date.now())
      const currentTotal = [...currentIds].reduce((n, id) => n + (cycleCounts.get(id) ?? 0), 0)
      sideRows.push({
        group: t('cycles'),
        kind: 'cycle',
        value: `cycle:${CURRENT_CYCLE}`,
        id: CURRENT_CYCLE,
        label: t('currentCycle'),
        count: currentTotal.toLocaleString(),
      })
    }
    for (const c of (cycles ?? []).slice(0, CYCLE_SIDEBAR_LIMIT)) {
      sideRows.push({
        group: t('cycles'),
        kind: 'cycle',
        value: `cycle:${c.id}`,
        id: c.id,
        label: c.name,
        count: (cycleCounts.get(c.id) ?? 0).toLocaleString(),
      })
    }
  }
  for (const v of savedViews ?? []) {
    sideRows.push({
      group: t('savedViews'),
      kind: 'savedview',
      value: `savedview:${v.id}`,
      id: v.id,
      label: v.name,
      savedFilters: v.filters,
      deletable: canDeleteView,
    })
  }
  const sideActive: Record<string, string | string[]> = {
    [t('projects')]: `project:${filters.projectId}`,
    [t('views')]: filters.myOnly ? 'view:my' : 'view:all',
  }
  if (sidebarFilters) {
    sideActive[t('status')] = filters.statusFilter.length
      ? filters.statusFilter.map((s) => `status:${s}`)
      : ['status:all']
    sideActive[t('priority')] = filters.priorityFilter.length
      ? filters.priorityFilter.map((p) => `priority:${p}`)
      : ['priority:all']
    sideActive[t('cycles')] = `cycle:${filters.cycleFilter ?? 'all'}`
  }

  const handleSideRowClick = useCallback(
    (row: SideRow) => {
      switch (row.kind) {
        case 'project':
          // 点项目行 = 离开「全部项目」；点「全部项目」= 跨项目作用域（记住上次真实项目供新建 Issue）。
          // 换项目时迭代筛选复位：周期 id 只在本项目内有意义
          if (row.id && row.id !== ALL_PROJECTS) setLastProjectId(row.id)
          setFilters((prev) => ({
            ...prev,
            projectId: row.id ?? '',
            statusFilter: [],
            cycleFilter: null,
          }))
          break
        case 'view':
          setF('myOnly', row.id === 'my')
          break
        case 'status':
          // 组内 OR：点击行即 toggle；「全部」行清空该组
          setFilters((prev) => ({
            ...prev,
            statusFilter:
              row.id === 'all' ? [] : toggleIn(prev.statusFilter, row.id as IssueStatus),
          }))
          break
        case 'priority':
          setFilters((prev) => ({
            ...prev,
            priorityFilter:
              row.id === 'all' ? [] : toggleIn(prev.priorityFilter, row.id as IssuePriority),
          }))
          break
        case 'cycle': {
          // 单选切换：再点同一行取消（回到全部迭代）；「全部迭代」行直接清空
          const next = row.id === 'all' ? null : (row.id ?? null)
          setFilters((prev) => ({
            ...prev,
            cycleFilter: prev.cycleFilter === next ? null : next,
          }))
          break
        }
        case 'savedview':
          if (row.savedFilters) applySavedView(row.savedFilters)
          break
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
      [t('key'), t('title'), t('status'), t('priority'), t('assignee'), t('createdAt')].join(','),
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
    const projectId = createProjectId
    const created = await issuesRepo.create({
      projectId,
      title,
      status,
      priority,
      assigneeId: assigneeId || null,
      reporterId: currentUser,
    })
    await activitiesRepo.log({ issueId: created.id, actorId: currentUser, type: 'create' })
    // 记下真实项目：全部项目作用域下下次新建默认落到同一个项目
    setLastProjectId(projectId)
    if (input) input.value = ''
    createRef.current?.removeAttribute('visible')
  }, [
    createProjectId,
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
      openCreateRef.current()
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
        <DataSourceBadge />
        {apiMode ? (
          <>
            {/* API 模式的身份来自会话（token 决定），不能就地切换：换人 = 换 token */}
            <span className="tb-user tb-user-static" data-testid="tb-user">
              <Avatar member={memberMap.get(currentUser)} size={22} />
              <span>{memberMap.get(currentUser)?.name ?? session?.name ?? ''}</span>
            </span>
            <oas-button type="text" size="small" data-testid="tb-logout" onClick={onSignOut}>
              {t('logout')}
            </oas-button>
          </>
        ) : (
          <button
            className="tb-user"
            type="button"
            data-testid="tb-user"
            title={t('paletteSwitchUser')}
            onClick={() => userPickRef.current?.setAttribute('visible', '')}
          >
            <Avatar member={memberMap.get(currentUser)} size={22} />
            <span>{memberMap.get(currentUser)?.name ?? ''}</span>
          </button>
        )}
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
          <oas-button type="primary" data-testid="toolbar-new" onClick={openCreate}>
            {t('newIssue')}
          </oas-button>
        )}
        <oas-button type="text" size="small" data-testid="toolbar-export" onClick={exportCsv}>
          {t('exportCsv')}
        </oas-button>
        <oas-button
          type="text"
          size="small"
          data-testid="command-open"
          title={t('shortcutPalette')}
          aria-label={t('shortcutPalette')}
          onClick={() => setPaletteOpen(true)}
        >
          <oas-icon name="search" size={14} />
        </oas-button>
        <oas-input
          ref={searchRef}
          className="toolbar-search"
          data-testid="toolbar-search"
          placeholder={t('search')}
        />
        {/* 筛选位置偏好：紧凑 segmented，切换即时生效并持久化（label 走 title，视觉只留三项） */}
        <span className="tb-placement" title={t('filterPlacement')}>
          <OSegmented
            testid="filters-placement"
            ariaLabel={t('filterPlacement')}
            value={placement}
            options={[
              { label: t('placementSidebar'), value: 'sidebar' },
              { label: t('placementTopbar'), value: 'topbar' },
              { label: t('placementBoth'), value: 'both' },
            ]}
            onChange={(v) => changePlacement(v as FilterPlacement)}
          />
        </span>
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
        <NotificationBell
          currentUser={currentUser}
          onOpen={() => notifyRef.current?.setAttribute('visible', '')}
        />
        <oas-button
          type="text"
          size="small"
          data-testid="toolbar-about"
          onClick={() => aboutRef.current?.setAttribute('visible', '')}
        >
          {t('about')}
        </oas-button>
      </header>
      {apiNotice && (
        <oas-alert type="error" className="api-notice" data-testid="api-forbidden">
          {apiNotice}
        </oas-alert>
      )}
      {undo && (
        <oas-alert type="warning" size="small" className="undo-bar" data-testid="undo-bar">
          {undo.key
            ? t('undoDeleted').replace('{name}', undo.key)
            : t('undoDeletedMany').replace('{n}', String(undo.ids.length))}
          <oas-button
            slot="action"
            size="small"
            data-testid="undo-action"
            onClick={() => void runUndo()}
          >
            {t('undoAction')}
          </oas-button>
        </oas-alert>
      )}
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
                  ariaLabel={t('viewNav')}
                  value={view}
                  options={[
                    { label: t('dashboard'), value: 'dashboard' },
                    { label: t('list'), value: 'issues' },
                    { label: t('board'), value: 'board' },
                    { label: t('timeline'), value: 'timeline' },
                    { label: t('resource'), value: 'resource' },
                    { label: t('schedule'), value: 'schedule' },
                  ]}
                  onChange={(v) => setView(v as View)}
                />
              </div>
              {/* 侧栏成员筛选：一行可搜索多选（不再占 8 行成员条目）；与工具条/顶栏共用 assigneeFilter */}
              {sidebarFilters && (
                <div className="side-filters" data-testid="side-filters">
                  <span className="side-filters-label">{t('members')}</span>
                  <OMultiSelect
                    testid="side-filter-assignee"
                    label={t('members')}
                    searchLabel={t('searchMembers')}
                    placeholder={t('allMembers')}
                    maxTagCount={1}
                    value={filters.assigneeFilter}
                    options={assigneeFilterOptions}
                    onChange={(v) => setF('assigneeFilter', v)}
                  />
                </div>
              )}
              <SideList
                rows={sideRows}
                activeByGroup={sideActive}
                onRowClick={handleSideRowClick}
                onDeleteSavedView={handleDeleteSavedView}
              />
            </aside>
            <main
              className={`content${topbarFilters && view !== 'dashboard' ? ' has-filter-bar' : ''}`}
            >
              {/* 顶部筛选栏：位置偏好含顶部时接管四个筛选维度（列表/看板/时间线/资源/日程；仪表盘无筛选） */}
              {topbarFilters && view !== 'dashboard' && (
                <FilterBar
                  filters={filters}
                  setFilters={setFilters}
                  statusOptions={statusFilterOptions}
                  priorityOptions={priorityFilterOptions}
                  assigneeOptions={assigneeFilterOptions}
                  cycleOptions={cycleFilterOptions}
                />
              )}
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
                    error={issueWindow.error}
                    onRetry={retryWindow}
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
                    onNearBottom={extendList}
                    onDeleted={(ids) => showUndo(ids)}
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
              {view === 'schedule' && (
                <ErrorBoundary key={view}>
                  <ScheduleView issues={issues ?? []} can={can} onOpenIssue={setSelectedId} />
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
            <label htmlFor="create-title">{t('title')}</label>
            <oas-input data-testid="create-title" placeholder={t('createTitlePlaceholder')} />
            <p className="create-error" data-testid="create-error" hidden>
              {t('titleRequired')}
            </p>
          </div>
          <div className="create-row">
            <div className="create-field">
              <label htmlFor="create-project">{t('project')}</label>
              {/* 全部项目作用域下必须选一个真实项目：key 前缀与项目计数器都来自项目 */}
              <OSelect
                testid="create-project"
                value={createProjectId}
                options={projectOptions}
                onChange={setCreateProjectId}
              />
            </div>
            <div className="create-field">
              <label htmlFor="create-status">{t('status')}</label>
              <OSelect
                testid="create-status"
                value={createStatus}
                options={ISSUE_STATUSES.map((s) => ({ label: statusLabel(s), value: s }))}
                onChange={(v) => setCreateStatus(v as IssueStatus)}
              />
            </div>
            <div className="create-field">
              <label htmlFor="create-priority">{t('priority')}</label>
              <OSelect
                testid="create-priority"
                value={createPriority}
                options={ISSUE_PRIORITIES.map((p) => ({ label: p, value: p }))}
                onChange={(v) => setCreatePriority(v as IssuePriority)}
              />
            </div>
            <div className="create-field">
              <label htmlFor="create-assignee">{t('assignee')}</label>
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
              {t('cancel')}
            </oas-button>
            <oas-button
              type="primary"
              data-testid="create-submit"
              onClick={() => void createIssue()}
            >
              {t('create')}
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
          onDeleted={(issue) => showUndo([issue.id], issue.key)}
        />
      )}

      {/* 保存视图 */}
      <oas-modal ref={saveViewRef} no-footer data-testid="modal-save-view">
        <div className="create-body">
          <div className="create-field">
            <label htmlFor="save-view-name">{t('viewName')}</label>
            <oas-input
              ref={saveViewNameRef}
              data-testid="save-view-name"
              placeholder={t('saveViewPlaceholder')}
            />
          </div>
          <div className="quit-actions">
            <oas-button
              data-testid="save-view-cancel"
              onClick={() => saveViewRef.current?.removeAttribute('visible')}
            >
              {t('cancel')}
            </oas-button>
            <oas-button type="primary" data-testid="save-view-ok" onClick={() => void doSaveView()}>
              {t('save')}
            </oas-button>
          </div>
        </div>
      </oas-modal>

      {/* 通知中心（右侧面板：列表点击标已读并打开 Issue 详情） */}
      <NotificationPanel
        drawerRef={notifyRef}
        currentUser={currentUser}
        memberMap={memberMap}
        onOpenIssue={setSelectedId}
      />

      {/* 身份切换（Dexie 演示模式专用；API 模式换人 = 换 token，走登出） */}
      {!apiMode && (
        <oas-modal
          ref={userPickRef}
          title={t('paletteSwitchUser')}
          no-footer
          data-testid="modal-user"
        >
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
      )}

      {/* 命令面板 */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        can={can}
        onView={(v) => setView(v)}
        onNewIssue={openCreate}
        onExportCsv={exportCsv}
        onSaveView={() => saveViewRef.current?.setAttribute('visible', '')}
        onToggleTheme={cycleTheme}
        onToggleLang={toggleLang}
        onShortcuts={() => setHelpOpen(true)}
        onSwitchUser={apiMode ? onSignOut : switchUser}
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
          <p className="about-desc">{t('aboutDesc')}</p>
          <div className="quit-actions">
            <oas-button
              type="primary"
              data-testid="about-close"
              onClick={() => aboutRef.current?.removeAttribute('visible')}
            >
              {t('know')}
            </oas-button>
          </div>
        </div>
      </oas-modal>
    </div>
  )
}
