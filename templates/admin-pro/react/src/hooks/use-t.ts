import { useSyncExternalStore } from 'react'
import { currentLocale, onLocaleChange, setLocale, t } from '../i18n'

/** 订阅组件库 i18n 的 locale 变化，返回 t 函数与当前 locale */
export function useT() {
  const locale = useSyncExternalStore(onLocaleChange, currentLocale)
  return { t, locale, setLocale }
}
