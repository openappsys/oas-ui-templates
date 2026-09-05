// src/lib/theme.ts —— 主题切换：写 <html data-theme> 并派发 themechange
// 逐字对齐 vanilla-html/src/components/app-shell.ts 的 applyTheme()/setTheme()
// （与 react 版 src/lib/theme.ts 逐字一致——纯 DOM 操作，无框架差异）
export function applyTheme(next: string): void {
  document.documentElement.dataset.theme = next
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }))
}

export function setTheme(mode: string): void {
  if (mode === 'theme:system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(dark ? 'dark' : 'light')
  } else {
    applyTheme(mode === 'theme:dark' ? 'dark' : 'light')
  }
}

/** 主题点单击：light ↔ dark 直接互换 */
export function toggleTheme(): void {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
}
