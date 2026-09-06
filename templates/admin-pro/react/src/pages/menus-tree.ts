// src/pages/menus-tree.ts —— 权限管理的纯树操作助手（menus.tsx / menus-form-drawer.tsx 共用）
import type { MenuTree } from '../data/system'

/** vanilla findNode */
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

/** vanilla parentOf */
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

/** vanilla removeNode（原地删除） */
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

/** vanilla descendants：id 节点的全部后代（不含自身） */
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

/** vanilla toTreeNodes */
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

/** vanilla insertChild */
export function insertChild(
  nodes: MenuTree[],
  parentId: number | null,
  child: MenuTree,
): void {
  if (parentId == null) {
    nodes.push(child)
    return
  }
  const parent = findNode(nodes, parentId)
  if (parent) {
    ;(parent.children ??= []).push(child)
  }
}
