<script lang="ts">
  // src/components/nav-menu.svelte —— 导航菜单：sidebar / menubar / navigation 三形态 × 位置分派
  //   高亮三机制——sidebar 用 active 属性；menubar 用 value 属性（radio ✓ 高亮）；
  //   navigation 用 items 内 active 字段（value 必须留空，否则 findItem 落空面板空白）
  // 形态/位置切换由调用方用 {#key} 重挂载本组件（事件随模板直绑，天然绑到新元素）
  import { useT } from '../lib/use-t.svelte'
  import { readSidebarCollapsed, writeSidebarCollapsed, type MenuStyle } from '../layout-config'
  import { navigate } from '../router'
  import { groupMenuItems, sidebarItems } from './nav-items'

  interface Props {
    menuStyle: MenuStyle
    /** 竖排（left/right 槽位）或横排（top / top-head） */
    vertical: boolean
    activePath: string
    /** 浮层形态（☰ 弹出面板）：id 用 nav-popover，menubar 加 trigger="click" */
    popover?: boolean
    onNavigate?: () => void
  }

  let { menuStyle, vertical, activePath, popover = false, onNavigate }: Props = $props()

  const { locale } = useT()
  let collapsed = $state(readSidebarCollapsed())
  let navEl = $state<HTMLElement | null>(null)
  const id = $derived(popover ? 'nav-popover' : 'nav')

  // items 随 activePath/locale 重建（读 $locale 建立响应式依赖）
  const sidebarJson = $derived.by(() => {
    void $locale
    return JSON.stringify(sidebarItems())
  })
  const groupJsonNoHref = $derived.by(() => {
    void $locale
    return JSON.stringify(groupMenuItems(activePath, false))
  })
  const groupJsonHref = $derived.by(() => {
    void $locale
    return JSON.stringify(groupMenuItems(activePath, true))
  })

  function onSelect(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail
    if (!value) return
    if (value !== activePath) navigate(value)
    onNavigate?.()
  }

  // 折叠持久化：仅 sidebar 形态有折叠（collapsed）
  function onCollapse(e: Event): void {
    if (menuStyle !== 'sidebar') return
    const detail = (e as CustomEvent<{ collapsed: boolean }>).detail
    if (typeof detail?.collapsed === 'boolean') {
      writeSidebarCollapsed(detail.collapsed)
      collapsed = detail.collapsed
    }
  }

  // navigation 在浮层容器里首帧测量会坍缩成 0×0（oas-navigation-menu 浮层测量缺陷）：
  // 仅挂载时兜底一次；activePath 变化由响应式重设 items
  $effect(() => {
    if (!popover || menuStyle !== 'navigation') return
    const el = navEl
    const raf = requestAnimationFrame(() => {
      el?.setAttribute('items', JSON.stringify(groupMenuItems(activePath, true)))
    })
    return () => cancelAnimationFrame(raf)
  })
</script>

{#if menuStyle === 'menubar'}
  <oas-menubar
    {id}
    bind:this={navEl}
    orientation={vertical ? 'vertical' : 'horizontal'}
    trigger={popover ? 'click' : null}
    items={groupJsonNoHref}
    value={activePath}
    onoas-select={onSelect}
  ></oas-menubar>
{:else if menuStyle === 'navigation'}
  <oas-navigation-menu
    {id}
    bind:this={navEl}
    orientation={vertical ? 'vertical' : 'horizontal'}
    items={groupJsonHref}
    onoas-select={onSelect}
  ></oas-navigation-menu>
{:else}
  <oas-sider id={popover ? null : 'nav-sider'}>
    <oas-sidebar
      {id}
      bind:this={navEl}
      items={sidebarJson}
      active={activePath}
      collapsed={collapsed ? '' : null}
      onoas-select={onSelect}
      onoas-collapse={onCollapse}
    ></oas-sidebar>
  </oas-sider>
{/if}

<style>
  /* sider 轨道：宽度由宿主 oas-sider 提供（200px），三形态共轨 */
  oas-sider {
    width: 200px;
    padding: 0;
  }
  /* 折叠过渡：宽/补白随 --oas-transition-base 缓动 */
  oas-sider {
    transition:
      width var(--oas-transition-base, 180ms) var(--oas-ease-out, cubic-bezier(0.2, 0, 0.2, 1)),
      padding var(--oas-transition-base, 180ms) var(--oas-ease-out, cubic-bezier(0.2, 0, 0.2, 1));
  }
  /* collapsed 属性由组件运行时切换（模板不写），:global 规避未使用选择器告警 */
  :global(oas-sider[collapsed]) {
    padding: 0;
    width: 64px;
  }

  oas-sidebar {
    --oas-control-height-lg: 32px;
    height: 100%;
  }
  oas-sidebar::part(panel) {
    min-height: 0;
  }

  oas-sidebar::part(toggle) {
    margin: 0;
  }

  oas-sidebar::part(trigger) {
    display: none;
  }

  oas-sidebar::part(item):hover {
    background: color-mix(in srgb, var(--oas-color-text-primary) 6%, transparent);
  }
  oas-sidebar[collapsed]::part(group) {
    display: none;
  }

  @media (max-width: 768px) {
    /* 移动端 sidebar 走自身 drawer：轨道收窄为 0（与 app-shell 中菜单容器的 display:none 配合） */
    oas-sider,
    :global(oas-sider[collapsed]) {
      width: 0;
      padding: 0;
      overflow: hidden;
    }
  }
</style>
