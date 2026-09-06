// src/pages/users.tsx —— 用户管理（表格 + 搜索 + 详情 descriptions + modal 表单 + 角色权限）
//    rows/roles/menuTree/keyword/editingId/formOpen/detailOpen 全部 useState，表格 data/
//    空态/按钮禁用全部由 state 派生；refresh() 仅重拉数据 setState，重渲染即最新
// 2. 事件绑定：oas-input 的 oas-input/oas-clear 自定义事件走 useOasEvent（AGENTS.md 第 1 条）；
//    新建/刷新/清筛选按钮为 light DOM 原生 click，直绑 onClick；表格行事件与两个弹窗的
//    事件接线见 ./users-table.tsx / ./user-form.tsx / ./user-detail.tsx 头注释
//   （组件受控集合外的人工复位），本模版经 tableRef 做同样的事，不纳入 state
//    重渲染，columns/options/标签随 locale 自动重算（dashboard 同款模式）
// 5. 子组件拆分（单文件 ≤400 行纪律）：表格 ./users-table.tsx、表单弹窗 ./user-form.tsx、
//    详情弹窗 ./user-detail.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listUsers, removeUser } from '../data/users'
import type { UserRow, UserRole } from '../data/users'
import { listRoles, treeMenus } from '../data/system'
import type { MenuTree, RoleRow } from '../data/system'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { appMessage } from '../lib/app-message'
import { readPageSize } from '../settings-init'
import { session } from '../store/session'
import { UserDetail } from './user-detail'
import type { UserPermItem } from './user-detail'
import { UserForm } from './user-form'
import { UsersTable } from './users-table'

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

/** vanilla tagTypeForStatus / tagTypeForRole / roleTagType 段 */
function tagTypeForRole(role: UserRole): string {
  if (role === 'admin') return 'primary'
  if (role === 'editor') return 'warning'
  return 'default'
}

function roleTagType(target: UserRow): string {
  return target.roleId === 1 ? 'primary' : target.roleId === 4 ? 'default' : 'warning'
}

