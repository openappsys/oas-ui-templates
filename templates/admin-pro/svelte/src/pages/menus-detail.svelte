<script lang="ts">
  // src/pages/menus-detail.svelte —— 权限详情卡（选中节点描述/操作按钮）
  // 1. 数据与状态、删除编排都在父组件 menus.svelte；本组件纯展示 + 事件转发
  // 2. 事件绑定：详情区位于 oas-card 的 light DOM（非 drawer/modal panel），编辑/新增子菜单
  //    按钮直接 onclick（Svelte 对 custom element 不走根委托）；删除 popconfirm 的 oas-ok
  //    （kebab 自定义事件）经 bind:this + $effect 容器委托（div 上不能模板直绑）
  import type { MenuTree, MenuType } from '../data/system'
  import { useT } from '../lib/use-t.svelte'

  /** vanilla TYPE_TAG：菜单类型 → 标签色 */
  const TYPE_TAG: Record<MenuType, string> = { M: 'default', C: 'primary', F: 'warning' }

  interface MenusDetailProps {
    /** 当前选中节点（null → 空态） */
    node: MenuTree | null
    onEdit: (node: MenuTree) => void
    onAddChild: (node: MenuTree) => void
    onDelete: (node: MenuTree) => void
  }

  let { node, onEdit, onAddChild, onDelete }: MenusDetailProps = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重算 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let wrapEl: HTMLDivElement | null = $state(null)

  // 删除 popconfirm：oas-ok 容器委托（kebab 自定义事件不能在 div 上模板直绑）
  $effect(() => {
    const el = wrapEl
    if (!el) return
    el.addEventListener('oas-ok', onDeleteOk)
    return () => el.removeEventListener('oas-ok', onDeleteOk)
  })

  function onDeleteOk(): void {
    if (node) onDelete(node)
  }
</script>

{#if node}
  <div bind:this={wrapEl} class="menu-detail">
    <div class="menu-detail-head">
      <div class="menu-detail-title">{node.title}</div>
      <oas-tag type={TYPE_TAG[node.type]}>{tt(`menus.type.${node.type}`)}</oas-tag>
    </div>
    <oas-descriptions {...{ column: '1' }}>
      <oas-descriptions-item {...{ label: tt('menus.form.type') }}>
        <span class="mono">{node.type}</span>
      </oas-descriptions-item>
      <oas-descriptions-item {...{ label: tt('menus.form.perms') }}>
        <span class="mono" data-testid="menu-detail-perms">{node.perms ?? '—'}</span>
      </oas-descriptions-item>
      <oas-descriptions-item {...{ label: tt('menus.form.path') }}>
        <span class="mono">{node.path ?? '—'}</span>
      </oas-descriptions-item>
      <oas-descriptions-item {...{ label: tt('menus.detail.childCount') }}>
        <span class="mono">{(node.children ?? []).length}</span>
      </oas-descriptions-item>
    </oas-descriptions>
    <div class="menu-detail-actions">
      <oas-button type="primary" onclick={() => onEdit(node)}>{tt('common.edit')}</oas-button>
      <oas-button onclick={() => onAddChild(node)}>{tt('menus.addChild')}</oas-button>
      <oas-popconfirm {...{ title: tt('menus.confirmDelete'), id: 'md-del-pop' }}>
        <oas-button type="danger">{tt('common.delete')}</oas-button>
      </oas-popconfirm>
    </div>
  </div>
{:else}
  <oas-empty {...{ description: tt('menus.empty.selectNode') }}></oas-empty>
{/if}

<style>
  /* 权限详情域样式（自 react 版 menus.css 迁入，作用域限本文件） */
  .menu-detail {
    display: flex;
    flex-direction: column;
    gap: var(--oas-space-4);
  }
  .menu-detail-head {
    display: flex;
    align-items: center;
    gap: var(--oas-space-2);
  }
  .menu-detail-title {
    font-size: 16px;
    font-weight: 650;
    color: var(--oas-color-text-primary);
  }
  .menu-detail-actions {
    display: flex;
    gap: var(--oas-space-2);
    align-items: center;
  }
</style>
