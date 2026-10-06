/**
 * 设置中心页（自 vanilla src/pages/settings.ts 去 TS 移植，DOM/类名/testid 对齐）
 * 四 Tab（外观/布局/数据/通知）+ 即时生效控件；面板 HTML 在 settings-panels.js
 * cdn 偏差：路由模式控件不渲染（哈希单模式）；settings-init 逻辑见 js/settings.js（前缀 oas-admin-cdn.*）
 */
import { onLocaleChange, t } from './i18n.js'
import {
  applyDensity,
  applyFontSize,
  applySettings,
  applySkin,
  applyGlass,
  canPosition,
  currentTheme,
  CUSTOM_TOKENS_KEY,
  DEFAULT_COLOR,
  DEFAULT_RADIUS,
  DENSITY_KEY,
  FONT_SIZE_KEY,
  FORM_MODE_KEY,
  GLASS_KEY,
  navConfig,
  NOTIF_PREFIX,
  PAGE_SIZE_KEY,
  RADIUS_KEY,
  setMenuPosition,
  setMenuStyle,
  SKIN_KEY,
  TABS_BAR_KEY,
  THEME_PREFIX,
} from './js/settings.js'
import {
  appearanceHtml,
  dataHtml,
  layoutHtml,
  notificationHtml,
  TAB_LAYOUT_OPTIONS,
} from './settings-panels.js'

