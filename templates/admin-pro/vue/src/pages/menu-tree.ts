// src/pages/menu-tree.ts —— 菜单页树辅助函数（menus.vue 与 menu-form-drawer.vue 共用）
import type { MenuTree, MenuType } from '../data/system'

// 抽屉上抛的提交载荷（menus.vue 校验与树变更时消费）
export interface MenuFormPayload {
  name: string
  type: MenuType
  perms: string
  path: string
  parentId: number | null
}

export function flattenTree(nodes: MenuTree[]): MenuTree[] {
  const out: MenuTree[] = []
  const walk = (list: MenuTree[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export function findNode(nodes: MenuTree[], id: number): MenuTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

export function parentOf(nodes: MenuTree[], id: number): number | null {
  for (const n of nodes) {
    if (n.children?.some((c) => c.id === id)) return n.id
    if (n.children?.length) {
      const p = parentOf(n.children, id)
      if (p !== null) return p
    }
  }
  return null
}

export function removeNode(nodes: MenuTree[], id: number): boolean {
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

export function descendants(nodes: MenuTree[], id: number): Set<number> {
  const set = new Set<number>()
  const node = findNode(nodes, id)
  const walk = (list: MenuTree[]) => {
    for (const n of list) {
      set.add(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  if (node) walk(node.children ?? [])
  return set
}

export function toTreeNodes(nodes: MenuTree[]): Array<Record<string, unknown>> {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.title,
    type: n.type,
    perms: n.perms ?? '',
    path: n.path ?? '',
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

export function autoPerms(type: MenuType, path: string): string {
  if (type !== 'C') return ''
  const seg = (path || '').replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
  const mod = seg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return mod ? `${mod}:list` : ''
}

export function expandKeys(nodes: MenuTree[]): string[] {
  const keys: string[] = []
  const walk = (list: MenuTree[]) => {
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

export function insertChild(nodes: MenuTree[], parentId: number | null, child: MenuTree): void {
  if (parentId == null) {
    nodes.push(child)
    return
  }
  const parent = findNode(nodes, parentId)
  if (parent) {
    ;(parent.children ??= []).push(child)
  }
}

// vanilla nextId()：全树最大 id + 1
export function nextIdOf(nodes: MenuTree[]): number {
  return flattenTree(nodes).reduce((m, n) => Math.max(m, n.id), 0) + 1
}
