// src/lib/use-t.svelte.ts —— readable store 包 i18n（语义对齐 vue 版 composables/use-t.ts）
// 组件内用法：const { t, locale } = useT()，模板里 $locale 自动订阅；
// 需要随 locale 重算的文案用 $derived（引用 $locale 触发依赖收集）。
import { readable } from 'svelte/store'
import { currentLocale, onLocaleChange, setLocale, t, type AppLocale } from '../i18n'

// 模块级共享 locale store，组件库 i18n 变化时同步（多个 useT 调用共享同一响应式源）
const locale = readable<AppLocale>(currentLocale(), (set) =>
  onLocaleChange((name) => set(name as AppLocale)),
)

/** 订阅组件库 i18n 的 locale 变化，返回 t 函数与 locale store */
export function useT() {
  return { t, locale, setLocale }
}
