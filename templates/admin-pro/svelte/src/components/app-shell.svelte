<script lang="ts">
  // src/components/app-shell.svelte —— 布局壳：oas-layout + 头部 + 三形态导航 + 页签栏 + 面包屑 + footer
  // NavMenu 按 形态:位置:朝向 {#key} 重挂载；no-chrome 由路由层未登录分支（/login 直渲）天然接管
  import type { Snippet } from 'svelte'
  import { fromStore } from 'svelte/store'
  import { useNotifications } from '../lib/use-notifications.svelte'
  import { useT } from '../lib/use-t.svelte'
  import { navConfig, type NavConfig } from '../layout-config'
  import { currentPath } from '../router'
  import { routeHref } from '../router/mode'
  import { appRoutes, matchRoute } from '../router/routes'
  import CommandPalette from './command-palette.svelte'
  import HeaderBar from './header-bar.svelte'
  import NavMenu from './nav-menu.svelte'
  import NotificationsDrawer from './notifications-drawer.svelte'
  import TabsBar from './tabs-bar.svelte'

  /** oas-sidebar 的抽屉方法（☰ 在 sidebar 形态下开关联抽屉） */
  interface SidebarElement extends HTMLElement {
    openDrawer(): void
    closeDrawer(): void
  }

  interface CrumbItem {
    label: string
    href?: string
  }

  /** 面包屑 items：根 + （父级） + 当前页，首页/未知路由两级无 href */
  function buildCrumbs(activePath: string, t: (key: string) => string): CrumbItem[] {
    const route = matchRoute(activePath)
    const home = appRoutes[0]
    const rootLabel = t('nav.root')
    if (route === undefined || route.path === home.path) {
      return [{ label: rootLabel }, { label: t(home.meta.titleKey) }]
    }
    const items: CrumbItem[] = [{ label: rootLabel, href: routeHref(home.path) }]
    const parentPath = route.meta.parent
    const parent = parentPath ? matchRoute(parentPath) : undefined
    if (parent && parentPath) {
      items.push({ label: t(parent.meta.titleKey), href: routeHref(parentPath) })
    }
    items.push({ label: t(route.meta.titleKey) })
    return items
  }

  let { children }: { children?: Snippet } = $props()

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时整壳重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  const path = fromStore(currentPath)
  const activePath = $derived(path.current)

  let nav = $state<NavConfig>(navConfig())
  let popoverOpen = $state(false)
  let commandOpen = $state(false)
  // 通知数据：badge（header-bar）与抽屉共享一份
  const notif = useNotifications()
  let notifOpen = $state(false)

  // 设置中心改菜单形态/位置：实时重建壳
  $effect(() => {
    const onChange = (): void => {
      nav = navConfig()
      popoverOpen = false
    }
    window.addEventListener('oas:navconfig-change', onChange)
    return () => window.removeEventListener('oas:navconfig-change', onChange)
  })

  $effect(() => {
    void $locale
    const r = matchRoute(activePath)
    document.title = r ? `${t(r.meta.titleKey)} · ${t('app.fullname')}` : t('app.fullname')
  })

  // ☰ 单击分派：sidebar 走自身抽屉；menubar/navigation 走悬浮菜单
  function onNavToggle(): void {
    const el = document.getElementById('nav')
    if (el?.tagName === 'OAS-SIDEBAR') {
      const sidebar = el as SidebarElement
      if (sidebar.hasAttribute('drawer-open')) sidebar.closeDrawer()
      else sidebar.openDrawer()
    } else {
      popoverOpen = !popoverOpen
    }
  }

  // 悬浮菜单打开时：点外部 / Esc 关闭
  $effect(() => {
    if (!popoverOpen) return
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('#menu-popover') || target.closest('#nav-toggle')) return
      popoverOpen = false
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') popoverOpen = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  const crumbs = $derived.by(() => {
    void $locale
    return JSON.stringify(buildCrumbs(activePath, t))
  })

  // 页面入场动画：首次渲染不加 page-enter，路由切换后 {#key} 重挂载 <main> 自然重放动画。
  // prev 为非响应式纯对象：derived 在渲染期同步求值（等价 react 渲染期读 ref 比较）
  const prev = { current: null as string | null }
  const pageEnter = $derived.by(() => {
    const p = activePath
    const switched = prev.current !== null && prev.current !== p
    prev.current = p
    return switched
  })
