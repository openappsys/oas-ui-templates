import {
  registerLocale,
  setLocale as pkgSetLocale,
  getLocaleName as pkgGetLocaleName,
  onLocaleChange as pkgOnChange,
  t as pkgT,
} from '@oas-ui/i18n'
import type { LocaleMessages } from '@oas-ui/i18n'
import { zhCN as builtinZh } from '@oas-ui/i18n/zh-CN'
import { en as builtinEn } from '@oas-ui/i18n/en'
import appZh from './app-zh'
import appEn from './app-en'

export type AppLocale = 'zh-CN' | 'en'
export const APP_LOCALES: readonly AppLocale[] = ['zh-CN', 'en'] as const

const KEY = 'oas-admin.locale'
let inited = false

function hasDoc(): boolean {
  return typeof document !== 'undefined'
}

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function isAppLocale(v: unknown): v is AppLocale {
  return v === 'zh-CN' || v === 'en'
}

function matchBrowser(navLang: string): AppLocale | undefined {
  const lang = navLang.toLowerCase()
  if (lang === 'zh' || lang.startsWith('zh-')) return 'zh-CN'
  if (lang.startsWith('en')) return 'en'
  return undefined
}

/**
 * 决定首次访问的默认 locale。
 * 优先级（业界通行做法）：
 *   1. localStorage 已保存值（用户曾手动切换）
 *   2. navigator.language 嗅探（zh 系列 → zh-CN，en 系列 → en）
 *   3. 默认 zh-CN（产品语言）
 *
 * 浏览器多语言列表 navigator.languages 取第一项即可——单语种产品不需要遍历。
 */
export function detectLocale(): AppLocale {
  if (hasStorage()) {
    const saved = localStorage.getItem(KEY)
    if (isAppLocale(saved)) return saved
  }
  if (typeof navigator !== 'undefined') {
    const m = matchBrowser(navigator.language)
    if (m) return m
  }
  return 'zh-CN'
}

export function initI18n(): void {
  if (inited) return
  inited = true
  registerLocale({ name: 'zh-CN', messages: { ...builtinZh.messages, ...appZh } as LocaleMessages })
  registerLocale({ name: 'en', messages: { ...builtinEn.messages, ...appEn } as LocaleMessages })
  const initial = detectLocale()
  pkgSetLocale(initial)
  if (hasDoc()) document.documentElement.lang = initial
  pkgOnChange((name) => {
    if (hasDoc()) document.documentElement.lang = name
  })
}

export function setLocale(name: AppLocale): void {
  initI18n()
  pkgSetLocale(name)
  try {
    localStorage.setItem(KEY, name)
  } catch {
    /* ignore */
  }
}

export function currentLocale(): AppLocale {
  initI18n()
  return pkgGetLocaleName() === 'en' ? 'en' : 'zh-CN'
}

export function t(key: string, params?: Record<string, string | number>): string {
  initI18n()
  return pkgT(key as Parameters<typeof pkgT>[0], params)
}

export function onLocaleChange(cb: (name: string) => void): () => void {
  initI18n()
  return pkgOnChange(cb)
}
