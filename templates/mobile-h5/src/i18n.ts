// i18n：复用 @oas-ui/i18n 注册表（builtin 组件文案 + 本应用文案合并），模式对齐 vanilla src/i18n/index.ts
// 移动端切换惯例：持久化后整页 reload（单渲染树，无响应式重渲）
import {
  registerLocale,
  setLocale as pkgSetLocale,
  getLocaleName as pkgGetLocaleName,
  t as pkgT,
} from '@oas-ui/i18n'
import type { LocaleMessages } from '@oas-ui/i18n'
import { zhCN as builtinZh } from '@oas-ui/i18n/zh-CN'
import { en as builtinEn } from '@oas-ui/i18n/en'

export type Locale = 'zh-CN' | 'en'
export const LOCALES: readonly Locale[] = ['zh-CN', 'en'] as const

const KEY = 'oas-admin.locale'
let inited = false

const zhMessages: Record<string, string> = {
  'app.title': 'OAS Mobile',
  'nav.tab.home': '首页',
  'nav.tab.list': '列表',
  'nav.tab.mine': '我的',
  'nav.home': '首页',
  'nav.list': '全部内容',
  'nav.mine': '我的',
  'hero.greeting.morning': '早上好',
  'hero.greeting.afternoon': '下午好',
  'hero.greeting.evening': '晚上好',
  'hero.greeting.night': '夜深了',
  'hero.sub': '今天有 3 条更新、2 项待办待处理',
  'kind.公告': '公告',
  'kind.动态': '动态',
  'kind.待办': '待办',
  'kind.新发布': '新发布',
  'kind.all': '全部',
  'section.latest': '最新动态',
  'list.search.ph': '搜索标题 / 摘要',
  'list.empty': '没有匹配的内容',
  'me.team': 'OAS 平台 · 管理员',
  'me.posts': '发布',
  'me.read': '已读',
  'me.todos': '待办',
  'group.preferences': '偏好',
  'group.general': '通用',
  'group.about': '关于',
  'setting.skin': '皮肤',
  'skin.default': '默认',
  'skin.violet': '堇紫',
  'skin.emerald': '靛绿',
  'skin.rose': '玫红',
  'skin.teal': '青瞳',
  'setting.glass': '玻璃质感',
  'setting.dark': '深色模式',
  'setting.followSystem': '跟随系统',
  'setting.notif': '消息通知',
  'setting.fontSize': '字号',
  'setting.standard': '标准',
  'setting.clearCache': '清除缓存',
  'setting.locale': '语言',
  'about.title': '关于',
  'menu.portal': '返回模板门户',
  'publish.title': '标题',
  'publish.titlePh': '一句话说明你要发布的内容',
  'publish.content': '内容',
  'publish.contentPh': '补充细节（可选）',
  'publish.category': '分类',
  'common.cancel': '取消',
  'common.publish': '发布',
  'feed.257.title': 'oas-ui 2.5.7 发布',
  'feed.257.summary': 'swatch 色板、upload 裁剪、form 大批次增强——移动端 flyout 子菜单同步落地。',
  'feed.mobile.title': '移动端专项回顾',
  'feed.mobile.summary':
    'bottom-sheet / app-bar / bottom-navigation 三件套 + 触摸目标 44px 全局抬升。',
  'feed.okr.title': '季度目标盘点',
  'feed.okr.summary': '三项关键结果里两项已达成，剩余一项本月底收口，相关待办已同步。',
  'feed.repo.title': '模板仓新成员',
  'feed.repo.summary': 'mobile-h5 上线：零框架直接消费 web components 的移动端起点。',
  'feed.security.title': '安全巡检通知',
  'feed.security.summary': '本周五 02:00-04:00 例行维护，请提前保存工作内容。',
  'feed.upgrade.title': '组件库 2.5.7 升级清单',
  'feed.upgrade.summary': '七模板依赖对齐、CDN 重钉、玻璃/皮肤回补——升级路径全程可回退。',
  'time.today': '今天',
  'time.yesterday': '昨天',
  'time.monday': '周一',
}

