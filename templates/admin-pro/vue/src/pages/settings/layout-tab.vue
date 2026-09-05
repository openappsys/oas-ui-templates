<script setup lang="ts">
// src/pages/settings/layout-tab.vue —— 布局与导航 Tab：菜单形态矩阵（置顶）/多页签栏/路由模式（底部）
// 逐项对齐 vanilla settings.ts 布局段：
//   矩阵点击调 setMenuStyle/setMenuPosition 并派 'oas:navconfig-change'（AppShell 订阅重建壳）；
//   多页签栏写 TABS_BAR_KEY 后 applySettings()；路由模式 modal.confirm 二次确认后 applyRouterMode 整页刷新。
// Vue 化差异：矩阵单元格是模版渲染的原生 button，@click 直绑容器（事件委托）；
// modal.confirm 的确认动作走 onOk 选项（库内部直绑），无需也不应手动绑事件。
import { computed, ref } from 'vue'
import { modal } from '@oas-ui/ui'
import { useT } from '../../composables/use-t'
import { appMessage } from '../../lib/app-message'
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

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const nav = ref(navConfig())
const tabsBar = ref(readTabsBar())
const mode = ref<RouterMode>(routerMode())

function onTabsBarChange(e: Event): void {
  const { checked } = (e as CustomEvent<{ checked: boolean }>).detail
  localStorage.setItem(TABS_BAR_KEY, String(checked))
  applySettings()
  tabsBar.value = checked
  appMessage.success(tt('common.saved'))
}

function onRouterModeChange(e: Event): void {
  const v = (e as CustomEvent<{ value: string }>).detail.value
  if (v !== 'hash' && v !== 'history') return
  mode.value = v
  if (v === routerMode()) return
  // 切换会整页刷新，二次确认防误触
  modal.confirm({
    title: tt('settings.general.routerModeConfirmTitle'),
    content: tt('settings.general.routerModeConfirmContent'),
    okText: tt('common.confirm'),
    cancelText: tt('common.cancel'),
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
  nav.value = { style, position }
  window.dispatchEvent(new CustomEvent('oas:navconfig-change'))
}

const routerModeOptions = computed(() => {
  void locale.value
  return JSON.stringify([
    { label: tt('settings.general.routerModeHash'), value: 'hash' },
    { label: tt('settings.general.routerModeHistory'), value: 'history' },
  ])
})
</script>

<template>
  <div class="setting-group">
    <div class="setting-label setting-group-title">
      {{ t('settings.general.menuStyleLabel') }}
    </div>
    <div class="setting-hint">{{ t('settings.general.menuStyleHint') }}</div>
    <div
      class="menu-matrix"
      data-testid="menu-matrix"
      role="radiogroup"
      :aria-label="t('settings.general.menuStyleLabel')"
      @click="onMatrixClick"
    >
      <div class="menu-matrix-corner" />
      <div v-for="p in MENU_POSITIONS_META" :key="p.value" class="menu-matrix-head">
        {{ t(`settings.general.${p.labelKey}`) }}
      </div>
      <!-- 行=形态、列=位置；sidebar+top/top-head 不可选（禁用），见 layout-config.canPosition -->
      <template v-for="s in MENU_STYLES_META" :key="s.value">
        <div class="menu-matrix-rowlabel">{{ t(`settings.general.${s.labelKey}`) }}</div>
        <button
          v-for="p in MENU_POSITIONS_META"
          :key="p.value"
          type="button"
          class="menu-matrix-cell"
          :class="{ 'is-disabled': !canPosition(s.value, p.value) }"
          role="radio"
          :data-style="s.value"
          :data-position="p.value"
          :disabled="!canPosition(s.value, p.value)"
          :aria-checked="nav.style === s.value && nav.position === p.value"
          :aria-label="`${t(`settings.general.${s.labelKey}`)} · ${t(`settings.general.${p.labelKey}`)}`"
        />
      </template>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-row">
      <div>
        <div class="setting-label">{{ t('settings.general.tabsBarLabel') }}</div>
        <div class="setting-hint">{{ t('settings.general.tabsBarHint') }}</div>
      </div>
      <!-- checked 存在性语义（同 appearance-tab 注释） -->
      <oas-switch
        data-testid="tabs-bar-toggle"
        :checked="tabsBar ? '' : null"
        @oas-change="onTabsBarChange"
      />
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-row">
      <div>
        <div class="setting-label">{{ t('settings.general.routerModeLabel') }}</div>
        <div class="setting-hint">{{ t('settings.general.routerModeHint') }}</div>
      </div>
      <oas-select
        data-testid="router-mode"
        :value="mode"
        :options="routerModeOptions"
        @oas-change="onRouterModeChange"
      />
    </div>
  </div>
</template>
