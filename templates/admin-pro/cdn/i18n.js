// 应用层 i18n：saved > navigator.language 嗅探（zh 系列 → zh-CN，其余一律 en）
// 组件内置文案联动（popconfirm 确定/取消等）：zh 走 cdn.js 内联 registry（同步 setLocale('zh-CN')）；
// en 动态 import 与 cdn.js 同版本的纯数据 @oas-ui/i18n/dist/en.js（内部相对 locales/en.js）后
// setLocale(module.default)。成功 Promise 缓存（重复切换零下载）；失败不永久缓存、下次切换自动重试；
// 慢包返回前用户已切回中文的迟到结果直接丢弃（不覆盖中文）。
// 同步锚定 ①：index.html <head> 内有同逻辑的 FOUC 内联脚本，改 KEY / matchBrowser 须两处同步
// 同步锚定 ②：EN_PACK_URL 必须与 index.html 钉死的 @oas-ui/ui@ 同版（scripts/bump-cdn.mjs 同时校验两个 pin）
// 词典按「壳层 / 页面」拆分在 i18n/ 目录（单文件 ≤400 行约束），此处仅负责合并与切换
import zhCore from './i18n/zh.js'
import zhPages from './i18n/zh-pages.js'
import enCore from './i18n/en.js'
import enPages from './i18n/en-pages.js'

const KEY = 'oas-admin-cdn.locale'
// 语言包版本与 index.html 的 @oas-ui/ui@ 必须同版（同 release line）：
// 版本钉在 URL 字面量里，scripts/bump-cdn.mjs 会同时校验/改写 theme/ui/i18n 三个 pin
const EN_PACK_URL = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'
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

// 英文语言包：成功 Promise 缓存；失败置空允许重试
let enPackPromise = null

function loadEnPack() {
  if (!enPackPromise) {
    enPackPromise = import(EN_PACK_URL).catch((err) => {
      enPackPromise = null
      throw err
    })
  }
  return enPackPromise
}

/**
 * 组件 registry 对齐（fire-and-forget，不阻塞壳层切换）：
 * - zh-CN 同步切（内置默认包）；en 异步装载，到达后按当前 locale gate 再应用
 * - 旧版 cdn.js（无 setLocale）优雅降级：组件内置文案维持现状，壳层词典照常切换
 */
function syncComponentLocale(next) {
  const oasui = window.OASUI
  if (!oasui || typeof oasui.setLocale !== 'function') return
  if (next === 'zh-CN') {
    oasui.setLocale('zh-CN')
    return
  }
  loadEnPack()
    .then((mod) => {
      // 竞态 gate：装载期间用户已切回 zh-CN → 迟到的英文包不得覆盖
      if (locale === 'en') oasui.setLocale(mod.default)
    })
    .catch(() => {
      /* 加载失败：组件内置文案维持当前语言，下次切英文自动重试 */
    })
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
  syncComponentLocale(next)
  for (const fn of listeners) fn(next)
}

/**
 * 取词典文案；params 以 {name} 占位符插值（与 @oas-ui/i18n 的 t 语义对齐）
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 */
export function t(key, params) {
  let text = dict[locale][key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

export function onLocaleChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 启动对齐：首访 en-US / 英文状态刷新时，组件内置文案在语言包到达后随广播刷新
syncComponentLocale(locale)
