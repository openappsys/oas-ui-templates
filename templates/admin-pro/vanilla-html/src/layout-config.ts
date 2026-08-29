// 导航菜单 模式（形态）× 位置 配置——矩阵中「sidebar + top / top-head」不可选
export type MenuStyle = 'sidebar' | 'menubar' | 'navigation'
export type MenuPosition = 'left' | 'right' | 'top' | 'top-head'

export const MENU_STYLES: MenuStyle[] = ['sidebar', 'menubar', 'navigation']
export const MENU_POSITIONS: MenuPosition[] = ['left', 'right', 'top', 'top-head']

const STYLE_KEY = 'oas-admin.menu-style'
const POSITION_KEY = 'oas-admin.menu-position'
export const SIDEBAR_COLLAPSED_KEY = 'oas-admin.sidebar-collapsed'

export interface NavConfig {
  style: MenuStyle
  position: MenuPosition
}

/** sidebar 不支持横置：top（独立一行）与 top-head（logo 与搜索之间）均不可选 */
export function canPosition(style: MenuStyle, position: MenuPosition): boolean {
  if (style === 'sidebar' && (position === 'top' || position === 'top-head')) return false
  return true
}

function readSafe<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

export function readMenuStyle(): MenuStyle {
  return readSafe(STYLE_KEY, MENU_STYLES, 'sidebar')
}

export function readMenuPosition(): MenuPosition {
  // sidebar 默认 left；若存的 position=top 但 style=sidebar 不可选，回落 left
  const style = readMenuStyle()
  const pos = readSafe(POSITION_KEY, MENU_POSITIONS, 'left')
  if (!canPosition(style, pos)) return 'left'
  return pos
}

export function setMenuStyle(style: MenuStyle): void {
  try {
    localStorage.setItem(STYLE_KEY, style)
  } catch {
    /* ignore */
  }
}

export function setMenuPosition(position: MenuPosition): void {
  try {
    localStorage.setItem(POSITION_KEY, position)
  } catch {
    /* ignore */
  }
}

export function navConfig(): NavConfig {
  const style = readMenuStyle()
  let position = readMenuPosition()
  if (!canPosition(style, position)) position = 'left'
  return { style, position }
}

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  } catch {
    /* ignore */
  }
}
