<script setup lang="ts">
// src/pages/roles.vue —— 角色管理：表格（数据权限标签 + 行编辑/popconfirm 删除）+ 新建/编辑抽屉
// 行为事实来源：vanilla-html/src/pages/roles.ts（352 行，逐块对齐）。
// 偏差记录（因果链）：
// 1. 渲染模型：vanilla 全程 imperative（innerHTML + renderTable 手动刷表）；本模版声明式——
//    roles/deptList/editingId/drawerOpen 全部 ref，表格数据由 state 派生
// 2. 子组件拆分（单文件 ≤400 行纪律）：表单抽屉 ./role-form-drawer.vue（RULES/fillForm/
//    数据权限单选/穿梭框/oas-submit 段）；表格列 render（权限标签/操作列）保留本文件
//    （vanilla scopeCell/actionCell）
// 3. columns 含 render 函数走 property 通道（users-table.vue 同款）；data 走 JSON 字符串
//    通道（AGENTS.md 第 3 条）；行编辑按钮经 @click composedPath 匹配（category.vue 同款）；
//    删除从 oas-ok 的 detail.source 带 data-del 反查（v2.2.8 popconfirm 原生自驱动）
// 4. 文案刷新：vanilla onLocaleChange(refreshText) 逐节点替换 + renderTable 重建列；
//    本模版 useT() 订阅后整页重渲染，columns（含行内标签）随 locale 自动重算
import { computed, onMounted, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import { listRoles, removeRole, treeDepts } from '../data/system'
import type { DataScope, DeptTree, RoleRow } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import RoleFormDrawer from './role-form-drawer.vue'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

function dataScopeLabel(scope: DataScope): string {
  return tt(`roles.scope.${scope}`)
}

// vanilla DATA_SCOPE_TAG：数据权限标签配色
const DATA_SCOPE_TAG: Record<DataScope, string> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'info',
  5: 'default',
}

// ---- 页面状态（对齐 vanilla PageState） ----
const roles = ref<RoleRow[]>([])
const deptList = ref<DeptTree[]>([])
const editingId = ref<number | null>(null)
const drawerOpen = ref(false)

const editing = computed(() => roles.value.find((r) => r.id === editingId.value) ?? null)

// vanilla flatten()
function flatten(roots: DeptTree[]): DeptTree[] {
  const out: DeptTree[] = []
  const walk = (nodes: DeptTree[]) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return out
}

// vanilla scopeCell：数据权限标签
function scopeCell(row: RoleRow): HTMLElement {
  const tag = document.createElement('oas-tag')
  tag.setAttribute('type', DATA_SCOPE_TAG[row.dataScope])
  tag.textContent = dataScopeLabel(row.dataScope)
  return tag
}

// vanilla actionCell：行内编辑按钮 + popconfirm 包裹的删除按钮（data-del 反查来源）
function actionCell(row: RoleRow): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(row.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = tt('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(row.id))
  pop.setAttribute('title', tt('roles.confirmDelete'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = tt('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

// vanilla TABLE_COLUMNS()（标签/行内标签随 locale 重算）
const columns = computed<TableColumn[]>(() => {
  void locale.value
  return [
    { key: 'name', title: tt('roles.th.name') },
    { key: 'code', title: tt('roles.th.code') },
    { key: 'dataScope', title: tt('roles.th.dataScope'), render: (r) => scopeCell(r as unknown as RoleRow) },
    { key: 'userCount', title: tt('roles.th.userCount'), align: 'right' },
    { key: 'created', title: tt('roles.th.created') },
    { key: 'action', title: tt('roles.th.action'), render: (r) => actionCell(r as unknown as RoleRow) },
  ]
})

// data 走 JSON 字符串通道（AGENTS.md 第 3 条）
const rowsJson = computed(() => JSON.stringify(roles.value))

// vanilla refresh()：角色 + 部门平铺
async function refresh(): Promise<void> {
  const [rows, deptTree] = await Promise.all([listRoles(), treeDepts()])
  roles.value = rows
  deptList.value = flatten(deptTree)
}
onMounted(() => void refresh())

// vanilla role-create 段：openForm(null)
function onCreate(): void {
  editingId.value = null
  drawerOpen.value = true
}

// vanilla table click 段：composedPath 匹配行内编辑按钮 → openForm(row)
// （v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open）
function onTableClick(e: MouseEvent): void {
  const btn = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
  if (!btn) return
  const row = roles.value.find((r) => r.id === Number(btn.getAttribute('data-edit')))
  if (row) {
    editingId.value = row.id
    drawerOpen.value = true
  }
}

// vanilla onDeleteOk：oas-ok 的 detail.source 带 data-del 反查来源 → 删除 → 提示 + 刷新
function onDeleteOk(e: Event): void {
  const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
  if (!src?.hasAttribute?.('data-del')) return
  void removeRole(Number(src.getAttribute('data-del'))).then((ok) => {
    if (!ok) appMessage.error(t('roles.notFound'))
    else appMessage.success(tt('common.deleted'))
    void refresh()
  })
}

// vanilla oas-submit 段收尾（持久化在抽屉子组件）：关闭抽屉 + 清编辑态 + 刷新
function onFormSaved(): void {
  drawerOpen.value = false
  editingId.value = null
  void refresh()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.roles') }}</h1>
        <p class="page-subtitle">{{ t('roles.subtitle') }}</p>
      </div>
      <oas-button data-testid="role-create" type="primary" icon="plus" @click="onCreate">
        {{ t('roles.new') }}
      </oas-button>
    </div>
    <oas-card class="list-card" :title="t('roles.list')">
      <div class="table-wrap">
        <oas-table
          data-testid="roles-table"
          row-key="id"
          :empty-text="t('roles.empty')"
          :columns="columns"
          :data="rowsJson"
          @click="onTableClick"
          @oas-ok="onDeleteOk"
        />
      </div>
    </oas-card>

    <RoleFormDrawer
      :open="drawerOpen"
      :editing-id="editingId"
      :editing="editing"
      :depts="deptList"
      @close="drawerOpen = false"
      @saved="onFormSaved"
    />
  </div>
</template>
