import { loadTheme, type ThemePreference } from './preferences'

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function resolveTheme(p: ThemePreference): 'light' | 'dark' {
  return p === 'system' ? (media.matches ? 'dark' : 'light') : p
}

export function applyTheme(p: ThemePreference): void {
  const resolved = resolveTheme(p)
  if (resolved === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
}

export function initTheme(): () => void {
  applyTheme(loadTheme())
  const onChange = () => applyTheme(loadTheme())
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
