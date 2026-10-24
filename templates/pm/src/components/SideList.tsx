import { useEffect, useRef, type ReactNode } from 'react'
import { registerIcon } from '@oas-ui/icons/runtime'
import { t } from '@/i18n'
import {
  isGroupCollapsed,
  loadCollapsedGroups,
  storeCollapsedGroups,
  toggleCollapsedGroup,
} from '@/lib/side-collapse'

export type SideKind =
  | 'project'
  | 'view'
  | 'status'
  | 'priority'
  | 'savedview'
  | 'cycle'
  | 'group'
  | 'clear'

export interface SideRow {
  /** 行唯一键，同时是 e2e 的 data-value 锚点（status:all / priority:urgent / project:x / view:my …） */
  value: string
  kind: SideKind
  id?: string
  label: string
  count?: string
  statusColor?: string
  /** 非状态行的图标颜色（优先级行用优先级色） */
  iconColor?: string
  deletable?: boolean
  savedFilters?: string
  /** 当前生效（aria-pressed=true） */
  selected?: boolean
  /** 高亮分级：strong = 当前视图实底；weak = 生效筛选浅底 + 2px 左色条；缺省 = 不高亮
   *  （「全部 X」行有选中语义但不高亮——它表达「该维度不限」） */
  highlight?: 'strong' | 'weak'
  /** 可折叠分组头：子行由 oas-sidebar 的父子项通道渲染（独立展开，不启用 accordion） */
  children?: SideRow[]
  /** 折叠偏好键（localStorage `oas-pm-side-collapsed` 里的键） */
  collapseKey?: string
  /** 该行所属分组名（父项传给它自己的子行；等价 oas-sidebar 的 group 作用域） */
  group?: string
}

export interface SideSection {
  key: string
  /** 组标题：空串表示不起组标题（筛选段由「筛选」父项自带标题） */
  title: string
  rows: SideRow[]
  /** 组前插入分隔线（与 oas-sidebar 的 divider 条目对应） */
  divider?: boolean
}

interface SidebarItemLike {
  label: string
  value: string
  group?: string
  icon?: string
  iconColor?: string
  badge?: string | number
  disabled?: boolean
  actions?: { icon?: string; value: string; label: string }[]
  children?: SidebarItemLike[]
}

type SidebarEntryLike = SidebarItemLike | { type: 'divider' }

registerIcon(
  'pm-status-dot',
  '<circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="4.6"/>',
)
registerIcon(
  'pm-project',
  '<path d="M2.5 4 A1.5 1.5 0 0 1 4 2.5 H6.3 L7.8 4.5 H12 A1.5 1.5 0 0 1 13.5 6 V11.5 A1.5 1.5 0 0 1 12 13 H4 A1.5 1.5 0 0 1 2.5 11.5 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
)
registerIcon(
  'pm-inbox',
  '<path d="M4 3 H12 L13.5 9 V11.5 A1.5 1.5 0 0 1 12 13 H4 A1.5 1.5 0 0 1 2.5 11.5 V9 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M2.5 9 H5.2 L6.4 11 H9.6 L10.8 9 H13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
)
registerIcon(
  'pm-priority-flag',
  '<path d="M4 2.5 V13.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 3.2 H11.6 L10.1 5.9 L11.6 8.6 H4" fill="currentColor"/>',
)

/** 行图标：状态行用色点、优先级行用旗标，其余沿用图标库名 */
function rowIcon(row: SideRow): string {
  if (row.statusColor) return 'pm-status-dot'
  switch (row.kind) {
    case 'priority':
      return 'pm-priority-flag'
    case 'project':
      return 'pm-project'
    case 'view':
      return row.id === 'my' ? 'user' : 'pm-inbox'
    case 'savedview':
      return 'star'
    case 'cycle':
      // refresh = 周期循环；当前迭代与具体周期同一图标，靠分组内高亮区分
      return 'refresh'
    case 'group':
      return 'filter'
    case 'clear':
      return 'close'
    default:
      return 'menu'
  }
}

/** 宿主注入到 oas-sidebar shadow 的样式：高亮分级 + 「全部 X」行去高亮。
 *  组件只认 active/active-by-group 一套 .active 视觉；强/弱两级只能由宿主补规则
 *  （AGENTS 记录的集成模式：宿主自绘行样式需注入 shadow stylesheet） */
