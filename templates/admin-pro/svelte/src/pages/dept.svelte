<script lang="ts">
  // src/pages/dept.svelte —— 部门管理（左树右详情 + 抽屉表单 + 子部门表）
  // 1. 数据：平铺列表/树走 data/system 的 listDepts/treeDepts（内存 CRUD 后 refresh 重取）；
  //    selectedId/editingId/drawerOpen 全部 $state，树的 data/expanded/selected、详情区、
  //    抽屉标题全部由 state 派生；useT() 订阅 locale 后整页重渲
  // 2. 事件绑定：oas-tree 的 oas-select/oas-node-render、oas-form 的 oas-submit 走展开通道直绑；
  //    oas-button 为 custom element，Svelte 原生直绑 onclick（不走根委托，panel 内亦可达）
  // 3. 抽屉字段非受控：open 边沿 $effect 逐字段 setAttribute 回填（含父级树 options/expanded，
  //    expanded 契约为 JSON 字符串数组——oas-ui 2.5.0 收紧）
  // 4. 命令式 API 规避（oas-virtual-list.buffer 崩溃教训）：对 oas-tree/oas-tree-select 只用
  //    attribute 通道，不触碰任何命令式成员
  // 5. 子组件拆分（单文件 ≤400 行纪律）：详情卡 ./dept-detail.svelte（描述/操作/子部门表）
  import '../styles/pages/dept.css'
  import { onMount } from 'svelte'
  import type { DeptNode, DeptTree } from '../data/system'
  import { createDept, listDepts, removeDept, treeDepts, updateDept } from '../data/system'
  import { useT } from '../lib/use-t.svelte'
  import { appMessage } from '../lib/app-message'
  import DeptDetail from './dept-detail.svelte'

  /** oas-tree 自定义节点模板的数据形态 */
  interface DeptTreeNode {
    key: string
    label: string
    members: number
    children: DeptTreeNode[]
  }

  /** vanilla findNode */
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

  /** vanilla descendants */
  function descendants(nodes: DeptTree[], id: number): Set<number> {
    const set = new Set<number>()
    const node = findNode(nodes, id)
    const walk = (list: DeptTree[]) => {
      for (const n of list) {
        set.add(n.id)
        if (n.children?.length) walk(n.children)
      }
    }
    if (node) walk(node.children ?? [])
    return set
  }

  /** vanilla toTreeNodes */
  function toTreeNodes(nodes: DeptTree[]): DeptTreeNode[] {
    return nodes.map((n) => ({
      key: String(n.id),
      label: n.name,
      members: n.members,
      children: n.children?.length ? toTreeNodes(n.children) : [],
    }))
  }

  /** vanilla expandKeys */
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

  /** vanilla prune：剔除自身及其后代后的选项树 */
  function prune(node: DeptTree, excluded: Set<number>): DeptTree | null {
    if (excluded.has(node.id)) return null
    const children = (node.children ?? [])
      .map((c) => prune(c, excluded))
      .filter((c): c is DeptTree => c !== null)
    return { ...node, children }
  }

  /** vanilla buildParentOptions：剔除编辑目标自身/后代后的选项树（顶级哨兵在回填处拼） */
  function parentOptionTree(nodes: DeptTree[], excludeId: number | null): DeptTree[] {
    if (excludeId == null) return nodes
    const excluded = descendants(nodes, excludeId)
    excluded.add(excludeId)
    return nodes.map((n) => prune(n, excluded)).filter((n): n is DeptTree => n !== null)
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时整页重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let tree = $state<DeptTree[]>([])
  let flat = $state<DeptNode[]>([])
  let selectedId = $state<number | null>(null)
  // 抽屉状态：editingId（null=新建）/新建子部门时的父节点/开关
  let editingId = $state<number | null>(null)
  let formParentId = $state<number | null>(null)
  let drawerOpen = $state(false)
  let saving = false // 防重入（非响应式，与 react savingRef 同语义）

  let treeEl: HTMLElement | null = $state(null)
  let drawerEl: HTMLElement | null = $state(null)
  let formEl: HTMLElement | null = $state(null)
  let nameEl: HTMLElement | null = $state(null)
  let parentEl: HTMLElement | null = $state(null)
  let membersEl: HTMLElement | null = $state(null)

  const selectedNode = $derived(selectedId != null ? findNode(tree, selectedId) : null)
  const editingNode = $derived(editingId != null ? findNode(tree, editingId) : null)
  const drawerTitle = $derived(
    editingNode ? tt('dept.editDept', { name: editingNode.name }) : tt('dept.new'),
  )

  // 平铺列表/树双路加载（变更后一并重取，等价 react 版双 key 失效）
  async function refresh(): Promise<void> {
    const [rows, treeRows] = await Promise.all([listDepts(), treeDepts()])
    tree = treeRows
    flat = rows
    if (selectedId == null || !findNode(tree, selectedId)) {
      selectedId = tree[0]?.id ?? null
    }
  }

  onMount(() => {
    void refresh()
  })

  // 树数据通道：data/expanded 均 JSON attribute（expanded 契约=JSON 字符串数组，2.5.0 收紧）；
  // oas-select/oas-node-render 事件处理函数保持稳定引用，随展开对象整体直绑
  const treeAttrs = $derived.by(() => ({
    data: JSON.stringify(toTreeNodes(tree)),
    expanded: JSON.stringify(expandKeys(tree)),
    selected: selectedId != null ? String(selectedId) : null,
    'onoas-select': onSelect,
    'onoas-node-render': onNodeRender,
  }))

  /** vanilla 规则：有子部门禁删；删除后选中复位并重取 */
  async function doDelete(id: number): Promise<void> {
    const node = findNode(tree, id)
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
    appMessage.success(t('common.deleted'))
    selectedId = null
    await refresh()
  }

  /** oas-node-render：自定义节点模板里回填成员数徽标 */
  function onNodeRender(e: Event): void {
    const { node, element } = (e as CustomEvent<{ node: DeptTreeNode; element: HTMLElement }>).detail
    const badge = element.querySelector<HTMLElement>('.dept-member-badge')
    if (badge) badge.textContent = String(node.members)
  }

  function onSelect(e: Event): void {
    selectedId = Number((e as CustomEvent<{ key: string }>).detail.key)
  }

  const openCreate = (): void => {
    editingId = null
    formParentId = null
    drawerOpen = true
  }
  const openEdit = (node: DeptNode): void => {
    editingId = node.id
    formParentId = node.parentId
    drawerOpen = true
  }
  const openAddChild = (node: DeptTree): void => {
    editingId = null
    formParentId = node.id
    drawerOpen = true
  }
  const onEditRow = (id: number): void => {
    const row = flat.find((d) => d.id === id)
    if (row) openEdit(row)
  }

  // 抽屉 open 边沿回填：字段值 + 父级树选项/展开（expanded 走 JSON 数组契约）
  $effect(() => {
    if (!drawerOpen) return
    void editingId
    void formParentId
    nameEl?.setAttribute('value', editingNode?.name ?? '')
    membersEl?.setAttribute('value', String(editingNode?.members ?? 0))
    const pid = editingNode?.parentId ?? formParentId ?? null
    parentEl?.setAttribute('value', String(pid ?? 0))
    const toOpt = (list: DeptTree[]): Array<Record<string, unknown>> =>
      list.map((n) => ({
        value: String(n.id),
        label: n.name,
        children: n.children?.length ? toOpt(n.children) : undefined,
      }))
    const opts = [
      { value: '0', label: tt('dept.option.top'), children: toOpt(parentOptionTree(tree, editingId)) },
    ]
    parentEl?.setAttribute('options', JSON.stringify(opts))
    parentEl?.setAttribute('expanded', JSON.stringify(expandKeys(tree)))
  })

  /** 取消：仅关抽屉 */
  function onCancel(): void {
    drawerOpen = false
  }

  /** 保存：触发 oas-form shadow 内原生 form 提交（跨 shadow requestSubmit 通道） */
  function onSave(): void {
    ;(formEl?.shadowRoot?.querySelector('form') as HTMLFormElement | null)?.requestSubmit()
  }

  /** oas-submit：值收集 + create/update 编排（校验失败不关抽屉） */
  async function onFormSubmit(e: Event): Promise<void> {
    if (saving) return
    const { values } = (e as CustomEvent<{ values: { name?: string; members?: string } }>).detail
    const name = values.name?.trim()
    if (!name) return
    const parentRaw = parentEl?.getAttribute('value') || '0'
    const parentId = parentRaw === '0' ? null : Number(parentRaw)
    const members = Number(values.members) || 0
    if (editingId != null && parentId === editingId) {
      appMessage.error(t('dept.err.parentSelf'))
      return
    }
    saving = true
    try {
      if (editingId == null) {
        await createDept({ name, parentId, members })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateDept(editingId, { name, parentId, members })
        if (!updated) appMessage.error(t('dept.notFound'))
        else appMessage.success(t('common.saved'))
      }
      drawerOpen = false
    } finally {
      saving = false
    }
    await refresh()
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.dept')}</h1>
      <p class="page-subtitle">{tt('dept.subtitle')}</p>
    </div>
    <oas-button data-testid="dept-create" type="primary" icon="plus" onclick={openCreate}>
      {tt('dept.new')}
    </oas-button>
  </div>
  <oas-splitter class="dept-layout" {...{ percent: '30', min: '20', max: '45' }}>
    <oas-card slot="left" class="dept-tree-card" title={tt('dept.treeTitle')}>
      <oas-tree bind:this={treeEl} data-testid="dept-tree" {...treeAttrs}>
        <!-- vanilla template[slot="node"]：节点标签 + 人数徽标（oas-node-render 回填徽标） -->
        <template slot="node">
          <span class="tree-node-label">
            <span data-node-label></span>
            <span class="dept-member-badge"></span>
          </span>
        </template>
      </oas-tree>
    </oas-card>
    <oas-card slot="right" class="dept-detail-card" title={tt('dept.detailTitle')}>
      <DeptDetail
        node={selectedNode}
        onEdit={openEdit}
        onAddChild={openAddChild}
        onDelete={(node) => void doDelete(node.id)}
        onEditRow={onEditRow}
        onSubDelete={(id) => void doDelete(id)}
      />
    </oas-card>
  </oas-splitter>

  <oas-drawer
    bind:this={drawerEl}
    data-testid="dept-form-drawer"
    title={drawerTitle}
    placement="right"
    size="medium"
    no-footer
    visible={drawerOpen ? '' : null}
    onoas-close={() => (drawerOpen = false)}
  >
    <oas-form
      bind:this={formEl}
      rules={JSON.stringify({ name: [{ required: true, message: tt('dept.rule.name') }] })}
      onoas-submit={onFormSubmit}
    >
      <div class="dept-form-body">
        <div class="form-field">
          <label class="form-label">
            {tt('dept.form.name')} <span class="req">*</span>
          </label>
          <oas-input bind:this={nameEl} data-testid="df-name" name="name" placeholder={tt('dept.rule.name')}>
          </oas-input>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('dept.form.parent')}</label>
          <oas-tree-select bind:this={parentEl} data-testid="df-parent" placeholder={tt('dept.placeholder.top')}>
          </oas-tree-select>
        </div>
        <div class="form-field">
          <label class="form-label">{tt('dept.form.members')}</label>
          <oas-input-number bind:this={membersEl} data-testid="df-members" name="members" min="0" placeholder="0">
          </oas-input-number>
        </div>
        <div class="form-actions">
          <oas-space justify="end">
            <oas-button data-testid="df-cancel" onclick={onCancel}>{tt('common.cancel')}</oas-button>
            <oas-button data-testid="df-save" type="primary" onclick={onSave}>{tt('common.save')}</oas-button>
          </oas-space>
        </div>
      </div>
    </oas-form>
  </oas-drawer>
</div>
