<script lang="ts">
  // src/pages/users.svelte —— 用户管理（表格 + 搜索 + 详情 descriptions + modal 表单 + 角色权限）
  // 1. 列表/角色/菜单树三路数据挂载后并行拉取（$effect 一次）；keyword/editingId/两个弹窗 open
  //    仍 $state，表格 data/空态/按钮禁用全部由数据派生；删除成功后重拉，页面持有手动 refresh
  //    （react 版 query 缓存层在 Svelte 无对应物，直连 data 层）
  // 2. 事件绑定：oas-input 的 oas-input/oas-clear 自定义事件 onoas-* 直绑；新建/刷新/清筛选按钮
  //    为 light DOM 原生 click 直绑 onclick；表格行事件与两个弹窗的事件接线见
  //    ./users/users-table.svelte / ./users/user-form.svelte / ./users/user-detail.svelte 头注释
  // 3. oas-table 内置分页的 current 指针不走响应式（组件受控集合外的人工复位），搜索/清筛选时
  //    经 tableEl setAttribute('current','1') 复位（vanilla 同款，不纳入 state）
  // 4. 子组件拆分（单文件 ≤400 行纪律）：表格 ./users/users-table.svelte、表单弹窗
  //    ./users/user-form.svelte、详情弹窗 ./users/user-detail.svelte
  import '../styles/pages/users.css'
  import { listUsers, removeUser } from '../data/users'
  import type { UserRow, UserRole } from '../data/users'
  import { listRoles, treeMenus } from '../data/system'
  import type { MenuTree, RoleRow } from '../data/system'
  import { appMessage } from '../lib/app-message'
  import { useT } from '../lib/use-t.svelte'
  import { readPageSize } from '../settings-init'
  import { session } from '../store/session'
  import UserDetail from './users/user-detail.svelte'
  import type { UserPermItem } from './users/user-detail.svelte'
  import UserForm from './users/user-form.svelte'
  import UsersTable from './users/users-table.svelte'

  /** 每页条数跟随设置中心（settings 页 page-size，默认 5），vanilla pageSize() 同款 */
  function readPageSizeNum(): number {
    return Number(readPageSize()) || 5
  }

  /** vanilla ALLOWED：各角色枚举在用户管理下可用的权限标识 */
  const ALLOWED: Record<UserRole, string[]> = {
    admin: ['user:list', 'user:add', 'user:edit', 'user:delete'],
    editor: ['user:list', 'user:add', 'user:edit'],
    viewer: ['user:list'],
  }

  /** vanilla findMenu：菜单树里按标题找 C 类节点（用户管理） */
  function findMenu(nodes: MenuTree[], title: string): MenuTree | null {
    for (const n of nodes) {
      if (n.title === title && n.type === 'C') return n
      if (n.children?.length) {
        const f = findMenu(n.children, title)
        if (f) return f
      }
    }
    return null
  }

  /** vanilla tagTypeForRole / roleTagType 段 */
  function tagTypeForRole(role: UserRole): string {
    if (role === 'admin') return 'primary'
    if (role === 'editor') return 'warning'
    return 'default'
  }

  function roleTagType(target: UserRow): string {
    return target.roleId === 1 ? 'primary' : target.roleId === 4 ? 'default' : 'warning'
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  // ---- state ----
  let keyword = $state('')
  let editingId = $state<number | null>(null)
  let formOpen = $state(false)
  let detailOpen = $state(false)
  const pageSize = $state(readPageSizeNum())

  let rows = $state<UserRow[]>([])
  let roles = $state<RoleRow[]>([])
  let menuTree = $state<MenuTree[]>([])
  let loading = $state(true)

  let searchEl = $state<HTMLElement | null>(null)
  let tableEl = $state<HTMLElement | null>(null)

  const canMutate = session.user?.role !== 'viewer'

  // 挂载拉取（refresh 供变更后重取；effect 内同步段不读响应式状态，不会回环）
  function refresh(): void {
    loading = true
    void (async () => {
      const [nextRows, nextRoles, nextMenus] = await Promise.all([
        listUsers(),
        listRoles(),
        treeMenus(),
      ])
      rows = nextRows
      roles = nextRoles
      menuTree = nextMenus
      loading = false
    })()
  }

  $effect(() => {
    refresh()
  })

  // ---- 派生 ----
  const roleMap = $derived(new Map(roles.map((r) => [r.id, r])))

  function roleName(target: UserRow): string {
    if (target.roleId != null) {
      const r = roleMap.get(target.roleId)
      if (r) return r.name
    }
    return t(`users.role.${target.role}`)
  }

  const filtered = $derived.by(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (kw && !(r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)))
        return false
      return true
    })
  })

  const dataJson = $derived.by(() => {
    void $locale
    return JSON.stringify(
      filtered.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: roleName(row),
        status: t(`users.status.${row.status}`),
        created: row.created,
      })),
    )
  })

  const detailRow = $derived(rows.find((r) => r.id === editingId) ?? null)

  const detailPerms = $derived.by((): UserPermItem[] => {
    const target = detailRow
    if (!target) return []
    const node = findMenu(menuTree, '用户管理')
    if (!node) return []
    const perms = (node.children ?? [])
      .filter((c) => c.type === 'F')
      .map((c) => c.perms ?? '')
      .filter(Boolean)
    const allowed = new Set(ALLOWED[target.role])
    return perms.map((p) => ({ perm: p, allowed: allowed.has(p) }))
  })

  // ---- 行为 ----
  function onCreate(): void {
    if (!canMutate) return
    editingId = null
    formOpen = true
  }

  function onEditRow(id: number): void {
    if (!rows.some((r) => r.id === id)) return
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    editingId = id
    formOpen = true
  }

  function onRowOpen(id: number): void {
    if (!rows.some((r) => r.id === id)) return
    editingId = id
    detailOpen = true
  }

  function onDetailEdit(): void {
    if (!detailRow) return
    detailOpen = false
    formOpen = true
  }

  async function onDelete(): Promise<void> {
    if (editingId == null) return
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    await removeUser(editingId)
    editingId = null
    detailOpen = false
    appMessage.success(t('common.deleted'))
    refresh()
  }

  // 表格内置分页复位首页 + 清筛选（tableEl 人工复位，vanilla 同款）
  function backToFirstPage(): void {
    tableEl?.setAttribute('current', '1')
  }
  function onSearchInput(e: Event): void {
    keyword = (e as CustomEvent<{ value: string }>).detail.value
    backToFirstPage()
  }
  function onSearchClear(): void {
    keyword = ''
    backToFirstPage()
  }
  function onClearFilters(): void {
    keyword = ''
    backToFirstPage()
    tableEl?.removeAttribute('filter-values')
    searchEl?.setAttribute('value', '')
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('users.title')}</h1>
      <p class="page-subtitle">{tt('users.subtitle')}</p>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button
      data-testid="user-create"
      type="primary"
      icon="plus"
      disabled={!canMutate ? '' : null}
      title={!canMutate ? tt('common.noPerm') : undefined}
      aria-disabled={!canMutate ? 'true' : undefined}
      onclick={onCreate}
    >
      {tt('users.new')}
    </oas-button>
  </div>
  <oas-card class="list-card" title={tt('users.list')}>
    <div class="users-toolbar" slot="extra">
      <oas-input
        bind:this={searchEl}
        data-testid="user-search"
        placeholder={tt('users.search')}
        clearable
        prefix-icon="search"
        onoas-input={onSearchInput}
        onoas-clear={onSearchClear}
      ></oas-input>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <oas-button
        id="users-refresh"
        icon="refresh"
        title={tt('common.refresh')}
        onclick={() => refresh()}
      ></oas-button>
    </div>
    <UsersTable
      bind:tableEl
      {dataJson}
      {roles}
      empty={filtered.length === 0}
      {loading}
      {pageSize}
      onRowOpen={onRowOpen}
      onEditRow={onEditRow}
      onClearFilters={onClearFilters}
    />
  </oas-card>
  <UserForm
    open={formOpen}
    {editingId}
    editing={rows.find((r) => r.id === editingId) ?? null}
    {roles}
    onClose={() => (formOpen = false)}
    onSaved={() => {
      formOpen = false
      refresh()
    }}
  />
  <UserDetail
    open={detailOpen}
    user={detailRow}
    roleName={detailRow ? roleName(detailRow) : ''}
    roleTagType={
      detailRow
        ? detailRow.roleId != null
          ? roleTagType(detailRow)
          : tagTypeForRole(detailRow.role)
        : 'default'
    }
    perms={detailPerms}
    {canMutate}
    onClose={() => (detailOpen = false)}
    onEdit={onDetailEdit}
    onDelete={() => void onDelete()}
  />
</div>
