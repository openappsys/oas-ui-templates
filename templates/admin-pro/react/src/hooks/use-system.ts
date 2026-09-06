// src/hooks/use-system.ts —— system 域（角色/部门/菜单/字典）的 TanStack Query hooks
// 查询按资源拆 key（roles/menus/depts/dict），变更成功后失效对应子树；
// 字典键值计数按类型 id 派生 key，条目查询按选中类型 id 启用
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDept,
  createDictItem,
  createDictType,
  createRole,
  listDepts,
  listDictItems,
  listDictTypes,
  listRoles,
  removeDept,
  removeDictItem,
  removeRole,
  treeDepts,
  treeMenus,
  updateDept,
  updateDictItem,
  updateDictType,
  updateRole,
} from '../data/system'
import type { DeptTree, DictItem, DictType, RoleRow } from '../data/system'

export const systemKeys = {
  roles: () => ['system', 'roles'] as const,
  menus: () => ['system', 'menus'] as const,
  depts: () => ['system', 'depts'] as const,
  deptTree: () => ['system', 'dept-tree'] as const,
  dictTypes: () => ['system', 'dict-types'] as const,
  dictCounts: (ids: number[]) => ['system', 'dict-counts', ids] as const,
  dictItems: (typeId: number) => ['system', 'dict-items', typeId] as const,
}

/** 角色列表（users 页/roles 页共享缓存） */
export function useRolesList() {
  return useQuery({ queryKey: systemKeys.roles(), queryFn: listRoles })
}

/** 菜单树（users 页权限面板 / menus 页树共享） */
export function useMenuTree() {
  return useQuery({ queryKey: systemKeys.menus(), queryFn: treeMenus })
}

/** 部门平铺列表 */
export function useDeptList() {
  return useQuery({ queryKey: systemKeys.depts(), queryFn: listDepts })
}

/** 部门树 */
export function useDeptTree() {
  return useQuery({ queryKey: systemKeys.deptTree(), queryFn: treeDepts })
}

/** 字典类型列表 */
export function useDictTypes() {
  return useQuery({ queryKey: systemKeys.dictTypes(), queryFn: listDictTypes })
}

/** 各类型的键值条数（左列表徽标）：类型集合变化即重取 */
export function useDictCounts(types: DictType[]) {
  const ids = types.map((t) => t.id)
  return useQuery({
    queryKey: systemKeys.dictCounts(ids),
    queryFn: async () => {
      const entries = await Promise.all(
        types.map(async (t) => [t.id, (await listDictItems(t.id)).length] as const),
      )
      return Object.fromEntries(entries) as Record<number, number>
    },
    enabled: types.length > 0,
    // 空类型集合时占位空对象，调用方无需判 undefined
    placeholderData: {},
  })
}

/** 指定类型下的键值条目（选中类型为 null 时不发请求） */
export function useDictItems(typeId: number | null) {
  return useQuery({
    queryKey: systemKeys.dictItems(typeId ?? 0),
    queryFn: () => listDictItems(typeId ?? 0),
    enabled: typeId != null,
  })
}

/** 角色变更集 */
export function useRoleMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: systemKeys.roles() })

  const create = useMutation({
    mutationFn: (data: Omit<RoleRow, 'id' | 'created'>) => createRole(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<RoleRow, 'id'>> }) =>
      updateRole(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: removeRole, onSuccess: invalidate })
  return { create, update, remove }
}

/** 部门变更集：平铺列表与树同源，一并失效 */
export function useDeptMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: systemKeys.depts() })
    void qc.invalidateQueries({ queryKey: systemKeys.deptTree() })
  }

  const create = useMutation({
    mutationFn: (data: Omit<DeptTree, 'id' | 'children'>) => createDept(data),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DeptTree, 'id'>> }) =>
      updateDept(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: removeDept, onSuccess: invalidate })
  return { create, update, remove }
}

/** 字典变更集：类型与条目同一 ['system','dict'] 前缀失效（计数/条目/列表联动重取） */
export function useDictMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: systemKeys.dictTypes() })
    void qc.invalidateQueries({ queryKey: ['system', 'dict-counts'] })
    void qc.invalidateQueries({ queryKey: ['system', 'dict-items'] })
  }

  const createType = useMutation({
    mutationFn: (data: Omit<DictType, 'id'>) => createDictType(data),
    onSuccess: invalidate,
  })
  const updateType = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DictType, 'id'>> }) =>
      updateDictType(id, data),
    onSuccess: invalidate,
  })
  const createItem = useMutation({
    mutationFn: (data: Omit<DictItem, 'id'>) => createDictItem(data),
    onSuccess: invalidate,
  })
  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<DictItem, 'id'>> }) =>
      updateDictItem(id, data),
    onSuccess: invalidate,
  })
  const removeItem = useMutation({ mutationFn: removeDictItem, onSuccess: invalidate })
  return { createType, updateType, createItem, updateItem, removeItem }
}
