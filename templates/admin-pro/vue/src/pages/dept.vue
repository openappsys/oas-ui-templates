<script setup lang="ts">
// src/pages/dept.vue —— 部门管理：左树右详情（oas-splitter）+ 详情子部门表格 + 新建/编辑抽屉
//    本模版声明式——tree/selectedId/flat 全部 ref，详情区/子部门表由 selected 派生
// 2. 子组件拆分（单文件 ≤400 行纪律）：表单抽屉 ./dept-form-drawer.vue（RULES/fillForm/
//    父级树选择/oas-submit 段）；子部门表格列 render（操作列）保留本文件
//    template 元素透传（isCustomElement 下编译为真实 <template> 元素），oas-tree 的
//    fillNodeLabel 对 content/childNodes 双通道读取（组件源码实测），模板直写即可
// 4. 树数据通道：data=JSON 字符串、expanded=逗号串、selected 存在性语义；
//    oas-node-render（徽标回填）与 oas-select（选中）模板直绑（第 1 条）
// 5. 删除：详情区按钮 popconfirm 直绑 @oas-ok；子表行内 popconfirm 经 oas-ok 的
//    detail.source 带 data-del 反查（v2.2.8 popconfirm 原生自驱动，无需模板手动 open）；
//    行内编辑按钮经 @click composedPath 匹配（category.vue 同款）
//    本模版 useT() 订阅后整页重渲染，columns（含行内标签）随 locale 自动重算
import { computed, onMounted, ref } from 'vue'
import type { TableColumn } from '@oas-ui/ui/data/table'
import { listDepts, removeDept, treeDepts } from '../data/system'
import type { DeptNode, DeptTree } from '../data/system'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import DeptFormDrawer from './dept-form-drawer.vue'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

function findNode(nodes: DeptTree[], id: number): DeptTree | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

