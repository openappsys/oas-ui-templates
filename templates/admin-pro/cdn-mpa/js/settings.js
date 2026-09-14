import { guard } from './session.js'
import { initShell } from './shell.js'
import { applyStaticTexts, t, tf } from './i18n.js'

// 登录守卫与页面渲染入口放在模块末尾（先完成常量/函数定义，避免 TDZ）
function boot() {
  document.title = `${t('nav.settings')} · ${t('app.title')}`
  applyStaticTexts()
  initShell({ active: './settings.html' })
  window.OASShell.setBreadcrumb([{ label: 'nav.settings' }])
  renderSettings()
}

// ── localStorage 键（前缀 oas-admin-cdn-mpa.*，对齐 vanilla settings-init.ts）──
// 注意：fouc.js 里有同逻辑的启动重放（外观四件套），改键名须两处同步
const CUSTOM_TOKENS_KEY = 'oas-admin-cdn-mpa.settings.custom-tokens'
const FORM_MODE_KEY = 'oas-admin-cdn-mpa.form-mode'
const DENSITY_KEY = 'oas-admin-cdn-mpa.settings.table-density'
const PAGE_SIZE_KEY = 'oas-admin-cdn-mpa.settings.page-size'
const RADIUS_KEY = 'oas-admin-cdn-mpa.settings.radius'
const FONT_SIZE_KEY = 'oas-admin-cdn-mpa.settings.font-size'
const THEME_PREFIX = 'oas-admin-cdn-mpa.settings.theme.'
const NOTIF_PREFIX = 'oas-admin-cdn-mpa.settings.notif.'
const TABS_BAR_KEY = 'oas-admin-cdn-mpa.settings.tabs-bar'
const TABS_LAYOUT_KEY = 'oas-admin-cdn-mpa.settings.tabs-layout'
const MENU_STYLE_KEY = 'oas-admin-cdn-mpa.menu-style'
const MENU_POSITION_KEY = 'oas-admin-cdn-mpa.menu-position'

const DEFAULT_COLOR = '#0b6cff'
const DEFAULT_RADIUS = 6

// 菜单形态 × 位置矩阵：sidebar 不支持横置（top / top-head 禁用），对齐 vanilla layout-config.ts
const MENU_STYLES = ['sidebar', 'menubar', 'navigation']
const MENU_POSITIONS = ['left', 'right', 'top', 'top-head']
function canPosition(style, position) {
  if (style === 'sidebar' && (position === 'top' || position === 'top-head')) return false
  return true
}

