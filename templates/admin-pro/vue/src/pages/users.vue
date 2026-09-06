<script setup lang="ts">
// src/pages/users.vue —— 用户管理（搜索/刷新 + 表格 + 新建/编辑弹窗 + 详情弹窗）
//    本模版声明式——rows/roles/menuTree/keyword/editingId/formOpen/detailOpen 全部 ref，
//    表格 data/空态/弹窗 visible 由 state 派生；refresh() 仅重拉数据写 ref，重渲染即最新
// 2. 子组件拆分（单文件 ≤400 行纪律）：表格 ./users-table.vue、表单弹窗 ./user-form.vue、
//    等纯函数留在本文件（跨子组件共享的派生逻辑单一出处）
//    本模版经子组件 defineExpose 的 resetPage/clearFilterValues 走同一 attribute 通道
//    本模版 useT() 订阅后整页重渲染，columns（子组件内）/displayRows/规则/选项随 locale 重算
// 6. session 走 Pinia store（登录后页面重挂载才变），canMutate 非响应式取值（dashboard.vue 同款）
import { computed, onMounted, ref } from 'vue'
import { removeUser } from '../data/users'
import type { UserRow, UserRole } from '../data/users'
import type { MenuTree } from '../data/system'
import { useT } from '../composables/use-t'
import { useUsersList } from '../composables/use-users'
import { appMessage } from '../lib/app-message'
import { useSessionStore } from '../stores/session'
import UsersTable from './users-table.vue'
import type { UserDisplayRow } from './users-table.vue'
import UserForm from './user-form.vue'
import UserDetail from './user-detail.vue'
import type { PermTag } from './user-detail.vue'

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

// 会话/数据：会话从 Pinia store 快照取值；列表数据走 useUsersList composable
const canMutate = useSessionStore().user?.role !== 'viewer'

const keyword = ref('')
const editingId = ref<number | null>(null)
const formOpen = ref(false)
const detailOpen = ref(false)

const { rows, roles, roleMap, menuTree, loading, refresh } = useUsersList()

const searchRef = ref<HTMLElement | null>(null)
const tableRef = ref<InstanceType<typeof UsersTable> | null>(null)

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

function roleName(target: UserRow): string {
  if (target.roleId != null) {
    const r = roleMap.value.get(target.roleId)
    if (r) return r.name
  }
  return tt(`users.role.${target.role}`)
}

onMounted(() => void refresh())

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (kw && !(r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw)))
      return false
    return true
  })
})

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

const editingRow = computed(() => rows.value.find((r) => r.id === editingId.value) ?? null)
const detailRoleName = computed(() => {
  void locale.value
  return editingRow.value ? roleName(editingRow.value) : ''
})
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

function onCreate(): void {
  if (!canMutate) return
  editingId.value = null
  formOpen.value = true
}

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

function onRowClick(id: number): void {
  const target = rows.value.find((r) => r.id === id)
  if (!target) return
  editingId.value = id
  detailOpen.value = true
}

function onDetailEdit(): void {
  if (!editingRow.value) return
  detailOpen.value = false
  formOpen.value = true
}

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

function onSearchInput(e: Event): void {
  keyword.value = (e as CustomEvent<{ value: string }>).detail.value
  tableRef.value?.resetPage()
}
function onSearchClear(): void {
  keyword.value = ''
  tableRef.value?.resetPage()
}

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
