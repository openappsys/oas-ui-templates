import { useCallback, useSyncExternalStore } from 'react'
import { currentLocale, onLocaleChange, setLocale, t as tRaw } from '../i18n'

/** 订阅组件库 i18n 的 locale 变化，返回 t 函数与当前 locale。
 *  tRaw 是模块级单例（内部读模块级 currentLocale），引用恒定——直接写入 hooks 依赖
 *  会导致 useMemo 在语言切换后不重算。此处经 useCallback 以 locale 为「版本号」包装，
 *  t 引用随语言变化：下游闭包用 t、依赖写 [t] 即获得正确的重算语义
 *  （react-i18next useTranslation 同款模式），exhaustive-deps 不再误报。 */
export function useT() {
  const locale = useSyncExternalStore(onLocaleChange, currentLocale)
  // biome-ignore lint/correctness/useExhaustiveDependencies: locale 是版本号——tRaw 引用稳定但读取模块级 locale，locale 变化必须换新引用以触发下游重算
  const t = useCallback((...args: Parameters<typeof tRaw>) => tRaw(...args), [locale])
  return { t, locale, setLocale }
}
