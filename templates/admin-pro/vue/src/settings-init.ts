// src/settings-init.ts —— 设置域常量 + 类型 + localStorage 纯读取器
// 「读 localStorage + 直接写 DOM」的生效与持久化已上收至 stores/settings.ts（Pinia），
// 本文件只保留键名常量、类型与 store 初始化所需的一次性读取器
export const CUSTOM_TOKENS_KEY = 'oas-admin.settings.custom-tokens'
export const FORM_MODE_KEY = 'oas-admin.form-mode'
export const DENSITY_KEY = 'oas-admin.settings.table-density'
export const PAGE_SIZE_KEY = 'oas-admin.settings.page-size'
export const RADIUS_KEY = 'oas-admin.settings.radius'
export const FONT_SIZE_KEY = 'oas-admin.settings.font-size'
export const THEME_PREFIX = 'oas-admin.settings.theme.'
export const NOTIF_PREFIX = 'oas-admin.settings.notif.'
export const TABS_BAR_KEY = 'oas-admin.settings.tabs-bar'
export const DEFAULT_COLOR = '#0b6cff'
export const DEFAULT_RADIUS = 6

export type FormMode = 'dialog' | 'drawer' | 'page'
export type Density = 'compact' | 'default' | 'large'
export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export const FONT_SIZE_OPTIONS: Array<{ value: FontSize; scale: number }> = [
  { value: 'xs', scale: 0.875 },
  { value: 'sm', scale: 0.9375 },
  { value: 'md', scale: 1 },
  { value: 'lg', scale: 1.0625 },
  { value: 'xl', scale: 1.125 },
]

/** 通知矩阵行（通知类型）与列（渠道）：store 初始化与设置页渲染共用 */
export const NOTIF_ROWS: Array<{ key: string; labelKey: string }> = [
  { key: 'orders', labelKey: 'settings.notif.orders' },
  { key: 'inventory', labelKey: 'settings.notif.inventory' },
  { key: 'system', labelKey: 'settings.notif.system' },
]
export const NOTIF_CHANNELS: Array<{ key: string; labelKey: string }> = [
  { key: 'inapp', labelKey: 'settings.notif.inapp' },
  { key: 'email', labelKey: 'settings.notif.email' },
]

export function readFormMode(): FormMode {
  const v = localStorage.getItem(FORM_MODE_KEY)
  return v === 'dialog' || v === 'page' ? v : 'drawer'
}

export function readFontSize(): FontSize {
  const v = localStorage.getItem(FONT_SIZE_KEY)
  return v === 'xs' || v === 'sm' || v === 'lg' || v === 'xl' ? v : 'md'
}

export function readDensity(): Density {
  const v = localStorage.getItem(DENSITY_KEY)
  return v === 'compact' || v === 'large' ? v : 'default'
}

export function readPageSize(): string {
  return localStorage.getItem(PAGE_SIZE_KEY) ?? '5'
}

export function readTabsBar(): boolean {
  return readBool(TABS_BAR_KEY, true)
}

export function readBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key)
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

export function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