const enMessages: Record<string, string> = {
  'app.title': 'OAS Mobile',
  'nav.tab.home': 'Home',
  'nav.tab.list': 'List',
  'nav.tab.mine': 'Mine',
  'nav.home': 'Home',
  'nav.list': 'All content',
  'nav.mine': 'Mine',
  'hero.greeting.morning': 'Good morning',
  'hero.greeting.afternoon': 'Good afternoon',
  'hero.greeting.evening': 'Good evening',
  'hero.greeting.night': 'Late night',
  'hero.sub': '3 updates and 2 todos today',
  'kind.公告': 'Notices',
  'kind.动态': 'Feed',
  'kind.待办': 'Todos',
  'kind.新发布': 'New',
  'kind.all': 'All',
  'section.latest': 'Latest',
  'list.search.ph': 'Search title / summary',
  'list.empty': 'No matching content',
  'me.team': 'OAS Platform · Admin',
  'me.posts': 'Posts',
  'me.read': 'Read',
  'me.todos': 'Todos',
  'group.preferences': 'Preferences',
  'group.general': 'General',
  'group.about': 'About',
  'setting.skin': 'Skin',
  'skin.default': 'Default',
  'skin.violet': 'Violet',
  'skin.emerald': 'Emerald',
  'skin.rose': 'Rose',
  'skin.teal': 'Teal',
  'setting.glass': 'Liquid glass',
  'setting.dark': 'Dark mode',
  'setting.followSystem': 'Follow system',
  'setting.notif': 'Notifications',
  'setting.fontSize': 'Font size',
  'setting.standard': 'Standard',
  'setting.clearCache': 'Clear cache',
  'setting.locale': 'Language',
  'about.title': 'About',
  'menu.portal': 'Template portal',
  'publish.title': 'Title',
  'publish.titlePh': 'Describe it in one line',
  'publish.content': 'Content',
  'publish.contentPh': 'Details (optional)',
  'publish.category': 'Category',
  'common.cancel': 'Cancel',
  'common.publish': 'Publish',
  'feed.257.title': 'oas-ui 2.5.7 released',
  'feed.257.summary':
    'swatch presets, upload crop and form batch enhancements — mobile flyout submenu lands too.',
  'feed.mobile.title': 'Mobile sprint recap',
  'feed.mobile.summary':
    'bottom-sheet / app-bar / bottom-navigation trio + 44px touch targets everywhere.',
  'feed.okr.title': 'Quarterly OKR check-in',
  'feed.okr.summary': 'Two of three key results done; the last one closes by month end.',
  'feed.repo.title': 'New member in the template repo',
  'feed.repo.summary': 'mobile-h5 is live: consume web components with zero framework on mobile.',
  'feed.security.title': 'Security maintenance notice',
  'feed.security.summary':
    'Routine maintenance this Friday 02:00-04:00, save your work in advance.',
  'feed.upgrade.title': '2.5.7 upgrade checklist',
  'feed.upgrade.summary':
    'Seven templates aligned, CDN re-pinned, glass/skin backported — reversible path.',
  'time.today': 'Today',
  'time.yesterday': 'Yesterday',
  'time.monday': 'Mon',
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase()
    return lang === 'zh' || lang.startsWith('zh-') ? 'zh-CN' : 'en'
  }
  return 'en'
}

export function initI18n(): void {
  if (inited) return
  inited = true
  registerLocale({
    name: 'zh-CN',
    messages: { ...builtinZh.messages, ...zhMessages } as LocaleMessages,
  })
  registerLocale({
    name: 'en',
    messages: { ...builtinEn.messages, ...enMessages } as LocaleMessages,
  })
  pkgSetLocale(detectLocale())
  if (typeof document !== 'undefined') document.documentElement.lang = pkgGetLocaleName()
}

export function currentLocale(): Locale {
  initI18n()
  return pkgGetLocaleName() === 'en' ? 'en' : 'zh-CN'
}

/** 切换语言：持久化 + 整页 reload（移动端单渲染树，无响应式重渲） */
export function setLocale(name: Locale): void {
  initI18n()
  pkgSetLocale(name)
  try {
    localStorage.setItem(KEY, name)
  } catch {
    /* ignore */
  }
  location.reload()
}

export function t(key: string, params?: Record<string, string | number>): string {
  initI18n()
  return pkgT(key as Parameters<typeof pkgT>[0], params)
}
