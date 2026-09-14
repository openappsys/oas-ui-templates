// 应用层 i18n：saved > navigator.language 嗅探（zh 系列 → zh-CN，其余一律 en）
// 注意：组件内置文案（popconfirm 确定/取消等）由 cdn.js 内联 registry 控制，恒为 zh-CN（已知边界）
// 同步锚定：js/fouc.js 内有同逻辑的嗅探脚本，改 KEY / matchBrowser 须两处同步
// 字典按语言拆分（对齐 react i18n/app-zh.ts + app-en.ts 结构）
import zhCN from './i18n/zh-CN.js'
import en from './i18n/en.js'

const KEY = 'oas-admin-cdn-mpa.locale'

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