function flatten(nodes: DeptTree[]): DeptNode[] {
  const out: DeptNode[] = []
  const walk = (list: DeptTree[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function toTreeNodes(nodes: DeptTree[]): Array<Record<string, unknown>> {
  return nodes.map((n) => ({
    key: String(n.id),
    label: n.name,
    members: n.members,
    children: n.children?.length ? toTreeNodes(n.children) : [],
  }))
}

function expandKeys(nodes: DeptTree[]): string[] {
  const keys: string[] = []
  const walk = (list: DeptTree[]) => {
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

const tree = ref<DeptTree[]>([])
const flat = ref<DeptNode[]>([])
const selectedId = ref<number | null>(null)

// 抽屉状态：editingId（null=新建）/编辑节点/新建子部门时的父节点
const editingId = ref<number | null>(null)
const editing = computed(() => (editingId.value == null ? null : findNode(tree.value, editingId.value)))
const parentForNew = ref<DeptTree | null>(null)
const drawerOpen = ref(false)

const selected = computed(() =>
  selectedId.value == null ? null : findNode(tree.value, selectedId.value),
)

const treeJson = computed(() => JSON.stringify(toTreeNodes(tree.value)))
const expandedStr = computed(() => expandKeys(tree.value).join(','))
const selectedAttr = computed(() => (selectedId.value == null ? null : String(selectedId.value)))

function subActionCell(node: DeptTree): HTMLElement {
  const ctx = document.createElement('div')
  ctx.className = 'action-cell'
  const edit = document.createElement('oas-button')
  edit.setAttribute('data-edit', String(node.id))
  edit.setAttribute('size', 'small')
  edit.setAttribute('type', 'text')
  edit.textContent = tt('common.edit')
  const pop = document.createElement('oas-popconfirm')
  pop.setAttribute('data-del', String(node.id))
  pop.setAttribute('title', tt('dept.confirmDelete'))
  const del = document.createElement('oas-button')
  del.setAttribute('size', 'small')
  del.setAttribute('type', 'danger')
  del.textContent = tt('common.delete')
  pop.appendChild(del)
  ctx.appendChild(edit)
  ctx.appendChild(pop)
  return ctx
}

const subColumns = computed<TableColumn[]>(() => {
  void locale.value
  return [
    { key: 'name', title: tt('dept.th.name') },
    { key: 'members', title: tt('dept.th.members'), align: 'right' },
    { key: 'action', title: tt('dept.th.action'), render: (r) => subActionCell(r as unknown as DeptTree) },
  ]
})

const subRows = computed(() => selected.value?.children ?? [])
const subRowsJson = computed(() => JSON.stringify(subRows.value))

async function refresh(): Promise<void> {
  const [rows, treeRows] = await Promise.all([listDepts(), treeDepts()])
  tree.value = treeRows
  flat.value = rows
  if (selectedId.value == null || !findNode(tree.value, selectedId.value)) {
    selectedId.value = tree.value[0]?.id ?? null
  }
}
onMounted(() => void refresh())

function onNodeRender(e: Event): void {
  const { node, element } = (e as CustomEvent<{ node: { members: number }; element: HTMLElement }>)
    .detail
  const badge = element.querySelector<HTMLElement>('.dept-member-badge')
  if (badge) badge.textContent = String(node.members)
}

function onSelect(e: Event): void {
  selectedId.value = Number((e as CustomEvent<{ key: string }>).detail.key)
}

function openForm(node: DeptNode | null, parent?: DeptTree): void {
  editingId.value = node?.id ?? null
  parentForNew.value = parent ?? null
  drawerOpen.value = true
}

function onCreate(): void {
  openForm(null)
}

function onEditSelected(): void {
  if (selected.value) openForm(selected.value)
}
function onAddChild(): void {
  if (selected.value) openForm(null, selected.value)
}

async function doDelete(id: number): Promise<void> {
  const node = findNode(tree.value, id)
  if (!node) {
    appMessage.error(t('dept.notFound'))
    return
  }
  if ((node.children ?? []).length > 0) {
    appMessage.error(t('dept.hasChildren'))
    return
  }
  const ok = await removeDept(id)
  if (!ok) {
    appMessage.error(t('dept.notFound'))
    return
  }
  appMessage.success(tt('common.deleted'))
  selectedId.value = null
  void refresh()
}

function onDeleteSelected(): void {
  if (selected.value) void doDelete(selected.value.id)
}

// （v2.2.8 起行点击忽略内嵌交互控件：单元格内 popconfirm 原生自驱动，无需模板手动 open）
function onSubClick(e: MouseEvent): void {
  const btn = e
    .composedPath()
    .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
  if (!btn) return
  const row = flat.value.find((d) => d.id === Number(btn.getAttribute('data-edit')))
  if (row) openForm(row)
}

function onSubDeleteOk(e: Event): void {
  const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
  if (!src?.hasAttribute?.('data-del')) return
  void doDelete(Number(src.getAttribute('data-del')))
}

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
        <h1 class="page-title">{{ t('nav.dept') }}</h1>
        <p class="page-subtitle">{{ t('dept.subtitle') }}</p>
      </div>
      <oas-button data-testid="dept-create" type="primary" icon="plus" @click="onCreate">
        {{ t('dept.new') }}
      </oas-button>
    </div>
    <oas-splitter class="dept-layout" percent="30" min="20" max="45">
      <oas-card slot="left" class="dept-tree-card" :title="t('dept.treeTitle')">
        <oas-tree
          data-testid="dept-tree"
          :data="treeJson"
          :expanded="expandedStr"
          :selected="selectedAttr"
          @oas-node-render="onNodeRender"
          @oas-select="onSelect"
        >
          <template slot="node">
            <span class="tree-node-label">
              <span data-node-label></span>
              <span class="dept-member-badge"></span>
            </span>
          </template>
        </oas-tree>
      </oas-card>
      <oas-card slot="right" class="dept-detail-card" :title="t('dept.detailTitle')">
        <div class="dept-detail">
          <template v-if="selected">
            <div class="dept-detail-head">
              <div class="dept-detail-title">{{ selected.name }}</div>
              <oas-tag type="primary" data-testid="dept-detail-members">
                {{ t('dept.memberCount', { n: selected.members }) }}
              </oas-tag>
            </div>
            <oas-descriptions column="1">
              <oas-descriptions-item :label="t('dept.detail.id')">
                <span class="mono">{{ selected.id }}</span>
              </oas-descriptions-item>
              <oas-descriptions-item :label="t('dept.form.parent')">
                <span class="mono">{{ selected.parentId == null ? '—' : selected.parentId }}</span>
              </oas-descriptions-item>
              <oas-descriptions-item :label="t('dept.detail.childCount')">
                <span class="mono">{{ (selected.children ?? []).length }}</span>
              </oas-descriptions-item>
            </oas-descriptions>
            <div class="dept-detail-actions">
              <oas-button type="primary" @click="onEditSelected">{{ t('common.edit') }}</oas-button>
              <oas-button @click="onAddChild">{{ t('dept.addChild') }}</oas-button>
              <oas-popconfirm :title="t('dept.confirmDelete')" @oas-ok="onDeleteSelected">
                <oas-button type="danger">{{ t('common.delete') }}</oas-button>
              </oas-popconfirm>
            </div>
            <div class="dept-detail-sub">
              <div class="dept-detail-sub-title">{{ t('dept.subTitle') }}</div>
              <div>
                <div v-if="subRows.length === 0" class="sub-dept-empty">
                  {{ t('dept.empty.noChildren') }}
                </div>
                <oas-table
                  v-else
                  data-testid="dept-sub-table"
                  row-key="id"
                  :columns="subColumns"
                  :data="subRowsJson"
                  @click="onSubClick"
                  @oas-ok="onSubDeleteOk"
                />
              </div>
            </div>
          </template>
          <oas-empty v-else :description="t('dept.empty.selectNode')" />
        </div>
      </oas-card>
    </oas-splitter>

    <DeptFormDrawer
      :open="drawerOpen"
      :editing-id="editingId"
      :editing="editing"
      :parent-for-new="parentForNew"
      :tree="tree"
      @close="drawerOpen = false"
      @saved="onFormSaved"
    />
  </div>
</template>

<style scoped>
/* 部门页样式（自 dept.css / app.css 迁入）；.dept-form-body 在抽屉组件内持有，本页不含 */
.dept-layout {
  margin-bottom: var(--oas-space-3);
}
.dept-layout::part(pane-left),
.dept-layout::part(pane-right) {
  min-width: 0;
}
.dept-tree-card::part(body) {
  padding: 0;
}
.dept-tree-card oas-tree {
  padding: var(--oas-space-2);
}
.dept-member-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: var(--oas-space-2);
  border-radius: 9px;
  background: color-mix(in srgb, var(--oas-color-primary) 14%, transparent);
  color: var(--oas-color-primary);
  font-family: var(--app-mono);
  font-size: 11px;
  line-height: 1;
  vertical-align: middle;
}
.dept-detail {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-4);
}
.dept-detail-head {
  display: flex;
  align-items: center;
  gap: var(--oas-space-2);
}
.dept-detail-title {
  font-size: 16px;
  font-weight: 650;
  color: var(--oas-color-text-primary);
}
.dept-detail-actions {
  display: flex;
  gap: var(--oas-space-2);
  align-items: center;
}
.sub-dept-empty {
  text-align: center;
  padding: var(--oas-space-6);
  color: var(--oas-color-text-secondary);
  font-size: var(--oas-font-size-sm);
}
.tree-node-label {
  display: inline-flex;
  align-items: center;
  gap: var(--oas-space-1);
  min-width: 0;
}
</style>
