<script lang="ts">
  // src/pages/users/users-table.svelte —— 用户列表（oas-table + 空态覆盖层 + 行事件委托）
  // 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道：
  //    bind:this + $effect 命令式赋 el.columns；列定义随 locale/roles 重建（角色筛选选项来自
  //    roles，文案来自 t）
  // 2. 行事件：onoas-row-click 模板直绑开详情；编辑按钮的原生 click 是 composed 事件，能冒泡出
  //    oas-table shadow 到容器 onclick（已知边界：与 oas-row-click 连带双触发 → 详情 + 表单
  //    双弹窗，vanilla 同款，保持原样不修）
  // 3. 展示行数据走纯数据 JSON attribute（toDisplay 后的 dataJson，vanilla setAttribute 同通道）
  import type { TableColumn } from '@oas-ui/ui/data/table'
  import type { UserRow } from '../../data/users'
  import type { RoleRow } from '../../data/system'
  import { useT } from '../../lib/use-t.svelte'

  interface Props {
    /** 父组件持有引用：搜索/清筛选时 setAttribute('current','1')（vanilla 同款） */
    tableEl: HTMLElement | null
    /** 展示行 JSON（toDisplay 后的数据） */
    dataJson: string
    roles: RoleRow[]
    /** 关键字过滤结果为空：表格隐藏 + 空态覆盖层显示 */
    empty: boolean
    /** 三路数据任一在取即视为加载中（表格 loading attribute） */
    loading: boolean
    pageSize: number
    onRowOpen: (id: number) => void
    onEditRow: (id: number) => void
    onClearFilters: () => void
  }

  let {
    tableEl = $bindable(null),
    dataJson,
    roles,
    empty,
    loading,
    pageSize,
    onRowOpen,
    onEditRow,
    onClearFilters,
  }: Props = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  type TFunc = (key: string, params?: Record<string, string | number>) => string

  function statusLabel(status: 'active' | 'disabled', t: TFunc): string {
    return t(`users.status.${status}`)
  }

  /** vanilla cellAction：行内编辑按钮（class/data-testid/data-id 逐字对齐） */
  function cellAction(row: UserRow, t: TFunc): HTMLElement {
    const edit = document.createElement('oas-button')
    edit.className = 'user-row-edit'
    edit.setAttribute('data-testid', 'user-row-edit')
    edit.setAttribute('data-id', String(row.id))
    edit.setAttribute('size', 'small')
    edit.setAttribute('icon', 'edit')
    edit.setAttribute('aria-label', t('common.edit'))
    return edit
  }

  /** vanilla COLUMNS：role/status 可过滤，created 可排序，action 列 render 走富内容挂载 */
  function buildColumns(
    t: TFunc,
    roleFilters: Array<{ label: string; value: string }>,
  ): TableColumn[] {
    return [
      { key: 'id', title: 'ID', width: '60px' },
      { key: 'name', title: t('users.name') },
      { key: 'email', title: t('users.email') },
      { key: 'role', title: t('users.role'), filterable: true, filters: roleFilters },
      {
        key: 'status',
        title: t('users.status'),
        filterable: true,
        filters: [
          { label: statusLabel('active', t), value: statusLabel('active', t) },
          { label: statusLabel('disabled', t), value: statusLabel('disabled', t) },
        ],
      },
      { key: 'created', title: t('users.created'), sortable: true },
      {
        key: 'action',
        title: t('users.th.action'),
        width: '80px',
        render: (r) => cellAction(r as unknown as UserRow, t),
      },
    ]
  }

  // 列定义随 locale/roles 重建，property 通道命令式赋值
  const columns = $derived.by(() => {
    void $locale
    void roles
    return buildColumns(
      t,
      roles.map((r) => ({ label: r.name, value: r.name })),
    )
  })

  $effect(() => {
    if (tableEl) (tableEl as unknown as { columns: TableColumn[] }).columns = columns
  })

  function onRowClick(e: Event): void {
    const { row } = (e as CustomEvent<{ row: Record<string, unknown> }>).detail
    const id = Number(row.id)
    if (Number.isFinite(id)) onRowOpen(id)
  }

  // 行内编辑按钮：原生 click 是 composed 事件，能冒泡出 oas-table shadow 到容器
  // （已知边界：连带派发 oas-row-click → 双弹窗，vanilla 同款保持原样）
  function onWrapClick(e: MouseEvent): void {
    const btn = e
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('.user-row-edit'))
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    if (id) onEditRow(id)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class={`table-wrap${empty ? ' is-empty' : ''}`} id="table-wrap" onclick={onWrapClick}>
  <oas-table
    bind:this={tableEl}
    data-testid="users-table"
    row-key="id"
    class={empty ? 'table-hidden' : ''}
    data={dataJson}
    pagination
    loading={loading ? '' : null}
    page-size={pageSize}
    onoas-row-click={onRowClick}
  ></oas-table>
  <div class="empty-overlay" id="empty-overlay" hidden={!empty}>
    <oas-empty description={tt('users.empty')}></oas-empty>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <oas-button id="clear-filters" type="primary" onclick={onClearFilters}>
      {tt('common.clearFilter')}
    </oas-button>
  </div>
</div>
