import { ref, onUnmounted } from 'vue'
import { currentLocale, onLocaleChange, setLocale, t, type AppLocale } from '../i18n'

// 模块级共享 locale ref，组件库 i18n 变化时同步（多个 useT 调用共享同一响应式源）
const locale = ref<AppLocale>(currentLocale())
let subscribed = false
function ensureSubscribed() {
  if (subscribed) return
  subscribed = true
  onLocaleChange((name) => { locale.value = name as AppLocale })
}

/** 订阅组件库 i18n 的 locale 变化，返回 t 函数与响应式 locale */
export function useT() {
  ensureSubscribed()
  return { t, locale, setLocale }
}