function draw(el) {
  const tabsLayoutKey = 'oas-admin-cdn.settings.tabs-layout'
  const readTabLayout = () =>
    localStorage.getItem(tabsLayoutKey) === 'vertical' ? 'vertical' : 'horizontal'
  const tabs = document.createElement('oas-tabs')
  tabs.setAttribute('data-testid', 'settings-tabs')
  tabs.setAttribute('id', 'settings-tabs')
  function setTabsLayout(layout) {
    // 用 oas-tabs 官方 tab-position（top/left/right）驱动 tab 位置布局——组件自动切换 internal class（vertical/left/right）
    if (layout === 'vertical') tabs.setAttribute('tab-position', 'left')
    else tabs.removeAttribute('tab-position')
  }
  setTabsLayout(readTabLayout())

  function panel(value) {
    const node = document.createElement('div')
    node.className = 'settings-panel'
    node.dataset.panel = value
    return node
  }

  const appearance = panel('appearance')
  const layout = panel('layout')
  const data = panel('data')
  const notification = panel('notification')

  el.innerHTML = `
    <div class="page settings-page">
      <div class="page-head">
        <div>
          <h1 class="page-title">${t('nav.settings')}</h1>
          <p class="page-subtitle">${t('settings.subtitle')}</p>
        </div>
        <oas-segmented id="settings-tabs-layout" data-testid="settings-tabs-layout" value="${readTabLayout()}" options='${JSON.stringify(TAB_LAYOUT_OPTIONS())}'></oas-segmented>
      </div>
      <oas-card class="settings-card"></oas-card>
    </div>`

  const card = el.querySelector('.settings-card')
  card.appendChild(tabs)
  // 标准 oas-tabs 结构：内容作为 oas-tab-panel 子元素（slot 投射），oas-tabs 自动管理 tab 头部 + 面板显隐 + 位置（left/right）
  const defs = [
    { value: 'appearance', node: appearance, titleKey: 'settings.tab.appearance' },
    { value: 'layout', node: layout, titleKey: 'settings.tab.layout' },
    { value: 'data', node: data, titleKey: 'settings.tab.data' },
    { value: 'notification', node: notification, titleKey: 'settings.tab.notification' },
  ]
  for (const d of defs) {
    const tabPanel = document.createElement('oas-tab-panel')
    tabPanel.setAttribute('label', t(d.titleKey))
    tabPanel.setAttribute('value', d.value)
    tabPanel.appendChild(d.node)
    tabs.appendChild(tabPanel)
  }
  tabs.setAttribute('active', 'appearance')
  setTabsLayout(readTabLayout())

  const tabsLayout = el.querySelector('#settings-tabs-layout')
  tabsLayout.addEventListener('oas-change', (e) => {
    const v = e.detail.value
    if (v !== 'vertical' && v !== 'horizontal') return
    // 即时生效的布局切换，无需 toast
    localStorage.setItem(tabsLayoutKey, v)
    setTabsLayout(v)
  })

  appearance.innerHTML = appearanceHtml()
  layout.innerHTML = layoutHtml()
  data.innerHTML = dataHtml()
  notification.innerHTML = notificationHtml()

  const formModeGroup = data.querySelector('#form-mode-group')
  const densityGroup = appearance.querySelector('#density-group')
  const fontSizeGroup = appearance.querySelector('#font-size-group')
  const pageSize = data.querySelector('[data-testid="page-size"]')
  const tabsBarToggle = layout.querySelector('[data-testid="tabs-bar-toggle"]')
  const notifMatrix = notification.querySelector('#notif-matrix')
  const colorPicker = appearance.querySelector('#appearance-color')
  const radiusSlider = appearance.querySelector('#appearance-radius')
  const radiusValue = appearance.querySelector('#radius-value')
  const resetBtn = appearance.querySelector('[data-testid="appearance-reset"]')
  const themeEditor = appearance.querySelector('#settings-theme-editor')

  // 主题编辑器：每次修改把 token 持久化，重启后由 settings.applyCustomTokens 重放
  themeEditor?.addEventListener('oas-change', (e) => {
    const { token, value } = e.detail
    if (typeof token !== 'string' || !token.startsWith('--')) return
    try {
      const raw = localStorage.getItem(CUSTOM_TOKENS_KEY)
      const map = raw ? JSON.parse(raw) : {}
      if (value == null || value === '') delete map[token]
      else map[token] = value
      localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(map))
    } catch {
      /* ignore */
    }
  })

  formModeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0]
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (!v) return
    localStorage.setItem(FORM_MODE_KEY, v)
    OASUI.message.success(t('common.saved'))
  })

  densityGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0]
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (!v) return
    localStorage.setItem(DENSITY_KEY, v)
    applyDensity()
    OASUI.message.success(t('common.saved'))
  })

  fontSizeGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0]
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value')
    if (!v) return
    localStorage.setItem(FONT_SIZE_KEY, v)
    applyFontSize()
    OASUI.message.success(t('common.saved'))
  })

  pageSize.addEventListener('oas-change', (e) => {
    const v = e.detail.value
    if (!v) return
    localStorage.setItem(PAGE_SIZE_KEY, v)
    OASUI.message.success(t('common.saved'))
  })

  tabsBarToggle.addEventListener('oas-change', (e) => {
    const checked = e.detail.checked
    localStorage.setItem(TABS_BAR_KEY, String(checked))
    applySettings()
    OASUI.message.success(t('common.saved'))
  })

  // cdn 偏差：路由模式控件不渲染（哈希单模式），对应监听一并省略

  const matrix = layout.querySelector('[data-testid="menu-matrix"]')
  // 形态/位置持久化 + 刷新标记；壳层监听 nav-config-change 事件实时重渲导航（vanilla live 切换同语义）
  const refreshMatrixMark = () => {
    const { style, position } = navConfig()
    matrix.querySelectorAll('.menu-matrix-cell').forEach((cell) => {
      cell.setAttribute(
        'aria-checked',
        String(cell.dataset.style === style && cell.dataset.position === position),
      )
    })
  }

  matrix.addEventListener('click', (e) => {
    const cell = e.target.closest('.menu-matrix-cell')
    if (!cell || cell.hasAttribute('disabled')) return
    const style = cell.dataset.style
    const position = cell.dataset.position
    if (!canPosition(style, position)) return
    setMenuStyle(style)
    setMenuPosition(position)
    refreshMatrixMark()
    document.dispatchEvent(new CustomEvent('nav-config-change'))
  })

  refreshMatrixMark()

  notifMatrix.addEventListener('oas-change', (e) => {
    const sw = e.composedPath()[0]
    const key = sw.getAttribute('data-key')
    if (!key) return
    localStorage.setItem(NOTIF_PREFIX + key, String(e.detail.checked))
  })

  function applyColor(color) {
    document.documentElement.style.setProperty('--oas-color-primary', color)
    localStorage.setItem(`${THEME_PREFIX}${currentTheme()}`, color)
  }

  // 自定义主色与皮肤互斥：写 inline 主色即回默认皮肤（皮肤的品牌色族让位）
  function onCustomColor(color) {
    document.documentElement.removeAttribute('data-skin')
    localStorage.setItem(SKIN_KEY, '')
    applyColor(color)
  }

  colorPicker.addEventListener('oas-change', (e) => {
    const color = e.detail.value
    if (!color) return
    onCustomColor(color)
  })

  // 预设色板：一键切换（拾色器保留精确自定义，二者写同一 applyColor/持久化）
  const swatchGroup = appearance.querySelector('#appearance-swatch')
  swatchGroup.addEventListener('oas-change', (e) => {
    const color = e.detail.value
    if (!color) return
    onCustomColor(color)
    swatchGroup.setAttribute('value', color)
  })

  // 皮肤切换：写 data-skin + 持久化；皮肤接管品牌色族，需清 inline 自定义主色
  const skinGroup = appearance.querySelector('#skin-group')
  skinGroup.addEventListener('oas-change', (e) => {
    const radio = e.composedPath()[0]
    if (!radio.hasAttribute('checked')) return
    const v = radio.getAttribute('value') ?? ''
    localStorage.setItem(SKIN_KEY, v)
    document.documentElement.style.removeProperty('--oas-color-primary')
    localStorage.removeItem(`${THEME_PREFIX}${currentTheme()}`)
    applySkin(v)
    OASUI.message.success(t('common.saved'))
  })

  // 玻璃质感开关：写 data-glass + 持久化（启动由 applyGlass 恢复）
  const glassSwitch = appearance.querySelector('#appearance-glass')
  glassSwitch.addEventListener('oas-change', (e) => {
    const on = !!e.detail?.checked
    localStorage.setItem(GLASS_KEY, on ? 'on' : 'off')
    applyGlass(on)
  })
  radiusSlider.addEventListener('oas-change', (e) => {
    const n = Number(e.detail.value)
    if (!Number.isFinite(n)) return
    document.documentElement.style.setProperty('--oas-radius-md', `${n}px`)
    localStorage.setItem(RADIUS_KEY, String(n))
    radiusValue.textContent = `${n}px`
  })

  resetBtn.addEventListener('click', () => {
    localStorage.removeItem(`${THEME_PREFIX}light`)
    localStorage.removeItem(`${THEME_PREFIX}dark`)
    localStorage.removeItem(RADIUS_KEY)
    localStorage.removeItem(CUSTOM_TOKENS_KEY)
    localStorage.removeItem(SKIN_KEY)
    applySkin('')
    document.documentElement.style.removeProperty('--oas-color-primary')
    document.documentElement.style.removeProperty('--oas-radius-md')
    colorPicker.setAttribute('value', DEFAULT_COLOR)
    radiusSlider.setAttribute('value', String(DEFAULT_RADIUS))
    radiusValue.textContent = `${DEFAULT_RADIUS}px`
    themeEditor?.reset?.()
    OASUI.message.success(t('settings.appearance.resetDone'))
  })

  const onThemeChange = () => {
    const theme = currentTheme()
    const cp = appearance.querySelector('#appearance-color')
    cp.setAttribute('value', localStorage.getItem(`${THEME_PREFIX}${theme}`) || DEFAULT_COLOR)
    const sg = appearance.querySelector('#appearance-swatch')
    sg?.setAttribute('value', cp.getAttribute('value'))
    const stored = localStorage.getItem(`${THEME_PREFIX}${theme}`)
    if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
    else document.documentElement.style.removeProperty('--oas-color-primary')
  }

  document.addEventListener('themechange', onThemeChange)

  return () => {
    document.removeEventListener('themechange', onThemeChange)
  }
}

/** 语言切换时整体重画设置中心（dispose 旧监听 → 清空 → 重建） */
export function renderSettings(el) {
  document.title = `${t('nav.settings')} · ${t('app.title')}`
  let dispose = draw(el)
  const off = onLocaleChange(() => {
    document.title = `${t('nav.settings')} · ${t('app.title')}`
    dispose()
    el.innerHTML = ''
    dispose = draw(el)
  })
  return () => {
    off()
    dispose()
  }
}
