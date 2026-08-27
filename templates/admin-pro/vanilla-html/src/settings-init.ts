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

export function readRadius(): number {
  const n = Number(localStorage.getItem(RADIUS_KEY))
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RADIUS
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

export function readColor(): string {
  const stored = localStorage.getItem(`${THEME_PREFIX}${currentTheme()}`)
  if (stored) return stored
  const live = getComputedStyle(document.documentElement)
    .getPropertyValue('--oas-color-primary')
    .trim()
  return live || DEFAULT_COLOR
}

const DENSITY_PAD: Record<Density, string> = { compact: '6px', default: '12px', large: '16px' }

export function applyDensity(): void {
  document.documentElement.style.setProperty(
    '--oas-table-cell-padding-block',
    DENSITY_PAD[readDensity()],
  )
}

export function applyFontSize(): void {
  const size = readFontSize()
  const scale = FONT_SIZE_OPTIONS.find((o) => o.value === size)?.scale ?? 1
  document.documentElement.style.setProperty('--app-font-scale', String(scale))
}

export function applySettings(): void {
  const theme = currentTheme()
  const color = localStorage.getItem(`${THEME_PREFIX}${theme}`)
  if (color) document.documentElement.style.setProperty('--oas-color-primary', color)
  const radius = localStorage.getItem(RADIUS_KEY)
  if (radius) document.documentElement.style.setProperty('--oas-radius-md', `${radius}px`)
  applyDensity()
  applyFontSize()
  document.documentElement.dataset.tabsBar = readTabsBar() ? 'on' : 'off'
}
