<script lang="ts">
  // src/components/header-bar.svelte —— 顶栏：☰/logo/（top-head 菜单槽）/搜索/全屏/主题点/语言/通知 badge/用户菜单
  // oas-* 自定义事件（oas-select）模板直绑（Svelte 5 原生支持 kebab 事件，无需桥接）
  import type { Snippet } from 'svelte'
  import { fromStore } from 'svelte/store'
  import { logoutFlow } from '../lib/session-actions'
  import { sessionUser } from '../lib/session-user'
  import { toggleTheme } from '../lib/theme'
  import { useT } from '../lib/use-t.svelte'
  import { navigate } from '../router'
  import { LANG_ITEMS, userMenuItems } from './nav-items'

  interface Props {
    /** ☰ 单击：sidebar 开抽屉 / menubar·navigation 开悬浮菜单（由 AppShell 分派） */
    onNavToggle: () => void
    /** 搜索框单击/Enter：唤起命令面板 */
    onOpenCommand: () => void
    notifCount: number
    onToggleNotif: () => void
    /** top-head 位置时塞在 logo 与搜索框之间的菜单节点 */
    headerMenu?: Snippet
  }

  let { onNavToggle, onOpenCommand, notifCount, onToggleNotif, headerMenu }: Props = $props()

  const { t, locale, setLocale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时整壳重渲（各 items/文案随之刷新） */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  // 会话用户：登录/登出自动重渲
  const user = fromStore(sessionUser)

  // 用户菜单 items 随 locale 重建
  const userItems = $derived.by(() => {
    void $locale
    return userMenuItems()
  })

  // 全屏态同步（Esc 退出等浏览器侧变更也要回写 aria-pressed / is-fullscreen）
  let isFullscreen = $state(false)
  const fsSupported = document.fullscreenEnabled

  function safeFullscreen(p: Promise<void> | undefined): void {
    if (p && typeof p.catch === 'function') p.catch(() => {})
  }
  function onFullscreenClick(): void {
    if (document.fullscreenElement) safeFullscreen(document.exitFullscreen())
    else safeFullscreen(document.documentElement.requestFullscreen())
  }

  $effect(() => {
    const onChange = (): void => {
      isFullscreen = document.fullscreenElement != null
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  })

  // 语言下拉：选择即切换 locale
  function onLangSelect(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail
    if (value === 'zh-CN' || value === 'en') setLocale(value)
  }

  // 用户下拉：个人中心 / 登出
  function onUserSelect(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail
    if (value === 'logout') logoutFlow()
    else if (value === '/profile') navigate(value)
  }

  // badge 数字变化时的弹跳动画（重放：先移除再强制 reflow 后加回）
  let badgeEl = $state<HTMLElement | null>(null)
  let lastCount = -1
  $effect(() => {
    const el = badgeEl
    const count = notifCount
    if (!el || count === lastCount) return
    lastCount = count
    el.classList.remove('is-pop')
    void el.offsetWidth
    el.classList.add('is-pop')
  })

  // 搜索框：readonly 拦截指针默认行为；单击/Enter 唤起命令面板
  function onSearchPointerDown(e: PointerEvent): void {
    e.preventDefault()
  }
  function onSearchKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Enter') return
    e.preventDefault()
    onOpenCommand()
  }
</script>

<!-- 根元素带 slot 参与 oas-layout 的槽位投射：Svelte 编译期不知 oas-layout 是自定义元素，
     用展开属性绕过其 slot 位置静态校验 -->
<header class="app-header" {...{ slot: 'header' }}>
  <!-- oas-button 内部渲染原生 button，键盘事件由组件自带 -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <oas-button
    id="nav-toggle"
    class="nav-toggle"
    type="text"
    icon="menu"
    aria-label={tt('header.openMenu')}
    onclick={onNavToggle}
  ></oas-button>
  <!-- 增强：logo 包一层链接，点击回站点首页（门户 /）。
       用 <a href="/"> 而非路由内跳转——目标是「离开模版回到门户」，不是模版内路由 -->
  <a class="oas-logo" href="/" style="cursor: pointer; text-decoration: none; color: inherit">
    <span class="oas-logo-badge">OAS</span>
    <span class="oas-logo-word">OAS Admin Pro</span>
  </a>
  {@render headerMenu?.()}
  <span class="spacer"></span>
  <div class="global-search">
    <!-- 只读展示框：内部为原生 input，单击/Enter 唤起命令面板 -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <oas-input
      id="global-search"
      placeholder={tt('header.search')}
      prefix-icon="search"
      readonly
      onpointerdown={onSearchPointerDown}
      onclick={onOpenCommand}
      onkeydown={onSearchKeydown}
    ></oas-input>
    <span class="kbd-hint">/</span>
  </div>
  <span class="spacer"></span>
  <button
    id="fullscreen-toggle"
    class="icon-btn fullscreen-btn"
    class:is-fullscreen={isFullscreen}
    type="button"
    title={tt('header.fullscreen')}
    aria-label={tt('header.fullscreen')}
    aria-pressed={isFullscreen}
    hidden={!fsSupported}
    onclick={onFullscreenClick}
  >
    <oas-icon size="18" class="fs-expand">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M2 5V3.5A1.5 1.5 0 0 1 3.5 2H5" />
        <path d="M11 2h1.5A1.5 1.5 0 0 1 14 3.5V5" />
        <path d="M14 11v1.5a1.5 1.5 0 0 1-1.5 1.5H11" />
        <path d="M5 14H3.5A1.5 1.5 0 0 1 2 12.5V11" />
      </svg>
    </oas-icon>
    <oas-icon size="18" class="fs-compress">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M2 5h3V2" />
        <path d="M14 5h-3V2" />
        <path d="M14 11h-3v3" />
        <path d="M2 11h3v3" />
      </svg>
    </oas-icon>
  </button>
  <button
    id="theme-toggle"
    class="theme-dot"
    type="button"
    title={tt('header.theme')}
    aria-label={tt('header.theme')}
    onclick={toggleTheme}
  ></button>
  <oas-dropdown
    id="lang-menu"
    placement="bottom"
    arrow-point-at-center
    trigger="hover click"
    value={$locale}
    items={LANG_ITEMS}
    onoas-select={onLangSelect}
  >
    <button
      id="lang-toggle"
      class="icon-btn"
      type="button"
      title={tt('cmd.locale')}
      aria-label={tt('cmd.locale')}
      aria-haspopup="menu"
    >
      <oas-icon size="18">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M2 8h12" />
          <path d="M8 2c2 1.7 3 3.8 3 6s-1 4.3-3 6c-2-1.7-3-3.8-3-6s1-4.3 3-6z" />
        </svg>
      </oas-icon>
    </button>
  </oas-dropdown>
  <oas-badge id="notif-badge" bind:this={badgeEl} value={String(notifCount)} size="small" offset="-2,2">
    <button
      id="notif-toggle"
      class="icon-btn"
      type="button"
      title={tt('header.notification')}
      aria-label={tt('header.notificationCount', { count: notifCount })}
      onclick={onToggleNotif}
    >
      <oas-icon size="18">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2.2a3.6 3.6 0 0 1 3.6 3.6c0 2.2.5 3.4 1.5 4.4H2.9c1-1 1.5-2.2 1.5-4.4A3.6 3.6 0 0 1 8 2.2z" />
          <path d="M6.7 12.4a1.4 1.4 0 0 0 2.6 0" />
        </svg>
      </oas-icon>
    </button>
  </oas-badge>
  <oas-dropdown
    id="user-menu"
    placement="bottom"
    arrow-point-at-center
    trigger="hover click"
    items={userItems}
    onoas-select={onUserSelect}
  >
    <oas-avatar
      id="user-avatar"
      size="28"
      text={(user.current?.name ?? '').charAt(0).toUpperCase()}
      aria-label={tt('header.userMenu')}
      aria-haspopup="menu"
    ></oas-avatar>
  </oas-dropdown>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: var(--oas-space-3);
    padding: 0 var(--oas-space-4);
    padding-left: calc(var(--oas-space-4) + var(--oas-space-3) + var(--oas-space-2));
    height: 56px;
    border-bottom: 1px solid var(--oas-color-border);
  }
  .spacer {
    flex: 1;
  }
  .global-search {
    display: inline-flex;
    align-items: center;
    gap: var(--oas-space-2);
    cursor: pointer;
  }
  .global-search oas-input {
    width: 100%;
    max-width: 400px;
  }
  .global-search:hover oas-input::part(input) {
    border-color: var(--oas-color-primary);
  }
  .kbd-hint {
    font-family: var(--app-mono);
    font-size: 10px;
    line-height: 1;
    color: var(--oas-color-text-secondary);
    border: 1px solid var(--oas-color-border);
    border-radius: 4px;
    padding: 3px 6px;
    user-select: none;
  }
  .theme-dot {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }
  .theme-dot::before {
    content: "";
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--oas-color-border);
    background: transparent;
    box-shadow: inset 4px 2px 0 0 var(--oas-color-text-primary);
  }
  /* 暗色主题下的日/月切换点：conic-gradient 画月相 */
  :global(html[data-theme="dark"]) .theme-dot::before {
    background:
      radial-gradient(circle, var(--oas-color-text-primary) 4px, transparent 5px),
      conic-gradient(
        from 0deg,
        var(--oas-color-text-primary) 0deg 12deg, transparent 12deg 33deg,
        var(--oas-color-text-primary) 33deg 45deg, transparent 45deg 66deg,
        var(--oas-color-text-primary) 66deg 78deg, transparent 78deg 99deg,
        var(--oas-color-text-primary) 99deg 111deg, transparent 111deg 132deg,
        var(--oas-color-text-primary) 132deg 144deg, transparent 144deg 165deg,
        var(--oas-color-text-primary) 165deg 177deg, transparent 177deg 198deg,
        var(--oas-color-text-primary) 198deg 210deg, transparent 210deg 231deg,
        var(--oas-color-text-primary) 231deg 243deg, transparent 243deg 264deg,
        var(--oas-color-text-primary) 264deg 276deg, transparent 276deg 297deg,
        var(--oas-color-text-primary) 297deg 309deg, transparent 309deg 330deg,
        var(--oas-color-text-primary) 330deg 342deg, transparent 342deg 360deg
      );
    box-shadow: none;
    border: none;
  }
  .icon-btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    color: var(--oas-color-text-primary);
  }
  .icon-btn:hover {
    background: var(--oas-color-bg-hover);
  }
  .icon-btn:focus-visible {
    outline: none;
    box-shadow: var(--oas-focus-ring);
  }
  .fullscreen-btn .fs-compress {
    display: none;
  }
  .fullscreen-btn.is-fullscreen .fs-compress {
    display: inline-flex;
  }
  .fullscreen-btn.is-fullscreen .fs-expand {
    display: none;
  }
  /* 通知 badge 数字变化时的弹跳动画 */
  #notif-badge.is-pop::part(badge) {
    animation: notifBadgePop 300ms var(--oas-ease-out);
  }
  @keyframes notifBadgePop {
    0% { scale: 0.6; }
    60% { scale: 1.15; }
    100% { scale: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    #notif-badge.is-pop::part(badge) {
      animation: none;
    }
  }
  /* ☰ 折叠钮：桌面隐藏，移动端显示 */
  .nav-toggle {
    display: none;
  }
  @media (max-width: 768px) {
    .app-header {
      padding-left: var(--oas-space-4);
    }
    .nav-toggle {
      display: inline-flex;
    }
    @media (pointer: coarse) {
      .nav-toggle::part(button) {
        min-height: 44px;
      }
    }
    .global-search,
    .fullscreen-btn {
      display: none;
    }
  }
</style>
