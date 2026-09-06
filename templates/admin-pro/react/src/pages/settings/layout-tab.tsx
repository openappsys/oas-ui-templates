// src/pages/settings/layout-tab.tsx —— 布局与导航 Tab：菜单形态矩阵（置顶）/多页签栏/路由模式（底部）
//   矩阵点击调 setMenuStyle/setMenuPosition 并派 'oas:navconfig-change'（AppShell 订阅重建壳）；
//   多页签栏写 TABS_BAR_KEY 后 applySettings()；路由模式 modal.confirm 二次确认后 applyRouterMode 整页刷新。
// （非 oas-modal/oas-drawer panel，不命中 例外）；
// modal.confirm 的确认按钮在 oas-modal panel 内，其原生 click 被 stopPropagation——
// 但确认动作走 modal.confirm 的 onOk 选项（库内部直绑），无需也不应手动绑事件。
import { Fragment, useRef, useState } from 'react'
import { modal } from '@oas-ui/ui'
import { useOasEvent } from '../../hooks/use-oas-event'
import { useT } from '../../hooks/use-t'
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

export function LayoutTab() {
  const { t } = useT()
  const [nav, setNav] = useState(navConfig)
  const [tabsBar, setTabsBar] = useState(readTabsBar)
  const [mode, setMode] = useState<RouterMode>(routerMode)
  const tabsBarRef = useRef<HTMLElement | null>(null)
  const routerModeRef = useRef<HTMLElement | null>(null)

  useOasEvent<{ checked: boolean }>(tabsBarRef, 'oas-change', (detail) => {
    localStorage.setItem(TABS_BAR_KEY, String(detail.checked))
    applySettings()
    setTabsBar(detail.checked)
    appMessage.success(t('common.saved'))
  })

  useOasEvent<{ value: string }>(routerModeRef, 'oas-change', (detail) => {
    const v = detail.value
    if (v !== 'hash' && v !== 'history') return
    setMode(v)
    if (v === routerMode()) return
    // 切换会整页刷新，二次确认防误触
    modal.confirm({
      title: t('settings.general.routerModeConfirmTitle'),
      content: t('settings.general.routerModeConfirmContent'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => applyRouterMode(v),
    })
  })

  const onMatrixClick = (e: React.MouseEvent): void => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.menu-matrix-cell')
    if (!cell || cell.hasAttribute('disabled')) return
    const style = cell.dataset.style as MenuStyle
    const position = cell.dataset.position as MenuPosition
    if (!canPosition(style, position)) return
    setMenuStyle(style)
    setMenuPosition(position)
    setNav({ style, position })
    window.dispatchEvent(new CustomEvent('oas:navconfig-change'))
  }

  return (
    <>
      <div className="setting-group">
        <div className="setting-label setting-group-title">
          {t('settings.general.menuStyleLabel')}
        </div>
        <div className="setting-hint">{t('settings.general.menuStyleHint')}</div>
        <div
          className="menu-matrix"
          data-testid="menu-matrix"
          role="radiogroup"
          aria-label={t('settings.general.menuStyleLabel')}
          onClick={onMatrixClick}
        >
          <div className="menu-matrix-corner" />
          {MENU_POSITIONS_META.map((p) => (
            <div key={p.value} className="menu-matrix-head">
              {t(`settings.general.${p.labelKey}`)}
            </div>
          ))}
          {/* 行=形态、列=位置；sidebar+top/top-head 不可选（禁用），见 layout-config.canPosition */}
          {MENU_STYLES_META.map((s) => (
            <Fragment key={s.value}>
              <div className="menu-matrix-rowlabel">{t(`settings.general.${s.labelKey}`)}</div>
              {MENU_POSITIONS_META.map((p) => {
                const ok = canPosition(s.value, p.value)
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`menu-matrix-cell${ok ? '' : ' is-disabled'}`}
                    role="radio"
                    data-style={s.value}
                    data-position={p.value}
                    disabled={!ok}
                    aria-checked={nav.style === s.value && nav.position === p.value}
                    aria-label={`${t(`settings.general.${s.labelKey}`)} · ${t(`settings.general.${p.labelKey}`)}`}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.general.tabsBarLabel')}</div>
            <div className="setting-hint">{t('settings.general.tabsBarHint')}</div>
          </div>
          <oas-switch ref={tabsBarRef} data-testid="tabs-bar-toggle" checked={tabsBar} />
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.general.routerModeLabel')}</div>
            <div className="setting-hint">{t('settings.general.routerModeHint')}</div>
          </div>
          <oas-select
            ref={routerModeRef}
            data-testid="router-mode"
            value={mode}
            options={JSON.stringify([
              { label: t('settings.general.routerModeHash'), value: 'hash' },
              { label: t('settings.general.routerModeHistory'), value: 'history' },
            ])}
          />
        </div>
      </div>
    </>
  )
}
