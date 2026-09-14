/**
 * 设置中心初始化与布局配置（自 vanilla settings-init.ts + layout-config.ts 去 TS 移植）
 * localStorage 键名前缀按 cdn 既有约定改为 oas-admin-cdn.*
 * cdn 无 router-mode 概念（哈希单模式），不移植 applyRouterMode / routerMode
 */
export const CUSTOM_TOKENS_KEY = 'oas-admin-cdn.settings.custom-tokens'
export const FORM_MODE_KEY = 'oas-admin-cdn.form-mode'
export const DENSITY_KEY = 'oas-admin-cdn.settings.table-density'
export const PAGE_SIZE_KEY = 'oas-admin-cdn.settings.page-size'
export const RADIUS_KEY = 'oas-admin-cdn.settings.radius'
export const FONT_SIZE_KEY = 'oas-admin-cdn.settings.font-size'
export const THEME_PREFIX = 'oas-admin-cdn.settings.theme.'
export const NOTIF_PREFIX = 'oas-admin-cdn.settings.notif.'
export const TABS_BAR_KEY = 'oas-admin-cdn.settings.tabs-bar'
export const DEFAULT_COLOR = '#0b6cff'
export const DEFAULT_RADIUS = 6

/** 菜单形态 × 位置（自 vanilla layout-config.ts；cdn 壳层暂不消费，仅持久化，注释见 settings 页） */
export const MENU_STYLES = ['sidebar', 'menubar', 'navigation']
export const MENU_POSITIONS = ['left', 'right', 'top', 'top-head']
const MENU_STYLE_KEY = 'oas-admin-cdn.menu-style'
const MENU_POSITION_KEY = 'oas-admin-cdn.menu-position'

export function readFormMode() {
  const v = localStorage.getItem(FORM_MODE_KEY)
  return v === 'dialog' || v === 'page' ? v : 'drawer'
}

export function readFontSize() {
  const v = localStorage.getItem(FONT_SIZE_KEY)
  return v === 'xs' || v === 'sm' || v === 'lg' || v === 'xl' ? v : 'md'
}

export function readDensity() {
  const v = localStorage.getItem(DENSITY_KEY)
  return v === 'compact' || v === 'large' ? v : 'default'
}

export function readPageSize() {
  return localStorage.getItem(PAGE_SIZE_KEY) ?? '5'
}

export function readBool(key, fallback) {
  const v = localStorage.getItem(key)
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

export function readTabsBar() {
  return readBool(TABS_BAR_KEY, true)
}

export function readRadius() {
  const n = Number(localStorage.getItem(RADIUS_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RADIUS
}

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function readColor() {
  const stored = localStorage.getItem(`${THEME_PREFIX}${currentTheme()}`)
  if (stored) return stored
  const live = getComputedStyle(document.documentElement)
    .getPropertyValue('--oas-color-primary')
    .trim()
  return live || DEFAULT_COLOR
}

const FONT_SIZE_OPTIONS = [
  { value: 'xs', scale: 0.875 },
  { value: 'sm', scale: 0.9375 },
  { value: 'md', scale: 1 },
  { value: 'lg', scale: 1.0625 },
  { value: 'xl', scale: 1.125 },
]

export { FONT_SIZE_OPTIONS }

const DENSITY_PAD = { compact: '6px', default: '12px', large: '16px' }

export function applyDensity() {
  document.documentElement.style.setProperty(
    '--oas-table-cell-padding-block',
    DENSITY_PAD[readDensity()],
  )
}

export function applyFontSize() {
  const size = readFontSize()
  const scale = FONT_SIZE_OPTIONS.find((o) => o.value === size)?.scale ?? 1
  document.documentElement.style.setProperty('--app-font-scale', String(scale))
}

export function applySettings() {
  const theme = currentTheme()
  const color = localStorage.getItem(`${THEME_PREFIX}${theme}`)
  if (color) document.documentElement.style.setProperty('--oas-color-primary', color)
  const radius = localStorage.getItem(RADIUS_KEY)
  if (radius) document.documentElement.style.setProperty('--oas-radius-md', `${radius}px`)
  applyDensity()
  applyFontSize()
  applyCustomTokens()
  // cdn 壳层暂无多页签栏，data-tabs-bar 仅供未来壳层升级消费（vanilla 语义保留）
  document.documentElement.dataset.tabsBar = readTabsBar() ? 'on' : 'off'
}

/** 主题编辑器（oas-theme-editor）写入的自定义 token 持久化：启动时重放 */
export function applyCustomTokens() {
  try {
    const raw = localStorage.getItem(CUSTOM_TOKENS_KEY)
    if (!raw) return
    const map = JSON.parse(raw)
    for (const [k, v] of Object.entries(map)) {
      document.documentElement.style.setProperty(k, v)
    }
  } catch {
    /* 忽略损坏数据 */
  }
}

/** sidebar 不支持横置：top（独立一行）与 top-head（logo 与搜索之间）均不可选 */
export function canPosition(style, position) {
  if (style === 'sidebar' && (position === 'top' || position === 'top-head')) return false
  return true
}

function readSafe(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

export function readMenuStyle() {
  return readSafe(MENU_STYLE_KEY, MENU_STYLES, 'sidebar')
}

export function readMenuPosition() {
  // sidebar 默认 left；若存的 position=top 但 style=sidebar 不可选，回落 left
  const style = readMenuStyle()
  const pos = readSafe(MENU_POSITION_KEY, MENU_POSITIONS, 'left')
  if (!canPosition(style, pos)) return 'left'
  return pos
}

export function setMenuStyle(style) {
  try {
    localStorage.setItem(MENU_STYLE_KEY, style)
  } catch {
    /* ignore */
  }
}

export function setMenuPosition(position) {
  try {
    localStorage.setItem(MENU_POSITION_KEY, position)
  } catch {
    /* ignore */
  }
}

export function navConfig() {
  const style = readMenuStyle()
  let position = readMenuPosition()
  if (!canPosition(style, position)) position = 'left'
  return { style, position }
}
