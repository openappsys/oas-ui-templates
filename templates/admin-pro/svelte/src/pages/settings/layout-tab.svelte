<script lang="ts">
  // src/pages/settings/layout-tab.svelte —— 布局与导航 Tab：菜单形态矩阵（置顶）/多页签栏/路由模式（底部）
  //   矩阵点击调 setMenuStyle/setMenuPosition 并派 'oas:navconfig-change'（AppShell 订阅重建壳）；
  //   多页签栏写 TABS_BAR_KEY 后 applySettings()；路由模式 modal.confirm 二次确认后 applyRouterMode 整页刷新。
  // modal.confirm 的确认按钮在 oas-modal panel 内，其原生 click 被 stopPropagation——
  // 但确认动作走 modal.confirm 的 onOk 选项（库内部直绑），无需也不应手动绑事件。
  import { modal } from '@oas-ui/ui'
  import { appMessage } from '../../lib/app-message'
  import { useT } from '../../lib/use-t.svelte'
  import {
    canPosition,
    navConfig,
    setMenuPosition,
    setMenuStyle,
    type MenuPosition,
    type MenuStyle,
  } from '../../layout-config'
  import { applyRouterMode, routerMode, type RouterMode } from '../../router/mode'
  import { TABS_BAR_KEY, applySettings, readTabsBar } from '../../settings-init'

  const MENU_STYLES_META: Array<{ value: MenuStyle; labelKey: string }> = [
    { value: 'sidebar', labelKey: 'menuStyleSidebar' },
    { value: 'menubar', labelKey: 'menuStyleMenubar' },
    { value: 'navigation', labelKey: 'menuStyleNavigation' },
  ]
  const MENU_POSITIONS_META: Array<{ value: MenuPosition; labelKey: string }> = [
    { value: 'left', labelKey: 'menuLeft' },
    { value: 'right', labelKey: 'menuRight' },
    { value: 'top', labelKey: 'menuTop' },
    { value: 'top-head', labelKey: 'menuTopHead' },
  ]

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let nav = $state(navConfig())
  let tabsBar = $state(readTabsBar())
  let mode = $state<RouterMode>(routerMode())

  const routerModeOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([
      { label: t('settings.general.routerModeHash'), value: 'hash' },
      { label: t('settings.general.routerModeHistory'), value: 'history' },
    ])
  })

  function onTabsBarChange(e: Event): void {
    const { checked } = (e as CustomEvent<{ checked: boolean }>).detail
    localStorage.setItem(TABS_BAR_KEY, String(checked))
    applySettings()
    tabsBar = checked
    appMessage.success(t('common.saved'))
  }

  function onRouterModeChange(e: Event): void {
    const v = (e as CustomEvent<{ value: string }>).detail.value
    if (v !== 'hash' && v !== 'history') return
    mode = v
    if (v === routerMode()) return
    // 切换会整页刷新，二次确认防误触
    modal.confirm({
      title: t('settings.general.routerModeConfirmTitle'),
      content: t('settings.general.routerModeConfirmContent'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => applyRouterMode(v),
    })
  }

  function onMatrixClick(e: MouseEvent): void {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.menu-matrix-cell')
    if (!cell || cell.hasAttribute('disabled')) return
    const style = cell.dataset.style as MenuStyle
    const position = cell.dataset.position as MenuPosition
    if (!canPosition(style, position)) return
    setMenuStyle(style)
    setMenuPosition(position)
    nav = { style, position }
    window.dispatchEvent(new CustomEvent('oas:navconfig-change'))
  }
</script>

<div class="setting-group">
  <div class="setting-label setting-group-title">{tt('settings.general.menuStyleLabel')}</div>
  <div class="setting-hint">{tt('settings.general.menuStyleHint')}</div>
  <!-- 矩阵单元格均为原生 button（可聚焦可键盘操作），容器 div 仅做点击委托 -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_interactive_supports_focus -->
  <div
    class="menu-matrix"
    data-testid="menu-matrix"
    role="radiogroup"
    aria-label={tt('settings.general.menuStyleLabel')}
    onclick={onMatrixClick}
  >
    <div class="menu-matrix-corner"></div>
    {#each MENU_POSITIONS_META as p (p.value)}
      <div class="menu-matrix-head">{tt(`settings.general.${p.labelKey}`)}</div>
    {/each}
    <!-- 行=形态、列=位置；sidebar+top/top-head 不可选（禁用），见 layout-config.canPosition -->
    {#each MENU_STYLES_META as s (s.value)}
      <div class="menu-matrix-rowlabel">{tt(`settings.general.${s.labelKey}`)}</div>
      {#each MENU_POSITIONS_META as p (p.value)}
        {@const ok = canPosition(s.value, p.value)}
        <button
          type="button"
          class="menu-matrix-cell"
          class:is-disabled={!ok}
          role="radio"
          data-style={s.value}
          data-position={p.value}
          disabled={!ok}
          aria-checked={nav.style === s.value && nav.position === p.value}
          aria-label={`${tt(`settings.general.${s.labelKey}`)} · ${tt(`settings.general.${p.labelKey}`)}`}
        ></button>
      {/each}
    {/each}
  </div>
</div>
<div class="setting-group">
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.general.tabsBarLabel')}</div>
      <div class="setting-hint">{tt('settings.general.tabsBarHint')}</div>
    </div>
    <oas-switch
      data-testid="tabs-bar-toggle"
      checked={tabsBar ? '' : null}
      onoas-change={onTabsBarChange}
    ></oas-switch>
  </div>
</div>
<div class="setting-group">
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.general.routerModeLabel')}</div>
      <div class="setting-hint">{tt('settings.general.routerModeHint')}</div>
    </div>
    <oas-select
      data-testid="router-mode"
      value={mode}
      options={routerModeOptions}
      onoas-change={onRouterModeChange}
    ></oas-select>
  </div>
</div>
