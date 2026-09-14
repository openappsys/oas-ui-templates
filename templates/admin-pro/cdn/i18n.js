// 应用层 i18n：saved > navigator.language 嗅探（zh 系列 → zh-CN，其余一律 en）
// 注意：组件内置文案（popconfirm 确定/取消等）由 cdn.js 内联 registry 控制，恒为 zh-CN（已知边界）
// 同步锚定：index.html <head> 内有同逻辑的 FOUC 内联脚本，改 KEY / matchBrowser 须两处同步
// 词典按「壳层 / 页面」拆分在 i18n/ 目录（单文件 ≤400 行约束），此处仅负责合并与切换
import zhCore from './i18n/zh.js'
import zhPages from './i18n/zh-pages.js'
import enCore from './i18n/en.js'
import enPages from './i18n/en-pages.js'

const KEY = 'oas-admin-cdn.locale'
const listeners = new Set()

const dict = {
  'zh-CN': { ...zhCore, ...zhPages },
  en: { ...enCore, ...enPages },
}

function matchBrowser(lang) {
  const n = (lang || '').toLowerCase()
  if (n === 'zh' || n.startsWith('zh-')) return 'zh-CN'
  return 'en'
}

export function detectLocale() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    /* 隐私模式 */
  }
  return matchBrowser(navigator.language)
}

let locale = detectLocale()

export function currentLocale() {
  return locale
}

export function setLocale(next) {
  if (next !== 'zh-CN' && next !== 'en') return
  locale = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next
  for (const fn of listeners) fn(next)
}

export function t(key) {
  return dict[locale][key] ?? key
}

export function onLocaleChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
