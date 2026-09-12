<script lang="ts">
  // src/pages/dept-detail.svelte —— 部门详情卡（选中节点描述/操作按钮/子部门表）
  // 1. 数据与状态、删除编排都在父组件 dept.svelte；本组件纯展示 + 事件转发
  // 2. 事件绑定：详情区位于 oas-card 的 light DOM（非 drawer/modal panel），原生 click 可达——
  //    编辑/新增子部门按钮直接 onclick（Svelte 对 custom element 不走根委托）；行内编辑经
  //    composedPath 匹配 [data-edit]；子表 + 详情区删除 popconfirm 的 oas-ok（kebab 自定义
  //    事件）统一经 bind:this + $effect 容器委托（div 容器 kebab 事件不能模板直绑）
  import type { TableColumn } from '@oas-ui/ui/data/table'
  import type { DeptNode, DeptTree } from '../data/system'
  import { useT } from '../lib/use-t.svelte'

  interface DeptDetailProps {
    /** 当前选中节点（null → 空态） */
    node: DeptTree | null
    onEdit: (node: DeptTree) => void
    onAddChild: (node: DeptTree) => void
    onDelete: (node: DeptTree) => void
    /** 子表行内编辑（父组件按 id 回查 flat 行） */
    onEditRow: (id: number) => void
    /** 子表 popconfirm 删除 */
    onSubDelete: (id: number) => void
  }

  let { node, onEdit, onAddChild, onDelete, onEditRow, onSubDelete }: DeptDetailProps = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let wrapEl: HTMLDivElement | null = $state(null)

  /** vanilla subActionCell：编辑按钮 + popconfirm 包裹的删除按钮（data-edit/data-del 逐字对齐） */
  function subActionCell(row: DeptTree): HTMLElement {
    const ctx = document.createElement('div')
    ctx.className = 'action-cell'
    const edit = document.createElement('oas-button')
    edit.setAttribute('data-edit', String(row.id))
    edit.setAttribute('size', 'small')
    edit.setAttribute('type', 'text')
    edit.textContent = t('common.edit')
    const pop = document.createElement('oas-popconfirm')
    pop.setAttribute('data-del', String(row.id))
    pop.setAttribute('title', t('dept.confirmDelete'))
    const del = document.createElement('oas-button')
    del.setAttribute('size', 'small')
    del.setAttribute('type', 'danger')
    del.textContent = t('common.delete')
    pop.appendChild(del)
    ctx.appendChild(edit)
    ctx.appendChild(pop)
    return ctx
  }

  /** vanilla SUB_COLUMNS（含 render 函数 → property 通道，列定义按 locale 重建） */
  const subColumns = $derived.by<TableColumn[]>(() => {
    void $locale
    return [
      { key: 'name', title: tt('dept.th.name') },
      { key: 'members', title: tt('dept.th.members'), align: 'right' },
      {
        key: 'action',
        title: tt('dept.th.action'),
        render: (r) => subActionCell(r as unknown as DeptTree),
      },
    ]
  })

  const children = $derived(node?.children ?? [])
  const subTableAttrs = $derived.by(() => ({
    columns: subColumns,
    data: JSON.stringify(children),
  }))

  // 子表 + 详情区删除 popconfirm 统一在 wrap 上委托 oas-ok（div 容器 kebab 事件不能模板直绑）：
  // detail.source 带 data-del → 删子表行；主删除 popconfirm（md-del-pop）→ 删当前选中节点
  $effect(() => {
    const el = wrapEl
    if (!el) return
    el.addEventListener('oas-ok', onSubOk)
    return () => el.removeEventListener('oas-ok', onSubOk)
  })

  function onSubOk(e: Event): void {
    const src = (e as CustomEvent<{ source?: HTMLElement }>).detail?.source
    if (!src?.hasAttribute) return
    if (src.hasAttribute('data-del')) onSubDelete(Number(src.getAttribute('data-del')))
    else if (src.id === 'md-del-pop' && node) onDelete(node)
  }

  // 行内编辑按钮：composedPath 匹配 [data-edit]（点击源在 oas-table shadow 内，composed 可达）
  function onWrapClick(e: MouseEvent): void {
    const btn = e
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('[data-edit]'))
    if (btn) onEditRow(Number(btn.getAttribute('data-edit')))
  }
</script>

{#if node}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div bind:this={wrapEl} class="dept-detail" onclick={onWrapClick}>
    <div class="dept-detail-head">
      <div class="dept-detail-title">{node.name}</div>
      <oas-tag type="primary" data-testid="dept-detail-members">
        {tt('dept.memberCount', { n: node.members })}
      </oas-tag>
    </div>
    <oas-descriptions {...{ column: '1' }}>
      <oas-descriptions-item {...{ label: tt('dept.detail.id') }}>
        <span class="mono">{node.id}</span>
      </oas-descriptions-item>
      <oas-descriptions-item {...{ label: tt('dept.form.parent') }}>
        <span class="mono">{node.parentId == null ? '—' : node.parentId}</span>
      </oas-descriptions-item>
      <oas-descriptions-item {...{ label: tt('dept.detail.childCount') }}>
        <span class="mono">{children.length}</span>
      </oas-descriptions-item>
    </oas-descriptions>
    <div class="dept-detail-actions">
      <oas-button type="primary" onclick={() => onEdit(node)}>{tt('common.edit')}</oas-button>
      <oas-button onclick={() => onAddChild(node)}>{tt('dept.addChild')}</oas-button>
      <oas-popconfirm {...{ title: tt('dept.confirmDelete'), id: 'md-del-pop' }}>
        <oas-button type="danger">{tt('common.delete')}</oas-button>
      </oas-popconfirm>
    </div>
    <div class="dept-detail-sub">
      <div class="dept-detail-sub-title">{tt('dept.subTitle')}</div>
      <div id="dept-sub">
        {#if children.length === 0}
          <div class="sub-dept-empty">{tt('dept.empty.noChildren')}</div>
        {:else}
          <oas-table data-testid="dept-sub-table" {...{ 'row-key': 'id', ...subTableAttrs }}>
          </oas-table>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <oas-empty {...{ description: tt('dept.empty.selectNode') }}></oas-empty>
{/if}
