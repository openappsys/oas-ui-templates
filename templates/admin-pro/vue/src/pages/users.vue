<script setup lang="ts">
// src/pages/users.vue —— 用户管理（搜索/刷新 + 表格 + 新建/编辑弹窗 + 详情弹窗）
// 行为事实来源：vanilla-html/src/pages/users.ts（553 行，逐块对齐）
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + setAttribute 回写 + renderTable 手动刷表）；
//    本模版声明式——rows/roles/menuTree/keyword/editingId/formOpen/detailOpen 全部 ref，
//    表格 data/空态/弹窗 visible 由 state 派生；refresh() 仅重拉数据写 ref，重渲染即最新
// 2. 子组件拆分（单文件 ≤400 行纪律）：表格 ./users-table.vue、表单弹窗 ./user-form.vue、
//    详情弹窗 ./user-detail.vue；vanilla 单文件内的 ALLOWED/findMenu/userPerms/roleName
//    等纯函数留在本文件（跨子组件共享的派生逻辑单一出处）
// 3. 事件绑定：oas-input 的 oas-input/oas-clear 模板直绑（AGENTS.md 第 1 条）；
//    工具栏/空态按钮原生 click 直绑 @click；表格行事件经子组件上抛（id 语义对齐 vanilla）
// 4. 表格 current/filter-values 复位：vanilla 搜索/清除时 setAttribute/removeAttribute；
//    本模版经子组件 defineExpose 的 resetPage/clearFilterValues 走同一 attribute 通道
// 5. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换 + renderTable 重建列与行标签；
//    本模版 useT() 订阅后整页重渲染，columns（子组件内）/displayRows/规则/选项随 locale 重算
// 6. session 为模块级状态（登录后页面重挂载才变），canMutate 非响应式取值（dashboard.vue 同款）
import { computed, onMounted, ref } from 'vue'
import { listUsers, removeUser } from '../data/users'
import type { UserRow, UserRole } from '../data/users'
import { listRoles, treeMenus } from '../data/system'
import type { MenuTree, RoleRow } from '../data/system'
import { session } from '../store/session'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import UsersTable from './users-table.vue'
import type { UserDisplayRow } from './users-table.vue'
import UserForm from './user-form.vue'
import UserDetail from './user-detail.vue'
import type { PermTag } from './user-detail.vue'

// vanilla ALLOWED：角色枚举 → 允许权限标识集合（详情页标签配色依据）
const ALLOWED: Record<UserRole, string[]> = {
  admin: ['user:list', 'user:add', 'user:edit', 'user:delete'],
  editor: ['user:list', 'user:add', 'user:edit'],
  viewer: ['user:list'],
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

// vanilla canMutate()：viewer 只读
const canMutate = session.user?.role !== 'viewer'

const rows = ref<UserRow[]>([])
const roles = ref<RoleRow[]>([])
const roleMap = ref<Map<number, RoleRow>>(new Map())
const menuTree = ref<MenuTree[]>([])
const keyword = ref('')
const loading = ref(false)
const editingId = ref<number | null>(null)
const formOpen = ref(false)
const detailOpen = ref(false)

const searchRef = ref<HTMLElement | null>(null)
const tableRef = ref<InstanceType<typeof UsersTable> | null>(null)

// vanilla findMenu：权限树中按标题找 C 类节点（详情权限标识来源）
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

// vanilla roleName：roleId 命中角色表用角色名，否则本地化枚举标签
function roleName(target: UserRow): string {
  if (target.roleId != null) {
    const r = roleMap.value.get(target.roleId)
    if (r) return r.name
  }
  return tt(`users.role.${target.role}`)
}

// vanilla refresh()：并发拉用户/角色/权限树（loading 态对齐）
async function refresh(): Promise<void> {
  loading.value = true
  const [list, roleList, tree] = await Promise.all([listUsers(), listRoles(), treeMenus()])
  rows.value = list
  roles.value = roleList
  roleMap.value = new Map(roleList.map((r) => [r.id, r]))
  menuTree.value = tree
  loading.value = false
}
onMounted(() => void refresh())

// vanilla filtered()：关键字小写包含（姓名/邮箱）
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (kw && !(r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)))
      return false
    return true
  })
})

// vanilla toDisplay/renderTable：行标签本地化随 locale 重算
const displayRows = computed<UserDisplayRow[]>(() => {
  void locale.value
  return filtered.value.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: roleName(r),
    status: tt(`users.status.${r.status}`),
    created: r.created,
  }))
})
const empty = computed(() => displayRows.value.length === 0)

