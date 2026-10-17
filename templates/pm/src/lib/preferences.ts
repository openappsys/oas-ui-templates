export type ThemePreference = 'light' | 'dark' | 'system'

const THEME_KEY = 'oas-pm-theme'

export function loadTheme(): ThemePreference {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function storeTheme(p: ThemePreference): void {
  localStorage.setItem(THEME_KEY, p)
}
