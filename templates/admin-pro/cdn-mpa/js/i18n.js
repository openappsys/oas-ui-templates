// 应用层 i18n：saved > navigator.language 嗅探（zh 系列 → zh-CN，其余一律 en）
// 组件内置文案联动（popconfirm 确定/取消等）：页面加载即按当前 locale 对齐 cdn.js 内联 registry——
// zh 同步 setLocale('zh-CN')；en 动态 import 与 cdn.js 同版本的纯数据 @oas-ui/i18n/dist/en.js
// （内部相对 locales/en.js）后 setLocale(module.default)，成功缓存、失败可重试；语言包到达前
// 组件短暂保持 zh-CN，到达即广播刷新（含已挂载组件）。MPA 切语言 = 写 storage + reload（调用方
// 负责 reload；onLocaleChange 订阅机制在 MPA 下不需要），壳层 setLocale 保持同步不 async。
// 同步锚定 ①：js/fouc.js 内有同逻辑的嗅探脚本，改 KEY / matchBrowser 须两处同步
// 同步锚定 ②：EN_PACK_URL 的 i18n 版本必须与各页 <head> 钉死的 @oas-ui/ui@ 同版（同 release line）——
// 版本钉在 URL 字面量里，scripts/bump-cdn.mjs 会同时校验/改写 theme/ui/i18n 三个 pin
// 字典按语言拆分（对齐 react i18n/app-zh.ts + app-en.ts 结构）
import zhCN from './i18n/zh-CN.js'
import en from './i18n/en.js'

const KEY = 'oas-admin-cdn-mpa.locale'
const EN_PACK_URL = 'https://unpkg.com/@oas-ui/i18n@2.6.4/dist/en.js'

const dict = {
  'zh-CN': zhCN,
  en,
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

// MPA 约定：切语言 = 写 storage + 整页 reload（调用方负责 reload；onLocaleChange 订阅机制在 MPA 下不需要）
export function setLocale(next) {
  if (next !== 'zh-CN' && next !== 'en') return
  locale = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = next
}

export function t(key) {
  return dict[locale][key] ?? key
}

// 英文语言包：成功 Promise 缓存；失败置空允许下次启动重试（MPA 下重试 = 刷新页面）
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

// 启动对齐组件 registry（fire-and-forget，不阻塞页面渲染）：
// - zh-CN 同步切（内置默认包）；en 异步装载，到达后 setLocale(module.default) 广播刷新
// - 旧版 cdn.js（无 setLocale）优雅降级：组件内置文案维持现状
const oasui = window.OASUI
if (oasui && typeof oasui.setLocale === 'function') {
  if (locale === 'zh-CN') {
    oasui.setLocale('zh-CN')
  } else {
    loadEnPack()
      .then((mod) => oasui.setLocale(mod.default))
      .catch(() => {
        /* 加载失败：组件内置文案维持 zh-CN，下次启动重试 */
      })
  }
}

// 插值换文：t() 基础上支持 {name} 占位符（对齐 vanilla t(key, params) 的常用子集）
export function tf(key, params) {
  let s = t(key)
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  }
  return s
}

// 静态文本换文：遍历 [data-i18n]（textContent）与 [data-i18n-attr]（JSON 属性映射），
// 按当前 locale 替换。HTML 里写中文源，入口是 deferred module，paint 前完成无闪烁
export function applyStaticTexts(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'))
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const map = JSON.parse(el.getAttribute('data-i18n-attr'))
    for (const [attr, key] of Object.entries(map)) el.setAttribute(attr, t(key))
  }
}
