// 相对路径而非 @ 别名：vite.config.ts 直接加载 mock-server.ts，进而解析本模块——
// 配置加载阶段的别名尚未注册，裸别名会被 Node 当成包名解析失败
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
} from '../types/index.ts'

export type SortBy = 'updatedAt' | 'priority' | 'createdAt'
export type Grouping = 'none' | 'priority' | 'assignee'

/** 负责人筛选中「未分配」的哨兵值：成员 id 不会取此值 */
export const UNASSIGNED = '__none__'

/** 项目作用域的「全部项目」哨兵：项目 id 不会取此值。
 *  projectId 仍是单值单选（不是多选维度）——交叉项目工作台只需要一个 workspace 级作用域 */
export const ALL_PROJECTS = '__all__'

/** 逻辑筛选：每个维度可多选（组内 OR），维度之间 AND；空数组 = 该维度不限 */
export interface Filters {
  projectId: string
  statusFilter: IssueStatus[]
  /** 成员 id 数组；UNASSIGNED 表示未分配 */
  assigneeFilter: string[]
  priorityFilter: IssuePriority[]
  search: string
  myOnly: boolean
  sortBy: SortBy
}

export const DEFAULT_FILTERS: Filters = {
  projectId: 'project-1',
  statusFilter: [],
  assigneeFilter: [],
  priorityFilter: [],
  search: '',
  myOnly: false,
  sortBy: 'updatedAt',
}

export const LIST_WINDOW = 500
export const LIST_WINDOW_STEP = 500
export const GROUP_PREVIEW = 30

/** 多选切换：已选中则移除，否则追加（保留点击顺序） */
export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw === null || raw === undefined) return []
  return [raw]
}

/** 单值（旧结构）或数组 → 去重后的合法枚举数组；非法值丢弃 */
function toEnumList<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  const out: T[] = []
  for (const v of toList(raw)) {
    if (typeof v !== 'string') continue
    if (!(allowed as readonly string[]).includes(v)) continue
    if (!out.includes(v as T)) out.push(v as T)
  }
  return out
}

/** 负责人：任意非空字符串（成员 id 或 UNASSIGNED） */
function toAssigneeList(raw: unknown): string[] {
  const out: string[] = []
  for (const v of toList(raw)) {
    if (typeof v !== 'string' || v === '') continue
    if (!out.includes(v)) out.push(v)
  }
  return out
}

/** 旧 SavedView JSON（单值/null）归一为多选结构；缺省字段取默认值，非法值丢弃 */
export function normalizeFilters(raw: unknown): Filters {
  const rec = isRecord(raw) ? raw : {}
  return {
    // 任意非空字符串原样保留（含全部项目哨兵）——项目 id 无法穷举校验
    projectId:
      typeof rec.projectId === 'string' && rec.projectId !== ''
        ? rec.projectId
        : DEFAULT_FILTERS.projectId,
    statusFilter: toEnumList(rec.statusFilter, ISSUE_STATUSES),
    assigneeFilter: toAssigneeList(rec.assigneeFilter),
    priorityFilter: toEnumList(rec.priorityFilter, ISSUE_PRIORITIES),
    search: typeof rec.search === 'string' ? rec.search : '',
    myOnly: rec.myOnly === true,
    sortBy: rec.sortBy === 'priority' || rec.sortBy === 'createdAt' ? rec.sortBy : 'updatedAt',
  }
}

/** 保存视图的 filters JSON → Filters；JSON 损坏返回 null（调用方保持当前筛选） */
export function parseFilters(json: string): Filters | null {
  try {
    return normalizeFilters(JSON.parse(json))
  } catch {
    return null
  }
}
