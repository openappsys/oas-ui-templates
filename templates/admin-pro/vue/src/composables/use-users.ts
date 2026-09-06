// src/composables/use-users.ts —— 用户领域数据 composable
// 列表 + 角色 + 菜单树一次性拉取（原 users.vue refresh 的数据逻辑，loading 状态随行）
import { ref } from 'vue'
import { listUsers } from '../data/users'
import type { UserRow } from '../data/users'
import { listRoles, treeMenus } from '../data/system'
import type { MenuTree, RoleRow } from '../data/system'

export function useUsersList() {
  const rows = ref<UserRow[]>([])
  const roles = ref<RoleRow[]>([])
  /** roleId → 角色（表格/详情展示角色名用） */
  const roleMap = ref<Map<number, RoleRow>>(new Map())
  const menuTree = ref<MenuTree[]>([])
  const loading = ref(false)

  async function refresh(): Promise<void> {
    loading.value = true
    const [list, roleList, tree] = await Promise.all([listUsers(), listRoles(), treeMenus()])
    rows.value = list
    roles.value = roleList
    roleMap.value = new Map(roleList.map((r) => [r.id, r]))
    menuTree.value = tree
    loading.value = false
  }

  return { rows, roles, roleMap, menuTree, loading, refresh }
}
