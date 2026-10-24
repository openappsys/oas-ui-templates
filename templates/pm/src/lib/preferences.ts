export type ThemePreference = 'light' | 'dark' | 'system'

/** 筛选控件的位置偏好：侧栏 / 内容区顶部 / 两处都显示（同一份筛选状态） */
export type FilterPlacement = 'sidebar' | 'topbar' | 'both'

/** 评论显示模式：无嵌套（时间轴）/ 一级嵌套（回复挂根）/ 无限嵌套（真实树）。数据始终是树 */
export type CommentMode = 'flat' | 'thread' | 'nested'

const THEME_KEY = 'oas-pm-theme'
const PLACEMENT_KEY = 'oas-pm-filters-placement'
const COMMENT_MODE_KEY = 'oas-pm-comment-mode'

/** 缺省侧栏：老用户的观感不变，也让既有 e2e 的侧栏入口继续成立 */
export const DEFAULT_FILTER_PLACEMENT: FilterPlacement = 'sidebar'

/** 缺省一级嵌套：与既有行为一致 */
export const DEFAULT_COMMENT_MODE: CommentMode = 'thread'

export function isFilterPlacement(v: unknown): v is FilterPlacement {
  return v === 'sidebar' || v === 'topbar' || v === 'both'
}

export function loadTheme(): ThemePreference {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function storeTheme(p: ThemePreference): void {
  localStorage.setItem(THEME_KEY, p)
}

/** 非法/缺失（旧版本没有这个键）一律回落默认，不抛错 */
export function loadFilterPlacement(): FilterPlacement {
  const v = localStorage.getItem(PLACEMENT_KEY)
  return isFilterPlacement(v) ? v : DEFAULT_FILTER_PLACEMENT
}

export function storeFilterPlacement(p: FilterPlacement): void {
  localStorage.setItem(PLACEMENT_KEY, p)
}

/** 侧栏是否显示筛选组（状态/优先级/迭代行 + 成员控件） */
export function showsSidebarFilters(p: FilterPlacement): boolean {
  return p !== 'topbar'
}

/** 内容区顶部是否显示筛选栏（列表/看板/时间线/资源/日程） */
export function showsTopbarFilters(p: FilterPlacement): boolean {
  return p !== 'sidebar'
}

export function isCommentMode(v: unknown): v is CommentMode {
  return v === 'flat' || v === 'thread' || v === 'nested'
}

export function loadCommentMode(): CommentMode {
  const v = localStorage.getItem(COMMENT_MODE_KEY)
  return isCommentMode(v) ? v : DEFAULT_COMMENT_MODE
}

export function storeCommentMode(m: CommentMode): void {
  localStorage.setItem(COMMENT_MODE_KEY, m)
}
