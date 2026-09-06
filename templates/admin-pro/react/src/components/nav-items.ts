// src/components/nav-items.ts —— 壳层菜单/命令面板 items 推导
// 差异：href 生成走 router/mode.ts 的 routeHref()（hash/history 双模式按存储值生成，
import { currentLocale, t } from '../i18n'
import { routeHref } from '../router/mode'
import { appRoutes, type RouteGroup } from '../router/routes'

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

/** sidebar 形态：扁平列表带 group 字段（组件内分组渲染），高亮走 active 属性 */
export function sidebarItems(): SidebarItem[] {
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
  // 两个分隔符 value 同为 'sep'，与 vanilla 逐字对齐（组件按 separator 字段渲染分隔行）
  const separator: CommandEntry = { label: ' ', value: 'sep', separator: true }
  return [...pageItems, separator, ...actionItems, separator, ...themeItems]
}
