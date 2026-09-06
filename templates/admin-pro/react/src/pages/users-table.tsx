// src/pages/users-table.tsx —— 用户列表（oas-table + 空态覆盖层 + 行事件委托）
// 行为事实来源：vanilla-html/src/pages/users.ts 的 COLUMNS/cellAction/renderTable/setEmpty 段。
// 偏差记录（因果链）：
// 1. columns 含 render 函数（返回真实 DOM 节点），JSON 序列化会丢函数，故走 property 通道
//   （oas-table 的 columns setter 双通道均支持，AGENTS.md 第 3 条例外）；columns 用 useMemo
//    按 locale + roles 重建（对齐 vanilla refreshText 里 renderTable 重设列的时机——
//    角色筛选选项来自 roles，文案来自 t）
// 2. 行事件：oas-row-click 自定义事件走 useOasEvent（AGENTS.md 第 1 条）；编辑按钮的原生
//    click 是 composed 事件，能冒泡出 oas-table shadow 到 React 根委托（oas-table 不在
//    drawer/modal 例外之列），故用容器 onClick + composedPath 匹配 .user-row-edit
//   （对齐 vanilla fromPath 的 matches 语义）
// 3. 空态：vanilla setEmpty 手动切 table-hidden 类与 overlay 的 hidden；本模版由 empty
//    prop 派生（is-empty/table-hidden/hidden 三处同一事实来源）
import { useMemo } from 'react'
import type { TableColumn } from '@oas-ui/ui/data/table'
import type { UserRow, UserStatus } from '../data/users'
import type { RoleRow } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'

export interface UsersTableProps {
  /** 父组件持有 ref：搜索/清筛选时 setAttribute('current','1')、refresh 时切 loading（vanilla 同款） */
  tableRef: React.RefObject<HTMLElement | null>
  /** 展示行 JSON（toDisplay 后的数据，vanilla setAttribute('data', JSON) 同通道） */
  dataJson: string
  roles: RoleRow[]
  /** 关键字过滤结果为空：表格隐藏 + 空态覆盖层显示 */
  empty: boolean
  pageSize: number
  onRowOpen: (id: number) => void
  onEditRow: (id: number) => void
  onClearFilters: () => void
}

type TFunc = (key: string, params?: Record<string, string | number>) => string

function statusLabel(status: UserStatus, t: TFunc): string {
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

export function UsersTable({
  tableRef,
  dataJson,
  roles,
  empty,
  pageSize,
  onRowOpen,
  onEditRow,
  onClearFilters,
}: UsersTableProps) {
  const { t, locale } = useT()

  // 列定义按 locale + roles 重建（vanilla renderTable 里 COLUMNS(roleFilters) 同款时机）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo<TableColumn[]>(
    () =>
      buildColumns(
        t,
        roles.map((r) => ({ label: r.name, value: r.name })),
      ),
    [locale, roles],
  )

  // 行点击 → 详情弹窗（vanilla oas-row-click 段）
  useOasEvent<{ row: Record<string, unknown> }>(tableRef, 'oas-row-click', (detail) => {
    const id = Number(detail.row.id)
    if (Number.isFinite(id)) onRowOpen(id)
  })

  // 编辑按钮：composed click 冒泡出 shadow 后经 React 根委托到此（vanilla fromPath 等价）
  const onWrapClick = (e: React.MouseEvent) => {
    const btn = e.nativeEvent
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('.user-row-edit'))
    if (!btn) return
    const id = Number(btn.getAttribute('data-id'))
    if (id) onEditRow(id)
  }

  return (
    <div className={`table-wrap${empty ? ' is-empty' : ''}`} id="table-wrap" onClick={onWrapClick}>
      <oas-table
        ref={tableRef}
        data-testid="users-table"
        row-key="id"
        className={empty ? 'table-hidden' : undefined}
        columns={columns}
        data={dataJson}
        pagination
        page-size={pageSize}
      />
      <div className="empty-overlay" id="empty-overlay" hidden={!empty}>
        <oas-empty description={t('users.empty')} />
        <oas-button id="clear-filters" type="primary" onClick={onClearFilters}>
          {t('common.clearFilter')}
        </oas-button>
      </div>
    </div>
  )
}
