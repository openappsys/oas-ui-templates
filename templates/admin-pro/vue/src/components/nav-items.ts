// src/components/nav-items.ts —— 壳层菜单/命令面板 items 推导
// （与 react 版 src/components/nav-items.ts 逐字对齐，唯一差异：routeHref 改由 router/mode.ts
import { currentLocale, t } from '../i18n'
import { routeHref } from '../router/mode'
import { appRoutes, type RouteGroup } from '../router/routes'

export { routeHref }

const GROUP_ORDER: RouteGroup[] = ['nav.output', 'nav.business', 'nav.system', 'nav.demo']
const GROUP_KEYS: Record<RouteGroup, string> = {
  'nav.output': 'nav.group.overview',
  'nav.business': 'nav.group.business',
  'nav.system': 'nav.group.system',
  'nav.demo': 'nav.group.demo',
}

export function groupLabel(group: RouteGroup | undefined): string {
  if (group && (GROUP_ORDER as string[]).includes(group)) return t(GROUP_KEYS[group])
  return t('nav.group.overview')
}

function groupOrder(group: RouteGroup | undefined): number {
  return group ? GROUP_ORDER.indexOf(group) : GROUP_ORDER.length
}

export interface SidebarItem {
  label: string
  value: string
  icon: string
  iconColor?: string
  group: string
}

/** 分组父节点图标（sidebar 树形形态的一级节点用） */
export const GROUP_ICONS: Record<RouteGroup, string> = {
  'nav.output': 'eye',
  'nav.business': 'organization',
  'nav.system': 'gear',
  'nav.demo': 'menu',
}

export interface SidebarTreeItem {
  label: string
  value: string
  icon: string
  children: Array<{ label: string; value: string; icon?: string; iconColor?: string }>
}

/** sidebar 树形导航（展开态）：分组父节点 + children 子菜单，配合 accordion 属性同组互斥展开；
 *  含 active 子项的组由组件 autoExpand 自动展开，当前项高亮走 sidebar 的 active 属性 */
export function sidebarTreeItems(): SidebarTreeItem[] {
  return GROUP_ORDER.map((g) => {
    const children = appRoutes
      .filter((r) => !r.meta.hidden && (r.meta.group ?? 'nav.demo') === g)
      .map((r) => ({
        label: t(r.meta.titleKey),
        value: r.path,
        icon: r.meta.icon,
        iconColor: r.meta.iconColor,
      }))
    return { label: groupLabel(g), value: g, icon: GROUP_ICONS[g], children }
  }).filter((g) => g.children.length > 0)
}

/** sidebar 扁平导航（collapsed 折叠态专用）：上游「collapsed × children」组合缺陷
 *  期间子菜单不可达（已登记 oas-ui demands 2026-09-24），折叠态暂用平铺 icon 列表；
 *  上游修复后删除本函数并让 sidebarItems 统一走树形 */
export function sidebarFlatItems(): SidebarItem[] {
  return appRoutes
    .filter((r) => !r.meta.hidden)
    .slice()
    .sort((a, b) => groupOrder(a.meta.group) - groupOrder(b.meta.group))
    .map((r) => ({
      label: t(r.meta.titleKey),
      value: r.path,
      icon: r.meta.icon,
      iconColor: r.meta.iconColor,
      group: groupLabel(r.meta.group),
    }))
}

export function sidebarItems(collapsed: boolean): SidebarItem[] | SidebarTreeItem[] {
  return collapsed ? sidebarFlatItems() : sidebarTreeItems()
}

export interface GroupMenuChild {
  label: string
  value: string
  icon?: string
  active?: boolean
  href?: string
}

export interface GroupMenuItem {
  label: string
  value: string
  children: GroupMenuChild[]
}

/** 顶部/竖排菜单（menubar / navigation-menu）：顶级=分组、children=组内路由。
 *  active 字段标记当前路由高亮；includeHref 仅 navigation 需要（卡片用 <a href> 渲染，
 *  无 href 会落到 '#' 致点击被默认跳转重置，丢 #/settings）；menubar 子项走 select→navigate 绝不传 */
export function groupMenuItems(activePath: string, includeHref: boolean): GroupMenuItem[] {
  const groups = new Map<string, GroupMenuChild[]>()
  for (const r of appRoutes) {
    if (r.meta.hidden) continue
    const g = groupLabel(r.meta.group)
    const items = groups.get(g) ?? []
    items.push({
      label: t(r.meta.titleKey),
      value: r.path,
      icon: r.meta.icon,
      active: r.path === activePath,
      ...(includeHref ? { href: routeHref(r.path) } : {}),
    })
    groups.set(g, items)
  }
  return Array.from(groups.entries()).map(([label, children]) => ({
    label,
    value: label,
    children,
  }))
}

export function userMenuItems(): string {
  return JSON.stringify([
    { label: t('header.profile'), value: '/profile', kind: 'action' },
    { label: t('header.logout'), value: 'logout', kind: 'action', danger: true },
  ])
}

export const LANG_ITEMS = '[{"label":"简体中文","value":"zh-CN"},{"label":"English","value":"en"}]'

export interface CommandEntry {
  label: string
  value: string
  group?: string
  keywords?: string[]
  separator?: boolean
}

/** 命令面板 items = 页面 + 分隔 + 操作（theme/refresh/logout/locale）+ 分隔 + 主题组 */
export function buildCommandItems(): CommandEntry[] {
  const pageItems = appRoutes
    .filter((r) => !r.meta.hidden)
    .map((r) => ({
      label: t(r.meta.titleKey),
      value: r.path,
      group: groupLabel(r.meta.group),
      keywords: [t(r.meta.titleKey), r.path],
    }))
  const actionItems: CommandEntry[] = [
    {
      label: t('cmd.switchTheme'),
      value: 'action:theme',
      group: t('cmd.action'),
      keywords: [t('cmd.switchTheme'), 'theme'],
    },
    {
      label: t('cmd.refresh'),
      value: 'action:refresh',
      group: t('cmd.action'),
      keywords: ['refresh', 'reload'],
    },
    {
      label: t('cmd.logout'),
      value: 'action:logout',
      group: t('cmd.action'),
      keywords: ['logout'],
    },
    {
      label: currentLocale() === 'en' ? t('cmd.switchToZh') : t('cmd.switchToEn'),
      value: 'action:locale',
      group: t('cmd.action'),
      keywords: ['locale', 'language', '语言', '中文', 'english'],
    },
  ]
  const themeItems: CommandEntry[] = [
    {
      label: t('cmd.light'),
      value: 'theme:light',
      group: t('cmd.themeGroup'),
      keywords: ['light'],
    },
    { label: t('cmd.dark'), value: 'theme:dark', group: t('cmd.themeGroup'), keywords: ['dark'] },
    {
      label: t('cmd.system'),
      value: 'theme:system',
      group: t('cmd.themeGroup'),
      keywords: ['system', 'auto'],
    },
  ]
  const separator: CommandEntry = { label: ' ', value: 'sep', separator: true }
  return [...pageItems, separator, ...actionItems, separator, ...themeItems]
}
