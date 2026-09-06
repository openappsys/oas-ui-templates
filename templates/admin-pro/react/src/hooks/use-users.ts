// src/hooks/use-users.ts —— 用户域的 TanStack Query hooks
// 查询：用户列表；变更：create/update/remove，成功后失效用户缓存
// 角色列表/菜单树属 system 域（见 use-system.ts），用户页经 useRolesList/useMenuTree 组合
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, listUsers, removeUser, updateUser } from '../data/users'
import type { UserRow } from '../data/users'

export const userKeys = {
  all: ['users'] as const,
  list: () => ['users', 'list'] as const,
}

/** 用户列表 */
export function useUsersList() {
  return useQuery({ queryKey: userKeys.list(), queryFn: listUsers })
}

/** 用户变更集：成功后失效用户列表 */
export function useUserMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: userKeys.all })

  const create = useMutation({ mutationFn: createUser, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<UserRow, 'id'>> }) =>
      updateUser(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: removeUser, onSuccess: invalidate })
  return { create, update, remove }
}
