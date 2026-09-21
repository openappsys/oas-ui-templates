/**
 * 树操作辅助（自 vanilla menus.ts / dept.ts 内联函数抽取共享，逻辑逐字保留）
 */

/**
 * 树节点平铺为列表
 * @template {{ children?: *[] }} N
 * @param {N[]} nodes
 * @returns {N[]}
 */
export function flattenTree(nodes) {
  const out = []
  const walk = (list) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/**
 * 按 id 深度查找节点
 * @template {{ id: number, children?: *[] }} N
 * @param {N[]} nodes
 * @param {number} id
 * @returns {N | null}
 */
export function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

/**
 * 查某节点的父节点 id
 * @param {*[]} nodes
 * @param {number} id
 * @returns {number | null}
 */
export function parentOf(nodes, id) {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n.id
    if (n.children?.length) {
      const p = parentOf(n.children, id)
      if (p !== null) return p
    }
  }
  return null
}

/**
 * 从树中移除节点（原地 splice）
 * @param {*[]} nodes
 * @param {number} id
 * @returns {boolean}
 */
export function removeNode(nodes, id) {
  const i = nodes.findIndex((n) => n.id === id)
  if (i !== -1) {
    nodes.splice(i, 1)
    return true
  }
  for (const n of nodes) {
    if (n.children?.length && removeNode(n.children, id)) return true
  }
  return false
}

/**
 * 收集某节点的全部后代 id（不含自身）
 * @param {*[]} nodes
 * @param {number} id
 * @returns {Set<number>}
 */
export function descendants(nodes, id) {
  const set = new Set()
  const node = findNode(nodes, id)
  const walk = (list) => {
    for (const n of list) {
      set.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  if (node) walk(node.children ?? [])
  return set
}

/**
 * 把 child 挂到指定 parent 下（parentId 为 null 时挂根层）
 * @param {*[]} nodes
 * @param {number | null} parentId
 * @param {{ id: number, children?: *[] }} child
 */
export function insertChild(nodes, parentId, child) {
  if (parentId == null) {
    nodes.push(child)
    return
  }
  const parent = findNode(nodes, parentId)
  if (parent) {
    if (!parent.children) parent.children = []
    parent.children.push(child)
  }
}

/**
 * 有子节点的节点 id 集合 → 展开键数组（字符串）
 * 树 expanded 契约（oas-ui 2.5.0）：JSON.stringify(字符串数组)，逗号串会静默全折叠
 * @param {*[]} nodes
 * @returns {string[]}
 */
export function expandKeys(nodes) {
  const keys = []
  const walk = (list) => {
    for (const n of list) {
      if (n.children?.length) {
        keys.push(String(n.id))
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return keys
}

/**
 * 菜单树 → oas-tree data 节点（自 vanilla menus.ts toTreeNodes 移植）
 * @param {{ id: number, title: string, type: string, perms?: string, path?: string, children?: *[] }} nodes
 * @returns {Array<Record<string, unknown>>}
 */
export function toMenuTreeNodes(nodes) {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.title,
    type: n.type,
    perms: n.perms ?? '',
    path: n.path ?? '',
    children: n.children?.length ? toMenuTreeNodes(n.children) : [],
  }))
}

/**
 * 目录类型菜单 path → 权限标识自动推导（自 vanilla menus.ts autoPerms 移植）
 * @param {'M' | 'C' | 'F'} type
 * @param {string} path
 * @returns {string}
 */
export function autoPerms(type, path) {
  if (type !== 'C') return ''
  const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
  const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return mod ? `${mod}:list` : ''
}