export default function UsersPage() {
  const { t } = useT()
  const [rows, setRows] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [menuTree, setMenuTree] = useState<MenuTree[]>([])
  const [keyword, setKeyword] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pageSize] = useState(readPageSizeNum)

  const tableRef = useRef<HTMLElement | null>(null)
  const searchRef = useRef<HTMLElement | null>(null)

  const canMutate = session.user?.role !== 'viewer'
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])

  // vanilla refresh()：并发拉用户/角色/菜单树，loading 属性包住全程
  const refresh = useCallback(async () => {
    setLoading(true)
    const [list, roleList, tree] = await Promise.all([listUsers(), listRoles(), treeMenus()])
    setRows(list)
    setRoles(roleList)
    setMenuTree(tree)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // loading → 表格 loading 属性（vanilla setAttribute/removeAttribute 同款人工通道）
  useEffect(() => {
    const table = tableRef.current
    if (!table) return
    if (loading) table.setAttribute('loading', '')
    else table.removeAttribute('loading')
  }, [loading])

  // vanilla roleName：roleId 命中角色表取角色名，否则回落枚举文案
  const roleName = useCallback(
    (target: UserRow): string => {
      if (target.roleId != null) {
        const r = roleMap.get(target.roleId)
        if (r) return r.name
      }
      return t(`users.role.${target.role}`)
    },
    [roleMap, t],
  )

  // vanilla filtered()：关键字（小写包含，姓名/邮箱）
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((r) => {
      if (kw && !(r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)))
        return false
      return true
    })
  }, [rows, keyword])

  // vanilla toDisplay()：行数据 → 展示行（角色/状态换文案）
  const dataJson = useMemo(
    () =>
      JSON.stringify(
        filtered.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: roleName(row),
          status: t(`users.status.${row.status}`),
          created: row.created,
        })),
      ),
    [filtered, roleName, t],
  )

  // vanilla userPerms()：菜单树「用户管理」节点下的 F 类权限标识
  const detailPerms = useMemo((): UserPermItem[] => {
    const target = rows.find((r) => r.id === editingId)
    if (!target) return []
    const node = findMenu(menuTree, '用户管理')
    if (!node) return []
    const perms = (node.children ?? [])
      .filter((c) => c.type === 'F')
      .map((c) => c.perms ?? '')
      .filter(Boolean)
    const allowed = new Set(ALLOWED[target.role])
    return perms.map((p) => ({ perm: p, allowed: allowed.has(p) }))
  }, [rows, editingId, menuTree])

  const detailRow = rows.find((r) => r.id === editingId) ?? null

  // vanilla 新建按钮段：无权限时禁用 + 点击守卫
  const onCreate = () => {
    if (!canMutate) return
    setEditingId(null)
    setFormOpen(true)
  }

  // vanilla 表格编辑按钮段：无权限仅提示
  const onEditRow = (id: number) => {
    if (!rows.some((r) => r.id === id)) return
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    setEditingId(id)
    setFormOpen(true)
  }

  // vanilla oas-row-click 段：打开详情（editingId 复用为详情目标，与 vanilla 同语义）
  const onRowOpen = (id: number) => {
    if (!rows.some((r) => r.id === id)) return
    setEditingId(id)
    setDetailOpen(true)
  }

  // vanilla detail-edit 段：关详情 → 开表单（回填由 user-form 的 open 边沿完成）
  const onDetailEdit = () => {
    if (!detailRow) return
    setDetailOpen(false)
    setFormOpen(true)
  }

  // vanilla delete-popconfirm oas-ok 段：权限守卫 → 删行 → 关窗 → 提示 → 刷新
  const onDelete = async () => {
    if (editingId == null) return
    if (!canMutate) {
      appMessage.error(t('common.noPerm'))
      return
    }
    await removeUser(editingId)
    setEditingId(null)
    setDetailOpen(false)
    appMessage.success(t('common.deleted'))
    void refresh()
  }

  // vanilla 搜索段：关键字变化即回第一页（current 属性人工复位）
  const backToFirstPage = () => tableRef.current?.setAttribute('current', '1')
  useOasEvent<{ value: string }>(searchRef, 'oas-input', (d) => {
    setKeyword(d.value)
    backToFirstPage()
  })
  useOasEvent(searchRef, 'oas-clear', () => {
    setKeyword('')
    backToFirstPage()
  })

  // vanilla clear-filters 段：清关键字 + 清列筛选 + 搜索框复位
  const onClearFilters = () => {
    setKeyword('')
    backToFirstPage()
    tableRef.current?.removeAttribute('filter-values')
    searchRef.current?.setAttribute('value', '')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('users.title')}</h1>
          <p className="page-subtitle">{t('users.subtitle')}</p>
        </div>
        <oas-button
          data-testid="user-create"
          type="primary"
          icon="plus"
          disabled={!canMutate || undefined}
          title={!canMutate ? t('common.noPerm') : undefined}
          aria-disabled={!canMutate ? 'true' : undefined}
          onClick={onCreate}
        >
          {t('users.new')}
        </oas-button>
      </div>
      <oas-card className="list-card" title={t('users.list')}>
        <div className="users-toolbar" slot="extra">
          <oas-input
            ref={searchRef}
            data-testid="user-search"
            placeholder={t('users.search')}
            clearable
            prefix-icon="search"
          />
          <oas-button
            id="users-refresh"
            icon="refresh"
            title={t('common.refresh')}
            onClick={() => void refresh()}
          />
        </div>
        <UsersTable
          tableRef={tableRef}
          dataJson={dataJson}
          roles={roles}
          empty={filtered.length === 0}
          pageSize={pageSize}
          onRowOpen={onRowOpen}
          onEditRow={onEditRow}
          onClearFilters={onClearFilters}
        />
      </oas-card>
      <UserForm
        open={formOpen}
        editingId={editingId}
        editing={rows.find((r) => r.id === editingId) ?? null}
        roles={roles}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          void refresh()
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
        canMutate={canMutate}
        onClose={() => setDetailOpen(false)}
        onEdit={onDetailEdit}
        onDelete={() => void onDelete()}
      />
    </div>
  )
}