const TIER_STYLES = `
  .item[data-value^='status:'].active,
  .item[data-value^='priority:'].active {
    background: color-mix(in srgb, var(--oas-color-primary) 7%, transparent);
    color: var(--oas-color-text-primary);
    font-weight: 400;
    box-shadow: inset 2px 0 0 var(--oas-color-primary);
  }
  .item[data-value^='status:'].active .icon,
  .item[data-value^='priority:'].active .icon {
    color: var(--oas-color-primary-text);
  }
  .item[data-value='status:all'].active,
  .item[data-value='priority:all'].active,
  .item[data-value='cycle:all'].active {
    background: none;
    color: var(--oas-color-text-primary);
    font-weight: 400;
    box-shadow: none;
  }
  /* 分组头行（筛选/状态/优先级/迭代）：次要色，层级靠 chevron 表达 */
  .item[data-value^='group:'] {
    color: var(--oas-color-text-secondary);
    font-size: var(--oas-font-size-sm, 13px);
  }
`

function ensureTierStyles(root: ShadowRoot | null): void {
  if (!root || root.querySelector('style[data-pm-tiers]')) return
  const st = document.createElement('style')
  st.setAttribute('data-pm-tiers', '')
  st.textContent = TIER_STYLES
  root.appendChild(st)
}

/** SideRow → oas-sidebar 的 item 模型（计数走 badge，删除动作走行内 actions） */
function toItem(row: SideRow, group: string): SidebarItemLike {
  const item: SidebarItemLike = { label: row.label, value: row.value }
  const itemGroup = row.group ?? group
  if (itemGroup) item.group = itemGroup
  if (row.count != null) item.badge = row.count
  item.icon = rowIcon(row)
  if (row.statusColor) item.iconColor = row.statusColor
  else if (row.iconColor) item.iconColor = row.iconColor
  if (row.deletable && row.id) {
    item.actions = [
      { icon: 'close', value: 'del', label: t('deleteView').replace('{name}', row.label) },
    ]
  }
  if (row.children) item.children = row.children.map((c) => toItem(c, itemGroup))
  return item
}

/**
 * 侧栏内容区（oas-sidebar）：导航（项目/视图/保存视图）在上，筛选（状态/优先级/迭代）在下。
 * - 折叠 rail / Ctrl+B / 行键盘可达都由组件提供（shortcut 属性开启 Ctrl+B）
 * - 分组折叠走组件的父子项通道：各组独立展开（不启用互斥的 accordion）
 * - 折叠偏好默认展开并持久化：组件没有 expanded 属性（源码 observedAttributes 无此项），
 *   宿主在每次 items 重挂后按偏好对齐（读 aria-expanded，必要时触发组件自身的开关），
 *   并在用户点击分组头后把新状态写回 localStorage
 * - 成员控件作为默认插槽内容挂在 nav 之后（panel 滚动区末尾）
 */