function readBool(key, fallback) {
  const v = localStorage.getItem(key)
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function readColor() {
  const stored = localStorage.getItem(`${THEME_PREFIX}${currentTheme()}`)
  if (stored) return stored
  const live = getComputedStyle(document.documentElement)
    .getPropertyValue('--oas-color-primary')
    .trim()
  return live || DEFAULT_COLOR
}

function readRadius() {
  const n = Number(localStorage.getItem(RADIUS_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RADIUS
}

function fontSizeOptions() {
  return ['xs', 'sm', 'md', 'lg', 'xl'].map((v) => ({
    label: t(`settings.fontSize.${v}`),
    value: v,
  }))
}

function densityOptions() {
  return [
    { label: t('settings.density.compact'), value: 'compact' },
    { label: t('settings.density.default'), value: 'default' },
    { label: t('settings.density.large'), value: 'large' },
  ]
}

function formModeOptions() {
  return [
    {
      value: 'dialog',
      label: t('settings.formMode.dialog'),
      desc: t('settings.formMode.dialogDesc'),
    },
    {
      value: 'drawer',
      label: t('settings.formMode.drawer'),
      desc: t('settings.formMode.drawerDesc'),
    },
    { value: 'page', label: t('settings.formMode.page'), desc: t('settings.formMode.pageDesc') },
  ]
}

function pageSizeOptions() {
  return [5, 10, 20, 50].map((n) => ({
    label: tf('settings.pageSizeItem', { count: n }),
    value: String(n),
  }))
}

function tabLayoutOptions() {
  return [
    { label: t('settings.tabsLayout.horizontal'), value: 'horizontal' },
    { label: t('settings.tabsLayout.vertical'), value: 'vertical' },
  ]
}

// 单选组渲染：radio-group 容器 + 选项（可选 desc 两行式）
function radioGroup(group, name, options, checkedValue, withDesc) {
  group.replaceChildren(
    ...options.map((o) => {
      const radio = document.createElement('oas-radio')
      radio.setAttribute('name', name)
      radio.setAttribute('value', o.value)
      if (o.value === checkedValue) radio.setAttribute('checked', '')
      if (withDesc) {
        const item = document.createElement('span')
        item.className = 'radio-item'
        const label = document.createElement('span')
        label.className = 'radio-label'
        label.textContent = o.label
        const desc = document.createElement('span')
        desc.className = 'radio-desc'
        desc.textContent = o.desc
        item.appendChild(label)
        item.appendChild(desc)
        radio.appendChild(item)
      } else {
        radio.textContent = o.label
      }
      return radio
    }),
  )
}

function renderSettings() {
  const tabs = document.querySelector('#settings-tabs')
  const panels = {
    appearance: document.querySelector('[data-panel="appearance"]'),
    layout: document.querySelector('[data-panel="layout"]'),
    data: document.querySelector('[data-panel="data"]'),
    notification: document.querySelector('[data-panel="notification"]'),
  }

  // Tab 布局（横排 / 竖排）：官方 tab-position 驱动
  const tabsLayout = document.querySelector('#settings-tabs-layout')
  const readTabsLayout = () =>
    localStorage.getItem(TABS_LAYOUT_KEY) === 'vertical' ? 'vertical' : 'horizontal'
  function setTabsLayout(layout) {
    if (layout === 'vertical') tabs.setAttribute('tab-position', 'left')
    else tabs.removeAttribute('tab-position')
  }
  tabsLayout.setAttribute('options', JSON.stringify(tabLayoutOptions()))
  tabsLayout.setAttribute('value', readTabsLayout())
  setTabsLayout(readTabsLayout())
  tabsLayout.addEventListener('oas-change', (e) => {
    const v = e.detail?.value
    if (v !== 'vertical' && v !== 'horizontal') return
    localStorage.setItem(TABS_LAYOUT_KEY, v)
    setTabsLayout(v)
  })
  tabs.setAttribute('active', 'appearance')

  // ── 外观：主题色 / 圆角 / 字号 / 表格密度 / 主题编辑器 / 重置 ──
  panels.appearance.innerHTML = `
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.appearance.primaryLabel')}</div>
          <div class="setting-hint">${t('settings.appearance.primaryHint')}</div>
        </div>
        <oas-color-picker data-testid="appearance-color" id="appearance-color" value="${readColor()}"></oas-color-picker>
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.appearance.radiusLabel')}</div>
          <div class="setting-hint">${t('settings.appearance.radiusHint')}</div>
        </div>
        <div class="radius-control">
          <oas-slider data-testid="appearance-radius" id="appearance-radius" min="1" max="12" step="1" value="${readRadius()}"></oas-slider>
          <span id="radius-value" class="mono">${readRadius()}px</span>
        </div>
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.general.fontSizeTitle')}</div>
      <div class="radio-group inline" data-testid="font-size-group" id="font-size-group"></div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.general.densityTitle')}</div>
      <div class="radio-group inline" data-testid="density-group" id="density-group"></div>
    </div>
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.appearance.themeEditorTitle')}</div>
      <div class="setting-hint">${t('settings.appearance.themeEditorHint')}</div>
      <oas-theme-editor data-testid="settings-theme-editor" id="settings-theme-editor"></oas-theme-editor>
    </div>
    <div class="setting-group">
      <oas-button data-testid="appearance-reset" type="default">${t('settings.appearance.reset')}</oas-button>
    </div>`

  // ── 布局与导航：菜单形态矩阵 / 多页签栏开关 ──
  // 差异说明：vanilla 的「路由模式」控件此处不渲染——cdn-mpa 为原生多页应用，
  // 无 hash/history 双路由模式概念，隐藏该控件（i18n key settings.general.routerMode* 保留未用）
  const matrixStyle = localStorage.getItem(MENU_STYLE_KEY) ?? 'sidebar'
  const matrixPosition = localStorage.getItem(MENU_POSITION_KEY) ?? 'left'
  const matrixHeader =
    `<div class="menu-matrix-corner"></div>` +
    MENU_POSITIONS.map(
      (p) =>
        `<div class="menu-matrix-head">${t(`settings.general.menu${p[0].toUpperCase()}${p.slice(1)}`.replace('Top-head', 'TopHead'))}</div>`,
    ).join('')
  const matrixRows = MENU_STYLES.map((s) => {
    const styleLabelKey = `settings.general.menuStyle${s[0].toUpperCase()}${s.slice(1)}`
    return (
      `<div class="menu-matrix-rowlabel">${t(styleLabelKey)}</div>` +
      MENU_POSITIONS.map((p) => {
        const ok = canPosition(s, p)
        const posLabelKey = `settings.general.menu${p[0].toUpperCase()}${p.slice(1)}`.replace(
          'Top-head',
          'TopHead',
        )
        return `<button type="button" class="menu-matrix-cell${ok ? '' : ' is-disabled'}" role="radio" data-style="${s}" data-position="${p}"${ok ? '' : ' disabled'} aria-label="${t(styleLabelKey)} · ${t(posLabelKey)}"></button>`
      }).join('')
    )
  }).join('')
  panels.layout.innerHTML = `
    <div class="setting-group">
      <div class="setting-label setting-group-title">${t('settings.general.menuStyleLabel')}</div>
      <div class="setting-hint">${t('settings.general.menuStyleHint')}</div>
      <div class="menu-matrix" data-testid="menu-matrix" role="radiogroup" aria-label="${t('settings.general.menuStyleLabel')}">
        ${matrixHeader}
        ${matrixRows}
      </div>
    </div>
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.general.tabsBarLabel')}</div>
          <div class="setting-hint">${t('settings.general.tabsBarHint')}</div>
        </div>
        <oas-switch data-testid="tabs-bar-toggle"${readBool(TABS_BAR_KEY, true) ? ' checked' : ''}></oas-switch>
      </div>
    </div>`

  // ── 数据与列表：表单呈现方式 / 每页条数 ──
  panels.data.innerHTML = `
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.general.formModeTitle')}</div>
      <div class="form-hint">${t('settings.general.formModeHint')}</div>
      <div class="radio-group" data-testid="form-mode-group" id="form-mode-group"></div>
    </div>
    <div class="setting-group">
      <div class="setting-row">
        <div>
          <div class="setting-label">${t('settings.general.pageSizeLabel')}</div>
          <div class="setting-hint">${t('settings.general.pageSizeHint')}</div>
        </div>
        <oas-select data-testid="page-size" options='${JSON.stringify(pageSizeOptions())}' value="${localStorage.getItem(PAGE_SIZE_KEY) ?? '5'}"></oas-select>
      </div>
    </div>`

  // ── 通知：3 类通知 × 2 渠道开关矩阵 ──
  const notifRows = [
    { key: 'orders', label: t('settings.notif.orders') },
    { key: 'inventory', label: t('settings.notif.inventory') },
    { key: 'system', label: t('settings.notif.system') },
  ]
  const notifChannels = [
    { key: 'inapp', label: t('settings.notif.inapp') },
    { key: 'email', label: t('settings.notif.email') },
  ]
  panels.notification.innerHTML = `
    <div class="setting-group">
      <div class="setting-group-title">${t('settings.notif.title')}</div>
      <div class="notif-matrix" data-testid="notif-matrix" id="notif-matrix">
        <div class="notif-row notif-head">
          <span>${t('settings.notif.type')}</span>
          ${notifChannels.map((c) => `<span class="notif-col">${c.label}</span>`).join('')}
        </div>
        ${notifRows
          .map(
            (row) => `
          <div class="notif-row">
            <span class="notif-channel">${row.label}</span>
            ${notifChannels
              .map(
                (c) =>
                  `<span class="notif-col"><oas-switch data-testid="notif-${row.key}-${c.key}" data-key="${row.key}.${c.key}"${readBool(NOTIF_PREFIX + row.key + '.' + c.key, true) ? ' checked' : ''}></oas-switch></span>`,
              )
              .join('')}
          </div>`,
          )
          .join('')}
      </div>
    </div>`

  // ── 控件取用 ──
  const colorPicker = panels.appearance.querySelector('#appearance-color')
  const radiusSlider = panels.appearance.querySelector('#appearance-radius')
  const radiusValue = panels.appearance.querySelector('#radius-value')
  const resetBtn = panels.appearance.querySelector('[data-testid="appearance-reset"]')
  const themeEditor = panels.appearance.querySelector('#settings-theme-editor')
  const matrix = panels.layout.querySelector('[data-testid="menu-matrix"]')
  const tabsBarToggle = panels.layout.querySelector('[data-testid="tabs-bar-toggle"]')
  const notifMatrix = panels.notification.querySelector('#notif-matrix')

  // 单选组灌选项（读取已存偏好）
  radioGroup(
    panels.appearance.querySelector('#font-size-group'),
    'fontSize',
    fontSizeOptions(),
    localStorage.getItem(FONT_SIZE_KEY) ?? 'md',
    false,
  )
  radioGroup(
    panels.appearance.querySelector('#density-group'),
    'density',
    densityOptions(),
    localStorage.getItem(DENSITY_KEY) ?? 'default',
    false,
  )
  radioGroup(
    panels.data.querySelector('#form-mode-group'),
    'formMode',
    formModeOptions(),
    localStorage.getItem(FORM_MODE_KEY) ?? 'drawer',
    true,
  )

  // 主题编辑器：token 持久化，重启由 fouc.js 启动重放
  themeEditor?.addEventListener('oas-change', (e) => {
    const { token, value } = e.detail ?? {}
    if (typeof token !== 'string' || !token.startsWith('--')) return
    try {
      const raw = localStorage.getItem(CUSTOM_TOKENS_KEY)
      const map = raw ? JSON.parse(raw) : {}
      if (value == null || value === '') delete map[token]
      else map[token] = value
      localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(map))
    } catch {
      /* 忽略损坏数据 */
    }
  })

  const bindRadioGroup = (group, storageKey, apply) => {
    group.addEventListener('oas-change', (e) => {
      const radio = e.composedPath()[0]
      if (!radio.hasAttribute('checked')) return
      const v = radio.getAttribute('value')
      if (!v) return
      localStorage.setItem(storageKey, v)
      apply?.(v)
      OASUI.message.success(t('common.saved'))
    })
  }
  bindRadioGroup(panels.data.querySelector('#form-mode-group'), FORM_MODE_KEY)
  bindRadioGroup(panels.appearance.querySelector('#density-group'), DENSITY_KEY, () => {
    // 密度：表格单元格纵向 padding 即时生效
    const pad = { compact: '6px', default: '12px', large: '16px' }[
      localStorage.getItem(DENSITY_KEY) ?? 'default'
    ]
    document.documentElement.style.setProperty('--oas-table-cell-padding-block', pad)
  })
  bindRadioGroup(panels.appearance.querySelector('#font-size-group'), FONT_SIZE_KEY, () => {
    // 字号：根字号缩放系数即时生效
    const scale = { xs: 0.875, sm: 0.9375, md: 1, lg: 1.0625, xl: 1.125 }[
      localStorage.getItem(FONT_SIZE_KEY) ?? 'md'
    ]
    document.documentElement.style.setProperty('--app-font-scale', String(scale))
  })

  panels.data.querySelector('[data-testid="page-size"]').addEventListener('oas-change', (e) => {
    const v = e.detail?.value
    if (!v) return
    localStorage.setItem(PAGE_SIZE_KEY, v)
    OASUI.message.success(t('common.saved'))
  })

  // 多页签栏开关：mpa 无多页签容器，仅持久化配置（对齐 cdn 口径）
  tabsBarToggle.addEventListener('oas-change', (e) => {
    localStorage.setItem(TABS_BAR_KEY, String(Boolean(e.detail?.checked)))
    OASUI.message.success(t('common.saved'))
  })

  // 菜单矩阵：点击持久化 形态/位置 配置（mpa 布局固定 sidebar+left，仅记录偏好）
  function refreshMatrixMark() {
    const style = localStorage.getItem(MENU_STYLE_KEY) ?? 'sidebar'
    const position = localStorage.getItem(MENU_POSITION_KEY) ?? 'left'
    matrix.querySelectorAll('.menu-matrix-cell').forEach((cell) => {
      cell.setAttribute(
        'aria-checked',
        String(cell.dataset.style === style && cell.dataset.position === position),
      )
    })
  }
  matrix.addEventListener('click', (e) => {
    const cell = e.target.closest?.('.menu-matrix-cell')
    if (!cell || cell.hasAttribute('disabled')) return
    if (!canPosition(cell.dataset.style, cell.dataset.position)) return
    localStorage.setItem(MENU_STYLE_KEY, cell.dataset.style)
    localStorage.setItem(MENU_POSITION_KEY, cell.dataset.position)
    refreshMatrixMark()
  })
  refreshMatrixMark()

  notifMatrix.addEventListener('oas-change', (e) => {
    const sw = e.composedPath()[0]
    const key = sw.getAttribute?.('data-key')
    if (!key) return
    localStorage.setItem(NOTIF_PREFIX + key, String(Boolean(e.detail?.checked)))
  })

  // 主题色变更：写 CSS 变量 + 按当前主题持久化
  function applyColor(color) {
    document.documentElement.style.setProperty('--oas-color-primary', color)
    localStorage.setItem(`${THEME_PREFIX}${currentTheme()}`, color)
  }
  colorPicker.addEventListener('oas-change', (e) => {
    const color = e.detail?.value
    if (color) applyColor(color)
  })

  // 圆角滑杆：即时生效 + 持久化
  radiusSlider.addEventListener('oas-change', (e) => {
    const n = Number(e.detail?.value)
    if (!Number.isFinite(n)) return
    document.documentElement.style.setProperty('--oas-radius-md', `${n}px`)
    localStorage.setItem(RADIUS_KEY, String(n))
    radiusValue.textContent = `${n}px`
  })

  // 重置：清外观存储 + 还原默认
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem(`${THEME_PREFIX}light`)
    localStorage.removeItem(`${THEME_PREFIX}dark`)
    localStorage.removeItem(RADIUS_KEY)
    localStorage.removeItem(CUSTOM_TOKENS_KEY)
    document.documentElement.style.removeProperty('--oas-color-primary')
    document.documentElement.style.removeProperty('--oas-radius-md')
    colorPicker.setAttribute('value', DEFAULT_COLOR)
    radiusSlider.setAttribute('value', String(DEFAULT_RADIUS))
    radiusValue.textContent = `${DEFAULT_RADIUS}px`
    themeEditor?.reset?.()
    OASUI.message.success(t('settings.appearance.resetDone'))
  })

  // 主题切换（明暗）：同步取色器值与存储色
  document.addEventListener('themechange', () => {
    colorPicker.setAttribute('value', readColor())
    const stored = localStorage.getItem(`${THEME_PREFIX}${currentTheme()}`)
    if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
    else document.documentElement.style.removeProperty('--oas-color-primary')
  })
}

// 登录守卫 + 启动渲染
if (guard()) boot()
