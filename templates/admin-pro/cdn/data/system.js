/**
 * 系统管理数据模块：部门 / 菜单 / 角色 / 字典（自 vanilla src/data/system.ts 去 TS 移植）
 * 逻辑与种子数据逐字保留；localStorage 键名前缀按 cdn 既有约定改为 oas-admin-cdn.*
 */
import { persist, restore } from './store.js'

/**
 * @typedef {Object} DeptNode
 * @property {number} id
 * @property {string} name
 * @property {number | null} parentId
 * @property {number} members
 */

/** @typedef {'M' | 'C' | 'F'} MenuType */
/**
 * @typedef {Object} MenuNode
 * @property {number} id
 * @property {string} title
 * @property {MenuType} type
 * @property {string} [perms]
 * @property {string} [path]
 * @property {number | null} parentId
 */

/** @typedef {1 | 2 | 3 | 4 | 5} DataScope */
/**
 * @typedef {Object} RoleRow
 * @property {number} id
 * @property {string} name
 * @property {string} code
 * @property {DataScope} dataScope
 * @property {number[]} deptIds
 * @property {number} userCount
 * @property {string} created
 */

/** @typedef {DeptNode & { children: DeptTree[] }} DeptTree */
/** @typedef {MenuNode & { children: MenuTree[] }} MenuTree */
/** @typedef {{ id: number, name: string, code: string }} DictType */
/**
 * @typedef {Object} DictItem
 * @property {number} id
 * @property {number} typeId
 * @property {string} label
 * @property {string} value
 * @property {number} sort
 */

const DEPT_KEY = 'oas-admin-cdn.depts.v1'
const MENU_KEY = 'oas-admin-cdn.menus.v1'
const ROLE_KEY = 'oas-admin-cdn.roles.v1'
const DICT_TYPE_KEY = 'oas-admin-cdn.dictTypes.v1'
const DICT_ITEM_KEY = 'oas-admin-cdn.dictItems.v1'

function seedDepts() {
  const raw = [
    ['总公司', null, 8],
    ['技术部', 1, 3],
    ['市场部', 1, 2],
    ['销售部', 1, 3],
    ['华东区', 4, 2],
    ['华南区', 4, 1],
  ]
  return raw.map(([name, parentId, members], i) => ({ id: i + 1, name, parentId, members }))
}