export function SideList({
  sections,
  onRowClick,
  onDeleteSavedView,
  trailing,
}: {
  sections: SideSection[]
  onRowClick: (row: SideRow) => void
  onDeleteSavedView: (id: string) => void
  /** 筛选区末尾的成员控件（可搜索多选），由宿主提供 */
  trailing?: ReactNode
}) {
  const barRef = useRef<HTMLElement & { items?: unknown }>(null)
  const handlersRef = useRef({ onRowClick, onDeleteSavedView })
  handlersRef.current = { onRowClick, onDeleteSavedView }
  const rowMapRef = useRef(new Map<string, SideRow>())
  /** 分组头 value → 折叠偏好键 */
  const keyByValueRef = useRef(new Map<string, string>())
  /** 宿主对齐折叠态期间不记录点击（否则会被当成用户操作写库） */
  const syncingRef = useRef(false)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const onSelect = (e: Event) => {
      const value = (e as CustomEvent<{ value?: string }>).detail?.value ?? ''
      const row = rowMapRef.current.get(value)
      if (row) handlersRef.current.onRowClick(row)
    }
    const onAction = (e: Event) => {
      const d = (e as CustomEvent<{ value?: string; action?: string }>).detail
      if (d?.action !== 'del') return
      const id = rowMapRef.current.get(d.value ?? '')?.id
      if (id) handlersRef.current.onDeleteSavedView(id)
    }
    // 分组头展开/收起：组件同步切换 aria-expanded，宿主读回后落库（组件没有 expanded 属性）
    const onShadowClick = (e: Event) => {
      if (syncingRef.current) return
      const btn = e
        .composedPath()
        .find(
          (n): n is HTMLElement =>
            n instanceof HTMLElement && n.dataset?.value?.startsWith('group:') === true,
        )
      if (!btn) return
      const key = keyByValueRef.current.get(btn.dataset.value ?? '')
      if (!key) return
      const open = btn.getAttribute('aria-expanded') === 'true'
      const current = loadCollapsedGroups()
      const wantCollapsed = !open
      if (isGroupCollapsed(current, key) !== wantCollapsed) {
        storeCollapsedGroups(toggleCollapsedGroup(current, key))
      }
    }
    el.addEventListener('oas-select', onSelect)
    el.addEventListener('oas-action', onAction)
    const root = el.shadowRoot
    root?.addEventListener('click', onShadowClick)
    return () => {
      el.removeEventListener('oas-select', onSelect)
      el.removeEventListener('oas-action', onAction)
      root?.removeEventListener('click', onShadowClick)
    }
  }, [])

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const map = new Map<string, SideRow>()
    const keys = new Map<string, string>()
    const items: SidebarEntryLike[] = []
    // 分组独立高亮（aria-pressed）：与 oas-sidebar 的 active-by-group 通道对接
    const activeByGroup: Record<string, string[]> = {}
    const register = (row: SideRow, group: string) => {
      map.set(row.value, row)
      if (row.children && row.collapseKey) keys.set(row.value, row.collapseKey)
      if (row.children) for (const child of row.children) register(child, group)
    }
    const collect = (row: SideRow, group: string) => {
      const itemGroup = row.group ?? group
      if (!row.children && itemGroup && row.selected) {
        const list = activeByGroup[itemGroup] ?? []
        list.push(row.value)
        activeByGroup[itemGroup] = list
      }
      for (const child of row.children ?? []) collect(child, itemGroup)
    }
    for (const section of sections) {
      if (section.divider) items.push({ type: 'divider' })
      for (const row of section.rows) {
        register(row, section.title)
        collect(row, section.title)
        items.push(toItem(row, section.title))
      }
    }
    rowMapRef.current = map
    keyByValueRef.current = keys
    const root = el.shadowRoot
    ensureTierStyles(root)
    const focusedRow =
      root?.activeElement instanceof HTMLElement
        ? root.activeElement.closest<HTMLElement>('[part="item"]')
        : null
    const focusValue = focusedRow?.dataset.value ?? null
    // 先写高亮映射再写 items：两处任一独自更新都会让行渲染缺 aria-pressed / active
    el.setAttribute('active-by-group', JSON.stringify(activeByGroup))
    el.items = items

    // 折叠偏好对齐：组件默认全部收起，把「应当展开」的组点开（同步点，避免首屏闪一下）。
    // items 渲染若被组件调度到微任务，这一轮查不到按钮——下一帧再对齐一次（幂等）
    const sync = () => {
      const shadow = el.shadowRoot
      if (!shadow || keys.size === 0) return
      const collapsed = loadCollapsedGroups()
      syncingRef.current = true
      try {
        for (const [value, key] of keys) {
          const btn = shadow.querySelector<HTMLElement>(
            `[part="item"][data-value="${CSS.escape(value)}"]`,
          )
          if (!btn) continue
          const open = btn.getAttribute('aria-expanded') === 'true'
          if (open === !isGroupCollapsed(collapsed, key)) continue
          btn.click()
        }
      } finally {
        syncingRef.current = false
      }
    }
    sync()
    requestAnimationFrame(sync)

    if (focusValue) {
      root
        ?.querySelector<HTMLElement>(`[part="item"][data-value="${CSS.escape(focusValue)}"]`)
        ?.focus({ preventScroll: true })
    }
  }, [sections])

  return (
    <oas-sidebar ref={barRef} data-testid="side-list" shortcut="">
      {/* 成员筛选是筛选区最后一项：走组件默认插槽（紧接迭代/清除之后，同一滚动区） */}
      {trailing}
    </oas-sidebar>
  )
}
