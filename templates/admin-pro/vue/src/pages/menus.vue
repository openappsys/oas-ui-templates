<script setup lang="ts">
// src/pages/menus.vue —— 菜单（权限）管理：左树右详情 + 新建/编辑抽屉（纯前端树变更）
//    本模版声明式——tree/selectedId 全部 ref，详情区由 selected 派生；树的增删改沿用
// 2. 子组件拆分（单文件 ≤400 行纪律）：表单抽屉 ./menu-form-drawer.vue（RULES/fillMenuForm/
//    syncMenuType/单选与 path 联动段），树辅助函数抽到 ./menu-tree.ts；校验与树变更保留
//    组件实际派发的是 oas-node-render（emit 统一加 oas- 前缀），且默认节点模板无这两个
// 4. 事件绑定：树 oas-select 直绑；详情区删除按钮 popconfirm 直绑 @oas-ok；
//    data/expanded/selected 属性通道同 dept.vue
//    本模版 useT() 订阅后整页重渲染
import { computed, onMounted, ref } from 'vue'
import { treeMenus } from '../data/system'
import type { MenuTree, MenuType } from '../data/system'
import {
  autoPerms,
  descendants,
  expandKeys,
  findNode,
  insertChild,
  nextIdOf,
  parentOf,
  removeNode,
  toTreeNodes,
} from './menu-tree'
import { useT } from '../composables/use-t'
import { appMessage } from '../lib/app-message'
import MenuFormDrawer from './menu-form-drawer.vue'
import type { MenuFormPayload } from './menu-tree'

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const TYPE_TAG: Record<MenuType, string> = { M: 'default', C: 'primary', F: 'warning' }
const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

const tree = ref<MenuTree[]>([])
const selectedId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const parentForNew = ref<MenuTree | null>(null)
const drawerOpen = ref(false)

const selected = computed(() =>
  selectedId.value == null ? null : findNode(tree.value, selectedId.value),
)
const editing = computed(() =>
  editingId.value == null ? null : findNode(tree.value, editingId.value),
)

const treeJson = computed(() => JSON.stringify(toTreeNodes(tree.value)))
const expandedStr = computed(() => expandKeys(tree.value).join(','))
const selectedAttr = computed(() => (selectedId.value == null ? null : String(selectedId.value)))

async function init(): Promise<void> {
  tree.value = await treeMenus()
  selectedId.value = tree.value[0]?.id ?? null
}
onMounted(() => void init())

function onSelect(e: Event): void {
  selectedId.value = Number((e as CustomEvent<{ key: string }>).detail.key)
}

function openForm(node: MenuTree | null, parentOverride?: MenuTree): void {
  editingId.value = node?.id ?? null
  parentForNew.value = node ? null : (parentOverride ?? null)
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

function onDeleteSelected(): void {
  const node = selected.value
  if (!node) return
  if ((node.children ?? []).length > 0) {
    appMessage.error(t('menus.hasChildren'))
    return
  }
  removeNode(tree.value, node.id)
  appMessage.success(tt('common.deleted'))
  selectedId.value = null
}

function onFormSubmit(p: MenuFormPayload): void {
  const { name, type, perms, path, parentId } = p
  if (type === 'F') {
    if (!perms) {
      appMessage.error(t('menus.err.permRequired'))
      return
    }
    if (!PERM_RE.test(perms)) {
      appMessage.error(t('menus.err.permFormat'))
      return
    }
  } else if (type === 'C') {
    if (!path) {
      appMessage.error(t('menus.err.pathRequired'))
      return
    }
  }

  if (editingId.value != null && parentId != null) {
    const desc = descendants(tree.value, editingId.value)
    if (parentId === editingId.value || desc.has(parentId)) {
      appMessage.error(t('menus.err.parentInvalid'))
      return
    }
  }

  const finalPerms = type === 'C' ? perms || autoPerms('C', path) : perms || undefined

  if (editingId.value != null) {
    const node = findNode(tree.value, editingId.value)
    if (!node) {
      appMessage.error(t('menus.notFound'))
      return
    }
    const oldParent = parentOf(tree.value, node.id)
    node.title = name
    node.type = type
    node.perms = finalPerms
    node.path = type === 'C' ? path : undefined
    if (parentId !== oldParent) {
      removeNode(tree.value, node.id)
      insertChild(tree.value, parentId, node)
    }
    appMessage.success(tt('common.saved'))
  } else {
    const newNode: MenuTree = {
      id: nextIdOf(tree.value),
      title: name,
      type,
      perms: finalPerms,
      path: type === 'C' ? path : undefined,
      parentId,
      children: [],
    }
    insertChild(tree.value, parentId, newNode)
    selectedId.value = newNode.id
    appMessage.success(tt('common.created'))
  }
  drawerOpen.value = false
  editingId.value = null
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.menus') }}</h1>
        <p class="page-subtitle">{{ t('menus.subtitle') }}</p>
      </div>
      <oas-button data-testid="menu-create" type="primary" icon="plus" @click="onCreate">
        {{ t('menus.new') }}
      </oas-button>
    </div>
    <div class="menu-layout">
      <oas-card class="menu-tree-card" :title="t('menus.treeTitle')">
        <oas-tree
          data-testid="menu-tree"
          :data="treeJson"
          :expanded="expandedStr"
          :selected="selectedAttr"
          @oas-select="onSelect"
        />
      </oas-card>
      <oas-card class="menu-detail-card" :title="t('menus.detailTitle')">
        <div class="menu-detail">
          <template v-if="selected">
            <div class="menu-detail-head">
              <div class="menu-detail-title">{{ selected.title }}</div>
              <oas-tag :type="TYPE_TAG[selected.type]">{{ t(`menus.type.${selected.type}`) }}</oas-tag>
            </div>
            <oas-descriptions column="1">
              <oas-descriptions-item :label="t('menus.form.type')">
                <span class="mono">{{ selected.type }}</span>
              </oas-descriptions-item>
              <oas-descriptions-item :label="t('menus.form.perms')">
                <span class="mono" data-testid="menu-detail-perms">{{ selected.perms ?? '—' }}</span>
              </oas-descriptions-item>
              <oas-descriptions-item :label="t('menus.form.path')">
                <span class="mono">{{ selected.path ?? '—' }}</span>
              </oas-descriptions-item>
              <oas-descriptions-item :label="t('menus.detail.childCount')">
                <span class="mono">{{ (selected.children ?? []).length }}</span>
              </oas-descriptions-item>
            </oas-descriptions>
            <div class="menu-detail-actions">
              <oas-button type="primary" @click="onEditSelected">{{ t('common.edit') }}</oas-button>
              <oas-button @click="onAddChild">{{ t('menus.addChild') }}</oas-button>
              <oas-popconfirm :title="t('menus.confirmDelete')" @oas-ok="onDeleteSelected">
                <oas-button type="danger">{{ t('common.delete') }}</oas-button>
              </oas-popconfirm>
            </div>
          </template>
          <oas-empty v-else :description="t('menus.empty.selectNode')" />
        </div>
      </oas-card>
    </div>

    <MenuFormDrawer
      :open="drawerOpen"
      :editing="editing"
      :parent-for-new="parentForNew"
      :tree="tree"
      @close="drawerOpen = false"
      @submit="onFormSubmit"
    />
  </div>
</template>
