<script setup lang="ts">
// src/pages/settings.vue —— 设置中心（外观 / 布局与导航 / 数据与列表 / 通知 四 Tab）
// 本模版 SFC + ref 受控值（初始化自 settings-init 的 readXxx()），
// oas-change 自定义事件模板直绑（Vue 原生支持 kebab 事件），
// 四个 Tab 面板拆为 ./settings/*-tab.vue 子组件（单文件控制在 400 行内）。
import { computed, ref } from 'vue'
import '../styles/pages/settings.css'
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
