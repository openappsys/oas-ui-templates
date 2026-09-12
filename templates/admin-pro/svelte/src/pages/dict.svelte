<script lang="ts">
  // src/pages/dict.svelte —— 字典管理（左类型列表 + 右键值表 + 双弹窗表单）
  // 1. 数据：类型列表/各类型键值计数/选中类型条目三路走 data/system（变更后 refresh 重取）；
  //    选中类型由 state 与类型集合派生（类型被删回落第一个）；labels/columns 随 locale 重算
  // 2. 事件绑定：类型列表点击与表格行内编辑为原生 click（列表直绑 / 表格经 composedPath 委托）；
  //    表格行删除 popconfirm 的 oas-ok 走 bind:this + $effect 容器委托；弹窗表单事件见
  //    ./dict-type-modal.svelte、./dict-item-modal.svelte（各自关闭各自的弹窗）
  // 3. columns 含 render 函数（cellAction 返回真实 DOM 节点）→ property 通道，按 locale 重建
  import '../styles/pages/dict.css'
  import { onMount } from 'svelte'
  import type { TableColumn } from '@oas-ui/ui/data/table'
  import type { DictItem, DictType } from '../data/system'
  import {
    createDictItem,
    createDictType,
    listDictItems,
    listDictTypes,
    removeDictItem,
    updateDictItem,
    updateDictType,
  } from '../data/system'
  import { useT } from '../lib/use-t.svelte'
  import { appMessage } from '../lib/app-message'
  import DictItemModal from './dict-item-modal.svelte'
  import DictTypeModal from './dict-type-modal.svelte'

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let types = $state<DictType[]>([])
  let counts = $state<Record<number, number>>({})
  let items = $state<DictItem[]>([])
  let selectedState = $state<number | null>(null)
  let editingTypeId = $state<number | null>(null)
  let editingItemId = $state<number | null>(null)
  let typeModalOpen = $state(false)
  let itemModalOpen = $state(false)
  let saving = false // 防重入（非响应式）

  let itemsWrapEl: HTMLDivElement | null = $state(null)

  // 选中类型派生：state 里选中的仍存在则用之，否则回落第一个（类型删除后自动纠偏）
  const selectedTypeId = $derived(
    selectedState != null && types.some((x) => x.id === selectedState)
      ? selectedState
      : (types[0]?.id ?? null),
  )
  const selectedType = $derived(types.find((x) => x.id === selectedTypeId) ?? null)
  const editingType = $derived(types.find((x) => x.id === editingTypeId) ?? null)
  const editingItem = $derived(items.find((x) => x.id === editingItemId) ?? null)

  /** 三路数据一次拉齐：类型 / 计数 / 选中类型条目 */
  async function refresh(selected: number | null): Promise<void> {
    const rows = await listDictTypes()
    const entries = await Promise.all(
      rows.map(async (ty) => [ty.id, (await listDictItems(ty.id)).length] as const),
    )
    types = rows
    counts = Object.fromEntries(entries)
    const active =
      selected != null && rows.some((x) => x.id === selected) ? selected : (rows[0]?.id ?? null)
    selectedState = active
    items = active != null ? await listDictItems(active) : []
  }

  // 初载（onMount 不建立响应式依赖）
  onMount(() => {
    void refresh(null)
  })

  // 选中类型变化 → 重取该类型条目（过期响应丢弃）
  $effect(() => {
    const id = selectedTypeId
    void listDictItems(id ?? 0).then((rows) => {
      if (id != null && id === selectedTypeId) items = rows
    })
  })

  /** vanilla ITEM_COLUMNS（含 render 函数 → property 通道，按 locale 重建） */
  const columns = $derived.by<TableColumn[]>(() => {
    void $locale
    return [
      { key: 'label', title: tt('dict.th.label') },
      { key: 'value', title: tt('dict.th.value') },
      { key: 'sort', title: tt('dict.th.sort'), align: 'right' },
      {
        key: 'action',
        title: tt('dict.th.action'),
        render: (r) => itemActionCell(r as unknown as DictItem),
      },
    ]
  })

  const tableAttrs = $derived.by(() => ({
    columns,
    data: JSON.stringify(items),
  }))

  /** vanilla itemActionCell：编辑按钮 + popconfirm 包裹的删除按钮 */
  function itemActionCell(item: DictItem): HTMLElement {
    const ctx = document.createElement('div')
    ctx.className = 'action-cell'
    const edit = document.createElement('oas-button')
    edit.setAttribute('data-edit', String(item.id))
    edit.setAttribute('size', 'small')
    edit.setAttribute('type', 'text')
    edit.textContent = t('common.edit')
    const pop = document.createElement('oas-popconfirm')
    pop.setAttribute('data-del', String(item.id))
    pop.setAttribute('title', t('dict.confirmDeleteItem'))
    const del = document.createElement('oas-button')
    del.setAttribute('size', 'small')
    del.setAttribute('type', 'danger')
    del.textContent = t('common.delete')
    pop.appendChild(del)
    ctx.appendChild(edit)
    ctx.appendChild(pop)
    return ctx
  }

  /** 表格行删除（oas-ok 容器委托）：detail.source 带 data-del 反查 */
  function onTableOk(e: Event): void {
    const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
    if (!src?.hasAttribute?.('data-del')) return
    void removeDictItem(Number(src.getAttribute('data-del'))).then(() => {
      appMessage.success(t('common.deleted'))
      void refresh(selectedTypeId)
    })
  }

  $effect(() => {
    const el = itemsWrapEl
    if (!el) return
    el.addEventListener('oas-ok', onTableOk)
    return () => el.removeEventListener('oas-ok', onTableOk)
  })

  /** 类型列表点击：closest [data-id] 命中即切换选中 */
  function onTypeListClick(e: MouseEvent): void {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    if (!item) return
    selectedState = Number(item.getAttribute('data-id'))
  }

  /** 表格行内编辑：composedPath 匹配 [data-edit]（点击源在 oas-table shadow 内，composed 可达） */
  function onTableWrapClick(e: MouseEvent): void {
    const btn = e
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
    if (!btn) return
    const item = items.find((d) => d.id === Number(btn.getAttribute('data-edit')))
    if (item) {
      editingItemId = item.id
      itemModalOpen = true
    }
  }

  /** 类型弹窗提交：trim → create/update → 关闭 + 选中复位（重取后回落第一个类型） */
  async function handleTypeSubmit(values: { name?: string; code?: string }): Promise<void> {
    if (saving) return
    saving = true
    try {
      const name = values.name?.trim()
      const code = values.code?.trim()
      if (!name || !code) return
      if (editingTypeId == null) {
        await createDictType({ name, code })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateDictType(editingTypeId, { name, code })
        if (!updated) appMessage.error(t('dict.notFoundType'))
        else appMessage.success(t('common.saved'))
      }
      typeModalOpen = false
      selectedState = null
      await refresh(null)
    } finally {
      saving = false
    }
  }

  /** 键值弹窗提交：trim → create/update → 关闭（重取当前类型条目与计数） */
  async function handleItemSubmit(values: {
    label?: string
    value?: string
    sort?: string
  }): Promise<void> {
    if (saving) return
    if (selectedTypeId == null) return
    saving = true
    try {
      const label = values.label?.trim()
      const value = values.value?.trim()
      if (!label || !value) return
      const sort = Number(values.sort) || 0
      if (editingItemId == null) {
        await createDictItem({ typeId: selectedTypeId, label, value, sort })
        appMessage.success(t('common.created'))
      } else {
        const updated = await updateDictItem(editingItemId, { label, value, sort })
        if (!updated) appMessage.error(t('dict.notFoundItem'))
        else appMessage.success(t('common.saved'))
      }
      itemModalOpen = false
      await refresh(selectedTypeId)
    } finally {
      saving = false
    }
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.dict')}</h1>
      <p class="page-subtitle">{tt('dict.subtitle')}</p>
    </div>
  </div>
  <div class="dict-layout">
    <oas-card class="dict-type-card" title={tt('dict.typeTitle')}>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="dict-type-list" data-testid="dict-type-list" onclick={onTypeListClick}>
        {#if types.length === 0}
          <div class="dict-empty">{tt('dict.empty.types')}</div>
        {:else}
          {#each types as ty (ty.id)}
            <div
              class="dict-type-item"
              class:is-selected={ty.id === selectedTypeId}
              data-id={ty.id}
              data-testid="dict-type-item"
            >
              <span class="dict-type-name">{ty.name}</span>
              <span class="dict-type-code mono">{ty.code}</span>
              <span class="dict-type-count">{counts[ty.id] ?? 0}</span>
            </div>
          {/each}
        {/if}
      </div>
    </oas-card>
    <oas-card class="dict-items-card" title={tt('dict.itemTitle')}>
      <div class="dict-pane-head" id="dict-pane-head">
        <div id="dict-pane-title">
          <span class="dict-pane-title">
            {selectedType ? selectedType.name : tt('dict.itemTitle')}
          </span>
          <div class="dict-pane-sub">
            {selectedType
              ? tt('dict.itemCount', { code: selectedType.code, count: counts[selectedType.id] ?? 0 })
              : tt('dict.empty.selectType')}
          </div>
        </div>
        <div>
          <oas-button
            data-testid="dict-type-create"
            type="text"
            icon="plus"
            onclick={() => {
              editingTypeId = null
              typeModalOpen = true
            }}
          >
            {tt('dict.newType')}
          </oas-button>
          <oas-button
            data-testid="dict-item-create"
            type="primary"
            icon="plus"
            onclick={() => {
              if (selectedTypeId == null) {
                appMessage.warning(t('dict.warn.selectType'))
                return
              }
              editingItemId = null
              itemModalOpen = true
            }}
          >
            {tt('dict.newItem')}
          </oas-button>
        </div>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        id="dict-items-wrap"
        hidden={selectedTypeId == null}
        class:table-hidden={items.length === 0}
        bind:this={itemsWrapEl}
        onclick={onTableWrapClick}
      >
        <oas-table data-testid="dict-items-table" {...{ 'row-key': 'id', ...tableAttrs }}>
        </oas-table>
      </div>
    </oas-card>
  </div>

  <!-- 两个弹窗各自管理自己的关闭/提交接线（type 关 type、item 关 item） -->
  <DictTypeModal
    open={typeModalOpen}
    editing={editingType}
    onClose={() => (typeModalOpen = false)}
    onSubmit={(values) => void handleTypeSubmit(values)}
  />
  <DictItemModal
    open={itemModalOpen}
    editing={editingItem}
    onClose={() => (itemModalOpen = false)}
    onSubmit={(values) => void handleItemSubmit(values)}
  />
</div>
