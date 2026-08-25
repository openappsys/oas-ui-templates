import { persist, restore } from './store'

export interface DeptNode {
  id: number
  name: string
  parentId: number | null
}

export type MenuType = 'M' | 'C' | 'F'

export interface MenuNode {
  id: number
  title: string
  type: MenuType
  perms?: string
  path?: string
  parentId: number | null
}

export type DataScope = 1 | 2 | 3 | 4 | 5

export interface RoleRow {
  id: number
  name: string
  code: string
  dataScope: DataScope
  deptIds: number[]
  userCount: number
  created: string
}

export interface DeptTree extends DeptNode {
  children: DeptTree[]
}

export interface MenuTree extends MenuNode {
  children: MenuTree[]
}

const DEPT_KEY = 'oas-admin.depts.v1'
const MENU_KEY = 'oas-admin.menus.v1'
const ROLE_KEY = 'oas-admin.roles.v1'

function seedDepts(): DeptNode[] {
  const raw: Array<[string, number | null]> = [
    ['总公司', null],
    ['技术部', 1],
    ['市场部', 1],
    ['销售部', 1],
    ['华东区', 4],
    ['华南区', 4],
  ]
  return raw.map(([name, parentId], i) => ({ id: i + 1, name, parentId }))
}

function seedMenus(): MenuNode[] {
  const raw: Array<[number, string, MenuType, string | null, string | null, number | null]> = [
    [1, '仪表盘', 'C', 'dashboard:list', '/dashboard', null],
    [2, '订单管理', 'C', 'order:list', '/orders', null],
    [21, '订单:列表', 'F', 'order:list', null, 2],
    [22, '订单:导出', 'F', 'order:export', null, 2],
    [3, '商品管理', 'C', 'product:list', '/products', null],
    [31, '商品:列表', 'F', 'product:list', null, 3],
    [32, '商品:新增', 'F', 'product:add', null, 3],
    [33, '商品:编辑', 'F', 'product:edit', null, 3],
    [34, '商品:删除', 'F', 'product:delete', null, 3],
    [35, '商品:上架下架', 'F', 'product:toggle', null, 3],
    [4, '用户管理', 'C', 'user:list', '/users', null],
    [41, '用户:列表', 'F', 'user:list', null, 4],
    [42, '用户:新增', 'F', 'user:add', null, 4],
    [43, '用户:编辑', 'F', 'user:edit', null, 4],
    [44, '用户:删除', 'F', 'user:delete', null, 4],
    [5, '创建订单', 'C', 'order:create', '/form', null],
    [6, '个人中心', 'C', 'profile:list', '/profile', null],
    [7, '系统管理', 'M', null, null, null],
    [71, '权限管理', 'C', 'system:menu:list', '/system/menus', 7],
    [72, '角色管理', 'C', 'system:role:list', '/system/roles', 7],
    [73, '部门管理', 'C', 'system:dept:list', '/system/depts', 7],
    [74, '字典管理', 'C', 'system:dict:list', '/system/dicts', 7],
    [75, '日志中心', 'C', 'system:log:list', '/system/logs', 7],
  ]
  return raw.map(([id, title, type, perms, path, parentId]) => ({
    id,
    title,
    type,
    perms: perms ?? undefined,
    path: path ?? undefined,
    parentId,
  }))
}

function seedRoles(): RoleRow[] {
  const raw: Array<[string, string, DataScope, number[], number, string]> = [
    ['超级管理员', 'super_admin', 1, [], 1, '2026-01-05'],
    ['运营经理', 'ops_manager', 2, [2, 3], 3, '2026-02-11'],
    ['销售主管', 'sales_manager', 3, [], 5, '2026-03-19'],
    ['访客', 'viewer', 5, [], 8, '2026-04-02'],
  ]
  return raw.map(([name, code, dataScope, deptIds, userCount, created], i) => ({
    id: i + 1,
    name,
    code,
    dataScope,
    deptIds,
    userCount,
    created,
  }))
}

const depts: DeptNode[] = restore(DEPT_KEY, seedDepts)
const menus: MenuNode[] = restore(MENU_KEY, seedMenus)
const roles: RoleRow[] = restore(ROLE_KEY, seedRoles)
let seq = roles.length

function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function nest<
  T extends { id: number; parentId: number | null },
  R extends { id: number; children: R[] },
>(list: T[], create: (item: T) => R): R[] {
  const map = new Map<number, R>()
  const roots: R[] = []
  for (const item of list) {
    const node = create(item)
    node.children = []
    map.set(item.id, node)
  }
  for (const item of list) {
    const node = map.get(item.id)!
    if (item.parentId == null) roots.push(node)
    else map.get(item.parentId)?.children.push(node)
  }
  return roots
}

export function listDepts(): Promise<DeptNode[]> {
  return delay([...depts])
}

export function treeDepts(): Promise<DeptTree[]> {
  return delay(nest<DeptNode, DeptTree>(depts, (d) => ({ ...d, children: [] }) as DeptTree))
}

export function listMenus(): Promise<MenuNode[]> {
  return delay([...menus])
}

export function treeMenus(): Promise<MenuTree[]> {
  return delay(nest<MenuNode, MenuTree>(menus, (m) => ({ ...m, children: [] }) as MenuTree))
}

export function listRoles(): Promise<RoleRow[]> {
  return delay([...roles])
}

export function createRole(data: Omit<RoleRow, 'id' | 'created'>): Promise<RoleRow> {
  const row: RoleRow = {
    ...data,
    id: ++seq,
    created: new Date().toISOString().slice(0, 10),
  }
  roles.unshift(row)
  persist(ROLE_KEY, roles)
  return delay(row)
}

export function updateRole(
  id: number,
  data: Partial<Omit<RoleRow, 'id'>>,
): Promise<RoleRow | null> {
  const i = roles.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  roles[i] = { ...roles[i], ...data }
  persist(ROLE_KEY, roles)
  return delay(roles[i])
}

export function removeRole(id: number): Promise<boolean> {
  const i = roles.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  roles.splice(i, 1)
  persist(ROLE_KEY, roles)
  return delay(true)
}

export function resetSystem(): void {
  depts.length = 0
  depts.push(...seedDepts())
  menus.length = 0
  menus.push(...seedMenus())
  roles.length = 0
  roles.push(...seedRoles())
  seq = roles.length
  localStorage.removeItem(DEPT_KEY)
  localStorage.removeItem(MENU_KEY)
  localStorage.removeItem(ROLE_KEY)
}
