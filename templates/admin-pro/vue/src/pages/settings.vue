<script setup lang="ts">
// src/pages/settings.vue —— 设置中心（外观 / 布局与导航 / 数据与列表 / 通知 四 Tab）
// 本模版 SFC + ref 受控值（初始化自 settings-init 的 readXxx()），
// oas-change 自定义事件模板直绑（Vue 原生支持 kebab 事件），
// 四个 Tab 面板拆为 ./settings/*-tab.vue 子组件（单文件控制在 400 行内）。
import { computed, ref } from 'vue'
import { useT } from '../composables/use-t'
import AppearanceTab from './settings/appearance-tab.vue'
import DataTab from './settings/data-tab.vue'
import LayoutTab from './settings/layout-tab.vue'
import NotificationTab from './settings/notification-tab.vue'

/** tab 横竖排持久化键（vanilla settings.ts 局部常量，此处保持一致） */
const TABS_LAYOUT_KEY = 'oas-admin.settings.tabs-layout'

type TabsLayout = 'horizontal' | 'vertical'

function readTabsLayout(): TabsLayout {
  return localStorage.getItem(TABS_LAYOUT_KEY) === 'vertical' ? 'vertical' : 'horizontal'
}

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const tabsLayout = ref<TabsLayout>(readTabsLayout())

function onLayoutChange(e: Event): void {
  const v = (e as CustomEvent<{ value: string }>).detail.value
  if (v !== 'vertical' && v !== 'horizontal') return
  // 即时生效的布局切换，无需 toast
  localStorage.setItem(TABS_LAYOUT_KEY, v)
  tabsLayout.value = v
}

const segmentedOptions = computed(() => {
  void locale.value
  return JSON.stringify([
    { label: tt('settings.tabsLayout.horizontal'), value: 'horizontal' },
    { label: tt('settings.tabsLayout.vertical'), value: 'vertical' },
  ])
})

const panels = [
  { value: 'appearance', titleKey: 'settings.tab.appearance', content: AppearanceTab },
  { value: 'layout', titleKey: 'settings.tab.layout', content: LayoutTab },
  { value: 'data', titleKey: 'settings.tab.data', content: DataTab },
  { value: 'notification', titleKey: 'settings.tab.notification', content: NotificationTab },
]
</script>

<template>
  <div class="page settings-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.settings') }}</h1>
        <p class="page-subtitle">{{ t('settings.subtitle') }}</p>
      </div>
      <oas-segmented
        id="settings-tabs-layout"
        data-testid="settings-tabs-layout"
        :value="tabsLayout"
        :options="segmentedOptions"
        @oas-change="onLayoutChange"
      />
    </div>
    <oas-card class="settings-card">
      <!-- 标准 oas-tabs 结构：oas-tab-panel 子元素（slot 投射），组件自动管理 tab 头 + 面板显隐；
           竖排用官方 tab-position="left" 驱动（vanilla setTabsLayout 同款） -->
      <oas-tabs
        id="settings-tabs"
        data-testid="settings-tabs"
        active="appearance"
        :tab-position="tabsLayout === 'vertical' ? 'left' : null"
      >
        <oas-tab-panel v-for="p in panels" :key="p.value" :label="t(p.titleKey)" :value="p.value">
          <div class="settings-panel" :data-panel="p.value">
            <component :is="p.content" />
          </div>
        </oas-tab-panel>
      </oas-tabs>
    </oas-card>
  </div>
</template>

<style>
/* 设置页样式（自 settings.css 迁入）：四个子 Tab（appearance/layout/notification/data）与父页共用，
   子组件模板元素不带父级 data-v 之外的隔离，故保留非 scoped 全局块（与迁移前 import 等价，仅就近放置） */
.settings-card oas-tabs {
  margin-bottom: var(--oas-space-4);
}
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-5);
}
.settings-panel[hidden] {
  display: none;
}
.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-3);
  padding-bottom: var(--oas-space-5);
  border-bottom: 1px solid var(--oas-color-border);
}
.setting-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.setting-group-title {
  font-size: var(--oas-font-size-md);
  font-weight: 600;
  color: var(--oas-color-text-primary);
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oas-space-4);
  flex-wrap: wrap;
}
.setting-row .setting-label {
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
}
.setting-hint {
  font-size: var(--oas-font-size-xs);
  color: var(--oas-color-text-secondary);
  margin-top: var(--oas-space-1);
}
.setting-row > oas-select {
  width: 160px;
}
.radio-group.inline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--oas-space-4);
  align-items: center;
}
.notif-matrix {
  display: flex;
  flex-direction: column;
  gap: var(--oas-space-1);
  width: 100%;
  max-width: 480px;
}
.notif-row {
  display: grid;
  grid-template-columns: 1fr 120px 120px;
  align-items: center;
  gap: var(--oas-space-2);
  padding: var(--oas-space-2) var(--oas-space-3);
  border-radius: var(--oas-radius-md);
}
.notif-row:not(.notif-head) {
  background: var(--oas-color-bg-hover);
}
.notif-head {
  color: var(--oas-color-text-secondary);
  font-size: var(--oas-font-size-xs);
}
.notif-channel {
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
}
.notif-col {
  text-align: center;
}
.radius-control {
  display: inline-flex;
  align-items: center;
  gap: var(--oas-space-3);
}
.radius-control oas-slider {
  width: 220px;
}
.radius-control .mono {
  min-width: 40px;
  text-align: right;
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
}

.menu-matrix {
  display: grid;
  grid-template-columns: auto repeat(4, 1fr);
  gap: var(--oas-space-2);
  align-items: stretch;
}
.menu-matrix-corner {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--oas-color-text-secondary);
  font-size: var(--oas-font-size-xs);
  padding: 4px;
}
.menu-matrix-head {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--oas-font-size-sm);
  font-weight: 500;
  color: var(--oas-color-text-secondary);
  padding: 4px;
  text-align: center;
}
.menu-matrix-rowlabel {
  display: flex;
  align-items: center;
  font-size: var(--oas-font-size-sm);
  color: var(--oas-color-text-primary);
  padding: 4px var(--oas-space-3);
  white-space: nowrap;
}
.menu-matrix-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid var(--oas-color-border);
  border-radius: var(--oas-radius-sm);
  background: var(--oas-color-bg-hover);
  color: var(--oas-color-text-secondary);
  cursor: pointer;
  font-size: var(--oas-font-size-md);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}
.menu-matrix-cell::after {
  content: "";
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--oas-color-border-strong);
  box-sizing: border-box;
}
.menu-matrix-cell:not(.is-disabled):hover {
  border-color: var(--oas-color-primary);
  color: var(--oas-color-primary);
}
.menu-matrix-cell[aria-checked="true"] {
  border-color: var(--oas-color-primary);
  background: var(--oas-color-primary-soft, rgba(24, 144, 255, 0.08));
  color: var(--oas-color-primary);
}
.menu-matrix-cell[aria-checked="true"]::after {
  border-color: var(--oas-color-primary);
  border-width: 5px;
}
.menu-matrix-cell.is-disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.menu-matrix-cell.is-disabled::after {
  border-color: var(--oas-color-border-strong);
}
</style>
