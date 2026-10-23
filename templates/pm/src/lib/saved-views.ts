// 相对路径而非 @ 别名：vite.config.ts 直接加载 mock-server.ts，进而解析本模块——
// 配置加载阶段的别名尚未注册（同 lib/filters、lib/cycles）
import type { SavedView } from '../types/index.ts'
import { DEFAULT_FILTERS, type Filters } from './filters.ts'

/** 一天的毫秒数（示例视图的创建时刻按天回推） */
const DAY_MS = 86_400_000

/** 示例保存视图：seed 与 API mock 共用同一份定义，两种数据源的首屏入口才一致 */
export interface DemoSavedView {
  id: string
  name: string
  /** 相对 now 的创建时刻（越大越旧）：下拉按创建时间倒序，越近的排越前 */
  ageMs: number
  filters: Partial<Filters>
}

/** 名称纯中文：与其它 seed 数据一致；双语名在 220px 侧栏会被截断 */
export const DEMO_SAVED_VIEWS: readonly DemoSavedView[] = [
  {
    id: 'view-demo-1',
    name: '我的进行中',
    ageMs: 2 * DAY_MS,
    filters: { myOnly: true, statusFilter: ['in_progress'] },
  },
  {
    id: 'view-demo-2',
    name: '高优先级待办',
    ageMs: DAY_MS,
    filters: { priorityFilter: ['urgent', 'high'], statusFilter: ['todo', 'backlog'] },
  },
]

/** 视图的 filters JSON：其余字段取 DEFAULT_FILTERS；search 不进视图（与保存动作同规则） */
export function demoSavedViewFilters(partial: Partial<Filters>): string {
  const { search: _search, ...rest } = DEFAULT_FILTERS
  return JSON.stringify({ ...rest, ...partial })
}

/** 落库形态（Dexie 与 API mock 同形）：createdAt 由基准时刻回推 */
export function demoSavedViewRows(now: number): SavedView[] {
  return DEMO_SAVED_VIEWS.map((v) => ({
    id: v.id,
    name: v.name,
    filters: demoSavedViewFilters(v.filters),
    createdAt: now - v.ageMs,
  }))
}

/** 工具栏下拉的选项序：创建时间倒序（最近保存的最容易再点开）。
 *  侧栏组保持仓库的按名排序，不受此函数影响 */
export function byCreatedDesc(rows: readonly SavedView[] | undefined): SavedView[] {
  return [...(rows ?? [])].sort((a, b) => b.createdAt - a.createdAt)
}
