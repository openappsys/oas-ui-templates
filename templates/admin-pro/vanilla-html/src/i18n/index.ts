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

const KEY = 'oas-admin.locale'
let inited = false

function hasDoc(): boolean {
  return typeof document !== 'undefined'
}

export function initI18n(): void {
  if (inited) return
  inited = true
  registerLocale({ name: 'zh-CN', messages: { ...builtinZh.messages, ...appZh } as LocaleMessages })
  registerLocale({ name: 'en', messages: { ...builtinEn.messages, ...appEn } as LocaleMessages })
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  const initial: AppLocale = saved === 'en' ? 'en' : 'zh-CN'
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