function seedMenus() {
  const raw = [
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
    [73, '部门管理', 'C', 'system:dept:list', '/system/dept', 7],
    [74, '字典管理', 'C', 'system:dict:list', '/system/dict', 7],
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

function seedRoles() {
  const raw = [
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

function seedDictTypes() {
  return [{ id: 1, name: '订单状态', code: 'order_status' }]
}

function seedDictItems() {
  const raw = [
    [1, '待支付', 'pending', 1],
    [1, '已支付', 'paid', 2],
    [1, '配送中', 'shipping', 3],
    [1, '已完成', 'done', 4],
    [1, '已取消', 'cancelled', 5],
  ]
  return raw.map(([typeId, label, value, sort], i) => ({
    id: i + 1,
    typeId,
    label,
    value,
    sort,
  }))
}

const depts = /** @type {DeptNode[]} */ (restore(DEPT_KEY, seedDepts))
const menus = /** @type {MenuNode[]} */ (restore(MENU_KEY, seedMenus))
const roles = /** @type {RoleRow[]} */ (restore(ROLE_KEY, seedRoles))
const dictTypes = /** @type {DictType[]} */ (restore(DICT_TYPE_KEY, seedDictTypes))
const dictItems = /** @type {DictItem[]} */ (restore(DICT_ITEM_KEY, seedDictItems))
let seq = roles.length
let deptSeq = depts.length
let typeSeq = dictTypes.length
let itemSeq = dictItems.length

/** @param {*} value @param {number} [ms] */
function delay(value, ms = 100) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * 平铺列表按 parentId 组装成树
 * @template {{ id: number, parentId: number | null }} T
 * @template {{ id: number, children: R[] }} R
 * @param {T[]} list
 * @param {(item: T) => R} create
 * @returns {R[]}
 */
function nest(list, create) {
  const map = new Map()
  const roots = []
  for (const item of list) {
    const node = create(item)
    node.children = []
    map.set(item.id, node)
  }
  for (const item of list) {
    const node = map.get(item.id)
    if (item.parentId == null) roots.push(node)
    else map.get(item.parentId)?.children.push(node)
  }
  return roots
}

/** @returns {Promise<DeptNode[]>} */
export function listDepts() {
  return delay([...depts])
}

/** @returns {Promise<DeptTree[]>} */
export function treeDepts() {
  return delay(nest(depts, (d) => ({ ...d, children: [] })))
}

/** @param {Omit<DeptNode, 'id'>} data @returns {Promise<DeptNode>} */
export function createDept(data) {
  const row = { ...data, id: ++deptSeq }
  depts.push(row)
  persist(DEPT_KEY, depts)
  return delay(row)
}

/**
 * @param {number} id
 * @param {Partial<Omit<DeptNode, 'id'>>} data
 * @returns {Promise<DeptNode | null>}
 */
export function updateDept(id, data) {
  const i = depts.findIndex((d) => d.id === id)
  if (i === -1) return delay(null)
  depts[i] = { ...depts[i], ...data }
  persist(DEPT_KEY, depts)
  return delay(depts[i])
}

/** @param {number} id @returns {Promise<boolean>} */
export function removeDept(id) {
  const i = depts.findIndex((d) => d.id === id)
  if (i === -1) return delay(false)
  depts.splice(i, 1)
  persist(DEPT_KEY, depts)
  return delay(true)
}

/** @returns {Promise<DictType[]>} */
export function listDictTypes() {
  return delay([...dictTypes])
}

/** @param {Omit<DictType, 'id'>} data @returns {Promise<DictType>} */
export function createDictType(data) {
  const row = { ...data, id: ++typeSeq }
  dictTypes.push(row)
  persist(DICT_TYPE_KEY, dictTypes)
  return delay(row)
}

/**
 * @param {number} id
 * @param {Partial<Omit<DictType, 'id'>>} data
 * @returns {Promise<DictType | null>}
 */
export function updateDictType(id, data) {
  const i = dictTypes.findIndex((t) => t.id === id)
  if (i === -1) return delay(null)
  dictTypes[i] = { ...dictTypes[i], ...data }
  persist(DICT_TYPE_KEY, dictTypes)
  return delay(dictTypes[i])
}

/** @param {number} id @returns {Promise<boolean>} */
export function removeDictType(id) {
  const i = dictTypes.findIndex((t) => t.id === id)
  if (i === -1) return delay(false)
  dictTypes.splice(i, 1)
  for (let k = dictItems.length - 1; k >= 0; k--) {
    if (dictItems[k].typeId === id) dictItems.splice(k, 1)
  }
  persist(DICT_TYPE_KEY, dictTypes)
  persist(DICT_ITEM_KEY, dictItems)
  return delay(true)
}

/** @param {number} typeId @returns {Promise<DictItem[]>} */
export function listDictItems(typeId) {
  return delay(dictItems.filter((d) => d.typeId === typeId))
}

/** @param {Omit<DictItem, 'id'>} data @returns {Promise<DictItem>} */
export function createDictItem(data) {
  const row = { ...data, id: ++itemSeq }
  dictItems.push(row)
  persist(DICT_ITEM_KEY, dictItems)
  return delay(row)
}

/**
 * @param {number} id
 * @param {Partial<Omit<DictItem, 'id'>>} data
 * @returns {Promise<DictItem | null>}
 */
export function updateDictItem(id, data) {
  const i = dictItems.findIndex((d) => d.id === id)
  if (i === -1) return delay(null)
  dictItems[i] = { ...dictItems[i], ...data }
  persist(DICT_ITEM_KEY, dictItems)
  return delay(dictItems[i])
}

/** @param {number} id @returns {Promise<boolean>} */
export function removeDictItem(id) {
  const i = dictItems.findIndex((d) => d.id === id)
  if (i === -1) return delay(false)
  dictItems.splice(i, 1)
  persist(DICT_ITEM_KEY, dictItems)
  return delay(true)
}

/** @returns {Promise<MenuNode[]>} */
export function listMenus() {
  return delay([...menus])
}

/** @returns {Promise<MenuTree[]>} */
export function treeMenus() {
  return delay(nest(menus, (m) => ({ ...m, children: [] })))
}

/** @returns {Promise<RoleRow[]>} */
export function listRoles() {
  return delay([...roles])
}

/** @param {Omit<RoleRow, 'id' | 'created'>} data @returns {Promise<RoleRow>} */
export function createRole(data) {
  const row = {
    ...data,
    id: ++seq,
    created: new Date().toISOString().slice(0, 10),
  }
  roles.unshift(row)
  persist(ROLE_KEY, roles)
  return delay(row)
}

/**
 * @param {number} id
 * @param {Partial<Omit<RoleRow, 'id'>>} data
 * @returns {Promise<RoleRow | null>}
 */
export function updateRole(id, data) {
  const i = roles.findIndex((r) => r.id === id)
  if (i === -1) return delay(null)
  roles[i] = { ...roles[i], ...data }
  persist(ROLE_KEY, roles)
  return delay(roles[i])
}

/** @param {number} id @returns {Promise<boolean>} */
export function removeRole(id) {
  const i = roles.findIndex((r) => r.id === id)
  if (i === -1) return delay(false)
  roles.splice(i, 1)
  persist(ROLE_KEY, roles)
  return delay(true)
}

export function resetSystem() {
  depts.length = 0
  depts.push(...seedDepts())
  menus.length = 0
  menus.push(...seedMenus())
  roles.length = 0
  roles.push(...seedRoles())
  dictTypes.length = 0
  dictTypes.push(...seedDictTypes())
  dictItems.length = 0
  dictItems.push(...seedDictItems())
  seq = roles.length
  deptSeq = depts.length
  typeSeq = dictTypes.length
  itemSeq = dictItems.length
  localStorage.removeItem(DEPT_KEY)
  localStorage.removeItem(MENU_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(DICT_TYPE_KEY)
  localStorage.removeItem(DICT_ITEM_KEY)
}