// vanilla 详情/编辑目标行：editingId 同时服务详情弹窗与编辑表单（fillForm 的 target）
const editingRow = computed(() => rows.value.find((r) => r.id === editingId.value) ?? null)
const detailRoleName = computed(() => {
  void locale.value
  return editingRow.value ? roleName(editingRow.value) : ''
})
// vanilla tagTypeForRole / roleTagType
function tagTypeForRole(role: UserRole): string {
  if (role === 'admin') return 'primary'
  if (role === 'editor') return 'warning'
  return 'default'
}
function roleTagTypeFor(target: UserRow): string {
  return target.roleId === 1 ? 'primary' : target.roleId === 4 ? 'default' : 'warning'
}
const detailRoleTagType = computed(() => {
  const target = editingRow.value
  if (!target) return 'default'
  return target.roleId != null ? roleTagTypeFor(target) : tagTypeForRole(target.role)
})

// vanilla userPerms/renderPerms：权限标识列表 + 允许集配色
const permTags = computed<PermTag[]>(() => {
  const node = findMenu(menuTree.value, '用户管理')
  if (!node) return []
  const perms = (node.children ?? [])
    .filter((c) => c.type === 'F')
    .map((c) => c.perms ?? '')
    .filter(Boolean)
  const allowed = new Set(ALLOWED[editingRow.value?.role ?? 'viewer'])
  return perms.map((p) => ({ perm: p, allowed: allowed.has(p) }))
})

// vanilla createBtn 段
function onCreate(): void {
  if (!canMutate) return
  editingId.value = null
  formOpen.value = true
}

// vanilla 表格行编辑按钮段
function onEditRow(id: number): void {
  const row = rows.value.find((r) => r.id === id)
  if (!row) return
  if (!canMutate) {
    appMessage.error(tt('common.noPerm'))
    return
  }
  editingId.value = id
  formOpen.value = true
}

// vanilla oas-row-click 段：定位目标行 → 开详情（回填由子组件声明式派生）
function onRowClick(id: number): void {
  const target = rows.value.find((r) => r.id === id)
  if (!target) return
  editingId.value = id
  detailOpen.value = true
}

// vanilla detail-edit 段（editingId 已在打开详情时就位）
function onDetailEdit(): void {
  if (!editingRow.value) return
  detailOpen.value = false
  formOpen.value = true
}

// vanilla delete-popconfirm oas-ok 段
async function onDelete(): Promise<void> {
  if (editingId.value == null) return
  if (!canMutate) {
    appMessage.error(tt('common.noPerm'))
    return
  }
  await removeUser(editingId.value)
  editingId.value = null
  detailOpen.value = false
  appMessage.success(tt('common.deleted'))
  void refresh()
}

function onFormSaved(): void {
  formOpen.value = false
  void refresh()
}

// vanilla search oas-input/oas-clear 段（复位表格页码走子组件暴露的 attribute 通道）
function onSearchInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value
  tableRef.value?.resetPage()
}
function onSearchClear(): void {
  keyword.value = ''
  tableRef.value?.resetPage()
}

// vanilla clear-filters 段：关键字/页码/列筛选/搜索框值全部复位
function onClearFilters(): void {
  keyword.value = ''
  tableRef.value?.resetPage()
  tableRef.value?.clearFilterValues()
  searchRef.value?.setAttribute('value', '')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('users.title') }}</h1>
        <p class="page-subtitle">{{ t('users.subtitle') }}</p>
      </div>
      <oas-button
        data-testid="user-create"
        type="primary"
        icon="plus"
        :disabled="canMutate ? null : ''"
        :title="canMutate ? null : t('common.noPerm')"
        :aria-disabled="canMutate ? null : 'true'"
        @click="onCreate"
      >
        {{ t('users.new') }}
      </oas-button>
    </div>
    <oas-card class="list-card" :title="t('users.list')">
      <div class="users-toolbar" slot="extra">
        <oas-input
          ref="searchRef"
          data-testid="user-search"
          :placeholder="t('users.search')"
          clearable
          prefix-icon="search"
          @oas-input="onSearchInput"
          @oas-clear="onSearchClear"
        />
        <oas-button id="users-refresh" icon="refresh" :title="t('common.refresh')" @click="void refresh()" />
      </div>
      <div class="table-wrap" id="table-wrap" :class="{ 'is-empty': empty }">
        <UsersTable
          ref="tableRef"
          :rows="displayRows"
          :roles="roles"
          :empty="empty"
          :loading="loading"
          @edit-row="onEditRow"
          @row-click="onRowClick"
        />
        <div class="empty-overlay" id="empty-overlay" :hidden="!empty">
          <oas-empty :description="t('users.empty')" />
          <oas-button id="clear-filters" type="primary" @click="onClearFilters">
            {{ t('common.clearFilter') }}
          </oas-button>
        </div>
      </div>
    </oas-card>
    <UserForm
      :open="formOpen"
      :editing-id="editingId"
      :editing="editingRow"
      :roles="roles"
      @close="formOpen = false"
      @saved="onFormSaved"
    />
    <UserDetail
      :open="detailOpen"
      :user="editingRow"
      :role-name="detailRoleName"
      :role-tag-type="detailRoleTagType"
      :perm-tags="permTags"
      :can-mutate="canMutate"
      @close="detailOpen = false"
      @edit="onDetailEdit"
      @delete="void onDelete()"
    />
  </div>
</template>