</script>

{#snippet navMenu(vertical: boolean)}
  {#key `${nav.style}:${nav.position}:${vertical ? 'v' : 'h'}`}
    <NavMenu menuStyle={nav.style} {vertical} {activePath} />
  {/key}
{/snippet}

{#snippet headerMenu()}
  {#if nav.position === 'top-head'}
    <div class="header-nav-menubar">{@render navMenu(false)}</div>
  {/if}
{/snippet}

<oas-layout
  class="app"
  viewport
  side={nav.position === 'top-head' ? 'top' : nav.position}
  data-menu-style={nav.style}
>
  <HeaderBar
    {onNavToggle}
    onOpenCommand={() => (commandOpen = true)}
    notifCount={notif.unread}
    onToggleNotif={() => (notifOpen = !notifOpen)}
    {headerMenu}
  />
  {#if nav.position === 'top'}
    <div class="top-nav-bar" slot="sider">{@render navMenu(false)}</div>
  {/if}
  {#if nav.position !== 'top' && nav.position !== 'top-head'}
    <div slot="sider" class="nav-sider">{@render navMenu(true)}</div>
  {/if}
  <div slot="content" class="content-col">
    <TabsBar />
    <div class="crumbs-bar">
      <oas-breadcrumb id="crumbs" items={crumbs}></oas-breadcrumb>
    </div>
    {#key activePath}
      <main id="view" class:page-enter={pageEnter}>
        {@render children?.()}
      </main>
    {/key}
    <footer class="app-foot">{tt('app.footer')}</footer>
  </div>
</oas-layout>
<CommandPalette open={commandOpen} onOpenChange={(v) => (commandOpen = v)} />
<NotificationsDrawer
  open={notifOpen}
  items={notif.items}
  onClose={() => (notifOpen = false)}
  onReadOne={notif.readOne}
  onReadAll={notif.readAll}
/>
{#if popoverOpen}
  <div id="menu-popover" class="menu-popover">
    <NavMenu
      menuStyle={nav.style}
      vertical
      {activePath}
      popover={true}
      onNavigate={() => (popoverOpen = false)}
    />
  </div>
{/if}

<style>
  /* 子组件根元素（NavMenu 的 oas-menubar/oas-navigation-menu、HeaderBar 的 .app-header 等）
     不继承本组件 scope——凡指向子组件根的 selector 一律 :global 包裹对应段 */
  .app {
    height: 100%;
    overflow: hidden;
  }

  /* 顶部 menubar（top+menubar）：塞进 header 的 logo 与搜索之间。
     菜单区 flex-shrink:0 + max-width 上限，不参与 header 的 flex 收缩，下拉可溢出且浮于内容上 */
  .header-nav-menubar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    overflow: visible;
    position: relative;
    z-index: 30;
  }
  .header-nav-menubar > :global(oas-menubar) {
    display: block;
    width: auto;
    overflow: visible;
  }

  /* 顶部导航条（top 模式）：占 sider 槽全宽一行，菜单项按内容宽横排，下拉可溢出且浮于内容上 */
  .top-nav-bar {
    width: 100%;
    min-height: 0;
    overflow: visible;
    padding: var(--oas-space-1) var(--oas-space-3);
    border-bottom: 1px solid var(--oas-color-border);
    position: relative;
    z-index: 30;
  }
  /* 顶部菜单条撑满导航条：barRight 以视口右缘为准，避免子菜单被误判溢出而错翻 */
  .top-nav-bar > :global(oas-menubar),
  .top-nav-bar > :global(oas-navigation-menu) {
    width: 100%;
  }
  /* sider 槽菜单容器（left/right 模式）：填满轨道高度。宽度不由容器定——三形态共用一个 .nav-sider 容器，
     若在此定宽会破坏 sidebar 折叠 → 宽度下放到 nav-menu */
  .nav-sider {
    height: 100%;
    min-height: 0;
  }
  /* menubar/navigation 竖排：补整列面板背景 + 右缘分隔线，与 sidebar 外观统一。
     用 :has() 限定仅 menubar/navigation 生效，避免污染 sidebar（其面板由内嵌 oas-sider 提供） */
  :global(.nav-sider:has(> oas-menubar)),
  :global(.nav-sider:has(> oas-navigation-menu)) {
    background: var(--oas-color-bg-hover);
    border-right: 1px solid var(--oas-color-border);
  }
  /* menubar/navigation 竖排：宽度自适应贴合菜单内容；display:block 让 .bar.vertical 填满面板高 */
  .nav-sider > :global(oas-menubar),
  .nav-sider > :global(oas-navigation-menu) {
    display: block;
    min-width: 0;
  }
  /* 菜单条/多级导航顶部下拉需溢出 sider 区（不被 viewport 的 overflow-y:auto 裁剪） */
  oas-layout[side='top']::part(sider) {
    overflow: visible;
  }
  /* menubar/navigation 左/右竖排：下拉往右浮出，sider 需 visible；
     仅对菜单条/多级导航生效（sidebar 树形仍需 sider 内部滚动，用 data-menu-style 区分） */
  oas-layout[data-menu-style='menubar']::part(sider),
  oas-layout[data-menu-style='navigation']::part(sider) {
    overflow: visible;
  }

  .content-col {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .crumbs-bar {
    flex-shrink: 0;
    height: 40px;
    display: flex;
    align-items: center;
    padding: 0 var(--oas-space-4);
    border-bottom: 1px solid var(--oas-color-border);
    background: var(--oas-color-bg);
  }
  #view {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  /* 向导页步骤条需吸底操作区，viewport 不能裁剪（.form-wizard 在子页面组件内） */
  :global(#view:has(.form-wizard)) {
    overflow: visible;
  }
  #view.page-enter {
    animation: viewEnter 180ms ease-out;
  }
  @keyframes viewEnter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    #view.page-enter {
      animation: none;
    }
  }
  .app-foot {
    flex-shrink: 0;
    padding: var(--oas-table-cell-padding-block, var(--oas-space-3)) var(--oas-space-4);
    color: var(--oas-color-text-secondary);
    font-size: 12px;
    text-align: center;
  }

  /* 无壳模式：隐藏全部壳层 chrome（#app 在 index.html；路由层 /login 直渲后此分支为兜底语义） */
  :global(#app.no-chrome .app-header),
  :global(#app.no-chrome oas-sider),
  :global(#app.no-chrome .crumbs-bar),
  :global(#app.no-chrome .tabs-bar),
  :global(#app.no-chrome .app-foot) {
    display: none;
  }
  :global(#app.no-chrome #view) {
    min-height: 100vh;
  }

  /* ☰ 悬浮菜单面板（menubar/navigation）：点 ☰ 弹出，内嵌垂直菜单——顶级=分组，点击顶级项展开子路由。
     宽度自适应：菜单贴顶级项内容宽 */
  .menu-popover {
    position: fixed;
    top: calc(var(--app-header-height, 56px) + var(--oas-space-1));
    left: var(--oas-space-2);
    z-index: var(--oas-z-dropdown, 1000);
    background: var(--oas-color-bg);
    border: 1px solid var(--oas-color-border);
    border-radius: var(--oas-radius-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: var(--oas-space-1);
    width: fit-content;
  }
  .menu-popover > :global(oas-menubar),
  .menu-popover > :global(oas-navigation-menu) {
    /* 不覆盖 display：组件 host 默认 inline-block（贴内容宽），fit-content 才能收缩到顶级项内容宽 */
    width: auto;
    max-width: 100%;
  }

  @media (max-width: 768px) {
    /* 移动端：menubar/navigation 的侧栏/顶部菜单收起，统一由 ☰ 弹出抽屉导航。
       仅限菜单条/多级导航（:has() 判定），sidebar 内嵌 oas-sider 走自身 drawer，不可整容器隐藏 */
    :global(.nav-sider:has(> oas-menubar)),
    :global(.nav-sider:has(> oas-navigation-menu)),
    :global(.top-nav-bar:has(> oas-menubar)),
    :global(.top-nav-bar:has(> oas-navigation-menu)),
    .header-nav-menubar {
      display: none;
    }
  }
</style>
