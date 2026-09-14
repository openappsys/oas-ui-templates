/**
 * 用户页共享助手（自 vanilla src/pages/users.ts 去 TS 移植：列定义 / 校验规则 /
 * 权限映射 / 菜单查找等纯函数，供 pages-users.js 消费）
 */
import { t } from './i18n.js'

export const SESSION_KEY = 'oas-admin-cdn.session'
export const PAGE_SIZE_KEY = 'oas-admin-cdn.settings.page-size'

/** 每页条数跟随设置中心（settings 页 page-size，默认 5） */
export function pageSize() {
  const raw = localStorage.getItem(PAGE_SIZE_KEY)
  return Number(raw) || 5
}

export const ALLOWED = {
  admin: ['user:list', 'user:add', 'user:edit', 'user:delete'],
  editor: ['user:list', 'user:add', 'user:edit'],
  viewer: ['user:list'],
}

export function roleLabel(role) {
  return t(`users.role.${role}`)
}

export function statusLabel(status) {
  return t(`users.status.${status}`)
}

export function cellAction(row) {
  const edit = document.createElement('oas-button')
  edit.className = 'user-row-edit'
  edit.setAttribute('data-testid', 'user-row-edit')
  edit.setAttribute('data-id', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('icon', 'edit')
  edit.setAttribute('aria-label', t('common.edit'))
  return edit
}

export function fromPath(path, selector) {
  for (const item of path) {
    if (item instanceof HTMLElement && item.matches(selector)) return item
  }
  return null
}

export const COLUMNS = (roleFilters) => [
  { key: 'id', title: 'ID', width: '60px' },
  { key: 'name', title: t('users.name') },
  { key: 'email', title: t('users.email') },
  { key: 'role', title: t('users.role'), filterable: true, filters: roleFilters },
  {
    key: 'status',
    title: t('users.status'),
    filterable: true,
    filters: [
      { label: statusLabel('active'), value: statusLabel('active') },
      { label: statusLabel('disabled'), value: statusLabel('disabled') },
    ],
  },
  { key: 'created', title: t('users.created'), sortable: true },
  {
    key: 'action',
    title: t('users.th.action'),
    width: '80px',
    render: (r) => cellAction(r),
  },
]

export const RULES = () =>
  JSON.stringify({
    name: [{ required: true, message: t('users.rule.name') }],
    email: [
      { required: true, message: t('users.rule.email') },
      { pattern: '^\\S+@\\S+$', message: t('users.rule.emailFmt') },
    ],
  })

export function findMenu(nodes, title) {
  for (const n of nodes) {
    if (n.title === title && n.type === 'C') return n
    if (n.children?.length) {
      const f = findMenu(n.children, title)
      if (f) return f
    }
  }
  return null
}

export function roleEnumFor(roleRow) {
  if (!roleRow) return 'viewer'
  if (roleRow.code === 'super_admin') return 'admin'
  if (roleRow.code === 'viewer') return 'viewer'
  return 'editor'
}

export function canMutate() {
  const user = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  return user?.role !== 'viewer'
}

export function roleTagType(target) {
  return target.roleId === 1 ? 'primary' : target.roleId === 4 ? 'default' : 'warning'
}
