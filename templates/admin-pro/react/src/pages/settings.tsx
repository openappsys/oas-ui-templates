// src/pages/settings.tsx —— 设置中心（外观 / 布局与导航 / 数据与列表 / 通知 四 Tab）
// 本模版 JSX + useState 受控值（初始化自 settings-init 的 readXxx()），
// oas-change 自定义事件一律走 useOasEvent（React 19 不绑 kebab 事件），
// 四个 Tab 面板拆为 ./settings/*-tab.tsx 子组件（单文件控制在 400 行内）。
import { useRef, useState } from 'react'
import './settings.css'
import { useOasEvent } from '../hooks/use-oas-event'
import { useT } from '../hooks/use-t'
import { AppearanceTab } from './settings/appearance-tab'
import { DataTab } from './settings/data-tab'
import { LayoutTab } from './settings/layout-tab'
import { NotificationTab } from './settings/notification-tab'

/** tab 横竖排持久化键（vanilla settings.ts 局部常量，此处保持一致） */
const TABS_LAYOUT_KEY = 'oas-admin.settings.tabs-layout'

type TabsLayout = 'horizontal' | 'vertical'

function readTabsLayout(): TabsLayout {
  return localStorage.getItem(TABS_LAYOUT_KEY) === 'vertical' ? 'vertical' : 'horizontal'
}

export default function SettingsPage() {
  const { t } = useT()
  const [tabsLayout, setTabsLayout] = useState<TabsLayout>(readTabsLayout)
  const segmentedRef = useRef<HTMLElement | null>(null)

  useOasEvent<{ value: string }>(segmentedRef, 'oas-change', (detail) => {
    const v = detail.value
    if (v !== 'vertical' && v !== 'horizontal') return
    // 即时生效的布局切换，无需 toast
    localStorage.setItem(TABS_LAYOUT_KEY, v)
    setTabsLayout(v)
  })

  const panels: Array<{ value: string; titleKey: string; content: React.ReactNode }> = [
    { value: 'appearance', titleKey: 'settings.tab.appearance', content: <AppearanceTab /> },
    { value: 'layout', titleKey: 'settings.tab.layout', content: <LayoutTab /> },
    { value: 'data', titleKey: 'settings.tab.data', content: <DataTab /> },
    { value: 'notification', titleKey: 'settings.tab.notification', content: <NotificationTab /> },
  ]

  return (
    <div className="page settings-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.settings')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
        <oas-segmented
          ref={segmentedRef}
          id="settings-tabs-layout"
          data-testid="settings-tabs-layout"
          value={tabsLayout}
          options={JSON.stringify([
            { label: t('settings.tabsLayout.horizontal'), value: 'horizontal' },
            { label: t('settings.tabsLayout.vertical'), value: 'vertical' },
          ])}
        />
      </div>
      <oas-card className="settings-card">
        {/* 标准 oas-tabs 结构：oas-tab-panel 子元素（slot 投射），组件自动管理 tab 头 + 面板显隐；
            竖排用官方 tab-position="left" 驱动（vanilla setTabsLayout 同款） */}
        <oas-tabs
          id="settings-tabs"
          data-testid="settings-tabs"
          active="appearance"
          tab-position={tabsLayout === 'vertical' ? 'left' : undefined}
        >
          {panels.map((p) => (
            <oas-tab-panel key={p.value} label={t(p.titleKey)} value={p.value}>
              <div className="settings-panel" data-panel={p.value}>
                {p.content}
              </div>
            </oas-tab-panel>
          ))}
        </oas-tabs>
      </oas-card>
    </div>
  )
}
