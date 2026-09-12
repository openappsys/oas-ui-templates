<script lang="ts">
  // src/pages/settings.svelte —— 设置中心（外观 / 布局与导航 / 数据与列表 / 通知 四 Tab）
  // 受控值初始化自 settings-init 的 readXxx()；oas-change 自定义事件模板直绑；
  // 四个 Tab 面板拆为 ./settings/*-tab.svelte 子组件（单文件控制在 400 行内）
  import './settings.css'
  import { useT } from '../lib/use-t.svelte'
  import AppearanceTab from './settings/appearance-tab.svelte'
  import DataTab from './settings/data-tab.svelte'
  import LayoutTab from './settings/layout-tab.svelte'
  import NotificationTab from './settings/notification-tab.svelte'

  /** tab 横竖排持久化键 */
  const TABS_LAYOUT_KEY = 'oas-admin.settings.tabs-layout'

  type TabsLayout = 'horizontal' | 'vertical'

  function readTabsLayout(): TabsLayout {
    return localStorage.getItem(TABS_LAYOUT_KEY) === 'vertical' ? 'vertical' : 'horizontal'
  }

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let tabsLayout = $state<TabsLayout>(readTabsLayout())

  function onLayoutChange(e: Event): void {
    const v = (e as CustomEvent<{ value: string }>).detail.value
    if (v !== 'vertical' && v !== 'horizontal') return
    // 即时生效的布局切换，无需 toast
    localStorage.setItem(TABS_LAYOUT_KEY, v)
    tabsLayout = v
  }

  const segmentedOptions = $derived.by(() => {
    void $locale
    return JSON.stringify([
      { label: t('settings.tabsLayout.horizontal'), value: 'horizontal' },
      { label: t('settings.tabsLayout.vertical'), value: 'vertical' },
    ])
  })

  const panels = [
    { value: 'appearance', titleKey: 'settings.tab.appearance', content: AppearanceTab },
    { value: 'layout', titleKey: 'settings.tab.layout', content: LayoutTab },
    { value: 'data', titleKey: 'settings.tab.data', content: DataTab },
    { value: 'notification', titleKey: 'settings.tab.notification', content: NotificationTab },
  ]
</script>

<div class="page settings-page">
  <div class="page-head">
    <div>
      <h1 class="page-title">{tt('nav.settings')}</h1>
      <p class="page-subtitle">{tt('settings.subtitle')}</p>
    </div>
    <oas-segmented
      id="settings-tabs-layout"
      data-testid="settings-tabs-layout"
      value={tabsLayout}
      options={segmentedOptions}
      onoas-change={onLayoutChange}
    ></oas-segmented>
  </div>
  <oas-card class="settings-card">
    <!-- 标准 oas-tabs 结构：oas-tab-panel 子元素（slot 投射），组件自动管理 tab 头 + 面板显隐；
         竖排用官方 tab-position="left" 驱动。oas-tabs 只观察 childList——切语言时按 locale 重挂载 -->
    {#key $locale}
      <oas-tabs
        id="settings-tabs"
        data-testid="settings-tabs"
        active="appearance"
        tab-position={tabsLayout === 'vertical' ? 'left' : null}
      >
        {#each panels as p (p.value)}
          <oas-tab-panel label={tt(p.titleKey)} value={p.value}>
            <div class="settings-panel" data-panel={p.value}>
              <p.content />
            </div>
          </oas-tab-panel>
        {/each}
      </oas-tabs>
    {/key}
  </oas-card>
</div>
