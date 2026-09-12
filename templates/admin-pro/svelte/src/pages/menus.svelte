<script lang="ts">
  // src/pages/menus.svelte —— 权限管理（左树右详情 + 抽屉表单，纯内存树）
  // 1. 数据：初始树走 data/system 的 treeMenus（users 页权限面板共享同一份数据形态）；
  //    selectedId/editingId/formParentId/drawerOpen 全部 $state，树的 data/expanded/selected、
  //    详情区、抽屉标题全部由 state 派生；useT() 订阅 locale 后整页重渲
  // 2. 事件绑定：oas-tree 的 oas-select 走展开通道直绑；页头新建按钮为 oas-button 原生
  //    click 直绑；抽屉表单的 radio 切换/perms 自动补全/取消保存接线在
  //    ./menus-form-drawer.svelte，本页只做提交校验与树变更编排（校验失败不关抽屉）
  // 3. 树数据为纯内存可变结构：变更后以 tree = [...tree] 触发重渲染（本页无服务端持久化）
  // 4. 子组件拆分（单文件 ≤400 行纪律）：树助手 ./menus-tree.ts、抽屉表单
  //    ./menus-form-drawer.svelte、详情卡 ./menus-detail.svelte
  import { onMount } from 'svelte'
  import type { MenuTree } from '../data/system'
  import { treeMenus } from '../data/system'
  import { useT } from '../lib/use-t.svelte'
  import { appMessage } from '../lib/app-message'
  import MenusDetail from './menus-detail.svelte'
  import MenusFormDrawer from './menus-form-drawer.svelte'
  import type { MenuSubmitPayload } from './menus-form-drawer.svelte'
  import { autoPerms } from './menus-form-drawer.svelte'
  import { descendants, findNode, insertChild, parentOf, removeNode, toTreeNodes } from './menus-tree'

  const PERM_RE = /^[a-z][a-z0-9:]+(:[a-z0-9]+)?$/

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时整页重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let tree = $state<MenuTree[]>([])
  let selectedId = $state<number | null>(null)
  let editingId = $state<number | null>(null)
  let formParentId = $state<number | null>(null)
  let drawerOpen = $state(false)

  const selectedNode = $derived(selectedId != null ? findNode(tree, selectedId) : null)
  const editingNode = $derived(editingId != null ? findNode(tree, editingId) : null)

  // 树数据通道：data/expanded 均 JSON attribute（expanded 契约=JSON 字符串数组，2.5.0 收紧）
  const treeAttrs = $derived.by(() => {
    const keys: string[] = []
    const walk = (list: MenuTree[]) => {
      for (const n of list) {
        if (n.children?.length) {
          keys.push(String(n.id))
          walk(n.children)
        }
      }
    }
    walk(tree)
    return {
      data: JSON.stringify(toTreeNodes(tree)),
      expanded: JSON.stringify(keys),
      selected: selectedId != null ? String(selectedId) : null,
      'onoas-select': onSelect,
    }
  })

  function onSelect(e: Event): void {
    selectedId = Number((e as CustomEvent<{ key: string }>).detail.key)
  }

  /** 下一可用 id（全树最大 id + 1） */
  const nextId = (): number => {
    const all: MenuTree[] = []
    const walk = (list: MenuTree[]) => {
      for (const n of list) {
        all.push(n)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(tree)
    return all.reduce((m, n) => Math.max(m, n.id), 0) + 1
  }

  // 初载播种本地可变树（本页树变更为纯内存操作，不回写存储）
  onMount(() => {
    void treeMenus().then((rows) => {
      tree = rows
      selectedId = rows[0]?.id ?? null
    })
  })

  const openCreate = (): void => {
    editingId = null
    formParentId = null
    drawerOpen = true
  }
  const openEdit = (node: MenuTree): void => {
    editingId = node.id
    formParentId = null
    drawerOpen = true
  }
  const openAddChild = (node: MenuTree): void => {
    editingId = null
    formParentId = node.id
    drawerOpen = true
  }

  function doDelete(node: MenuTree): void {
    if ((node.children ?? []).length > 0) {
      appMessage.error(t('menus.hasChildren'))
      return
    }
    removeNode(tree, node.id)
    appMessage.success(t('common.deleted'))
    selectedId = null
    tree = [...tree]
  }

  /** 提交编排：类型相关校验 → 父级合法性 → 新增/改移（校验失败不关抽屉） */
  function handleMenuSubmit(p: MenuSubmitPayload): void {
    const { name, type: formType, parentId, perms, path } = p
    if (!name) return

    if (formType === 'F') {
      if (!perms) {
        appMessage.error(t('menus.err.permRequired'))
        return
      }
      if (!PERM_RE.test(perms)) {
        appMessage.error(t('menus.err.permFormat'))
        return
      }
    } else if (formType === 'C') {
      if (!path) {
        appMessage.error(t('menus.err.pathRequired'))
        return
      }
    }

    if (editingId != null && parentId != null) {
      const desc = descendants(tree, editingId)
      if (parentId === editingId || desc.has(parentId)) {
        appMessage.error(t('menus.err.parentInvalid'))
        return
      }
    }

    const finalPerms = formType === 'C' ? perms || autoPerms('C', path) : perms || undefined

    if (editingId != null) {
      const node = findNode(tree, editingId)
      if (!node) {
        appMessage.error(t('menus.notFound'))
        return
      }
      const oldParent = parentOf(tree, node.id)
      node.title = name
      node.type = formType
      node.perms = finalPerms
      node.path = formType === 'C' ? path : undefined
      if (parentId !== oldParent) {
        removeNode(tree, node.id)
        insertChild(tree, parentId, node)
      }
      appMessage.success(t('common.saved'))
    } else {
      const newNode: MenuTree = {
        id: nextId(),
        title: name,
        type: formType,
        perms: finalPerms,
        path: formType === 'C' ? path : undefined,
        parentId,
        children: [],
      }
      insertChild(tree, parentId, newNode)
      selectedId = newNode.id
      appMessage.success(t('common.created'))
    }
    drawerOpen = false
    tree = [...tree]
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.menus')}</h1>
      <p class="page-subtitle">{tt('menus.subtitle')}</p>
    </div>
    <oas-button data-testid="menu-create" type="primary" icon="plus" onclick={openCreate}>
      {tt('menus.new')}
    </oas-button>
  </div>
  <div class="menu-layout">
    <oas-card class="menu-tree-card" title={tt('menus.treeTitle')}>
      <oas-tree data-testid="menu-tree" {...treeAttrs}></oas-tree>
    </oas-card>
    <oas-card class="menu-detail-card" title={tt('menus.detailTitle')}>
      <MenusDetail
        node={selectedNode}
        onEdit={openEdit}
        onAddChild={openAddChild}
        onDelete={doDelete}
      />
    </oas-card>
  </div>

  <!-- 抽屉表单自包含回填/类型切换/perms 补全；提交值转发上来编排 -->
  <MenusFormDrawer
    open={drawerOpen}
    editing={editingNode}
    presetParentId={formParentId}
    {tree}
    onClose={() => (drawerOpen = false)}
    onSubmit={handleMenuSubmit}
  />
</div>

<style>
  /* 菜单管理域样式（自 react 版 menus.css 迁入，作用域限本文件；.menu-form-body 在抽屉子组件内，
     .menu-detail* 在详情子组件内，各自 scoped 持有） */
  .menu-layout {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: var(--oas-space-3);
    margin-bottom: var(--oas-space-3);
  }
  .menu-tree-card::part(body) {
    padding: 0;
  }
  .menu-tree-card oas-tree {
    padding: var(--oas-space-2);
  }
  @media (max-width: 992px) {
    .menu-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
