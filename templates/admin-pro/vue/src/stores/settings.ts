// src/stores/settings.ts —— Pinia 设置 store：响应式状态 + $subscribe 持久化 + 生效器写 DOM
// 取代 settings-init「读 localStorage + 直接写 DOM」的散点模式：
//   状态一次性初始化自 localStorage（键名/回落值逐字对齐原 read* 读取器）；
//   动作改状态 → 生效器把状态落到 DOM（--oas-color-primary / --oas-radius-md / 密度 / 字号 / 页签栏开关）；
//   $subscribe(flush: 'sync') 把状态同步持久化回原键名，localStorage 契约保持不变。
import { defineStore, getActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { ref } from 'vue'
import {
  CUSTOM_TOKENS_KEY,
  DEFAULT_COLOR,
  DENSITY_KEY,
  FONT_SIZE_KEY,
  FONT_SIZE_OPTIONS,
  FORM_MODE_KEY,
  NOTIF_CHANNELS,
  NOTIF_PREFIX,
  NOTIF_ROWS,
  PAGE_SIZE_KEY,
  RADIUS_KEY,
  TABS_BAR_KEY,
  THEME_PREFIX,
  type Density,
  type FontSize,
  type FormMode,
  currentTheme,
  readBool,
  readDensity,
  readFontSize,
  readFormMode,
  readPageSize,
  readTabsBar,
} from '../settings-init'

/** 表格密度 → 单元格纵向内边距（settings-init 原 DENSITY_PAD 同款） */
const DENSITY_PAD: Record<Density, string> = { compact: '6px', default: '12px', large: '16px' }

/** 圆角原始存储值：未自定义返回 null（区别于「回落默认 6px」——未自定义时不写内联样式） */
function readStoredRadius(): number | null {
  const n = Number(localStorage.getItem(RADIUS_KEY))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 通知矩阵开关初值（键 = 行.渠道，回落 true） */
function readNotifChecks(): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const row of NOTIF_ROWS) {
    for (const c of NOTIF_CHANNELS) {
      map[`${row.key}.${c.key}`] = readBool(`${NOTIF_PREFIX}${row.key}.${c.key}`, true)
    }
  }
  return map
}

export const useSettingsStore = defineStore('settings', () => {
  // 主题色按明暗分键；null = 未自定义（对应原「无存储键则不动 --oas-color-primary」语义）
  const themeColors = ref<{ light: string | null; dark: string | null }>({
    light: localStorage.getItem(`${THEME_PREFIX}light`),
    dark: localStorage.getItem(`${THEME_PREFIX}dark`),
  })
  const radius = ref<number | null>(readStoredRadius())
  const fontSize = ref<FontSize>(readFontSize())
  const density = ref<Density>(readDensity())
  const formMode = ref<FormMode>(readFormMode())
  const pageSize = ref<string>(readPageSize())
  const tabsBar = ref<boolean>(readTabsBar())
  const notifChecks = ref<Record<string, boolean>>(readNotifChecks())
  /** 主题编辑器（oas-theme-editor）写入的自定义 token：键 → 值 */
  const customTokens = ref<Record<string, string>>(readCustomTokens())

  function readCustomTokens(): Record<string, string> {
    try {
      const raw = localStorage.getItem(CUSTOM_TOKENS_KEY)
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  }

  // —— 生效器：状态 → DOM（行为逐字对齐 settings-init 原 applySettings / apply* 系列）——

  /** 主题色：按当前明暗主题取存储值，有则写 --oas-color-primary，无则移除内联值 */
  function applyColor(): void {
    const stored = themeColors.value[currentTheme()]
    if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
    else document.documentElement.style.removeProperty('--oas-color-primary')
  }

  /** 圆角：有自定义值写 --oas-radius-md，未自定义移除（回落主题默认值） */
  function applyRadius(): void {
    if (radius.value != null) {
      document.documentElement.style.setProperty('--oas-radius-md', `${radius.value}px`)
    } else {
      document.documentElement.style.removeProperty('--oas-radius-md')
    }
  }

  function applyDensity(): void {
    document.documentElement.style.setProperty(
      '--oas-table-cell-padding-block',
      DENSITY_PAD[density.value],
    )
  }

  function applyFontSize(): void {
    const scale = FONT_SIZE_OPTIONS.find((o) => o.value === fontSize.value)?.scale ?? 1
    document.documentElement.style.setProperty('--app-font-scale', String(scale))
  }

  function applyTabsBar(): void {
    document.documentElement.dataset.tabsBar = tabsBar.value ? 'on' : 'off'
  }

  /** 自定义 token 重放（原 settings-init.applyCustomTokens：只增写，不做逐键清理） */
  function applyCustomTokens(): void {
    for (const [k, v] of Object.entries(customTokens.value)) {
      document.documentElement.style.setProperty(k, v)
    }
  }

  /** 启动重放：一次性把全部状态落 DOM（原 applySettings 时序） */
  function applyAll(): void {
    applyColor()
    applyRadius()
    applyDensity()
    applyFontSize()
    applyCustomTokens()
    applyTabsBar()
  }

  // —— 动作：设置页/页面消费方唯一写入口 ——

  /** 主题色：写入当前主题的分键存储位并即时生效 */
  function setColor(value: string): void {
    themeColors.value[currentTheme()] = value
    applyColor()
  }

  function setRadius(n: number): void {
    radius.value = n
    applyRadius()
  }

  function setFontSize(v: FontSize): void {
    fontSize.value = v
    applyFontSize()
  }

  function setDensity(v: Density): void {
    density.value = v
    applyDensity()
  }

  function setFormMode(v: FormMode): void {
    formMode.value = v
  }

  function setPageSize(v: string): void {
    pageSize.value = v
  }

  function setTabsBar(v: boolean): void {
    tabsBar.value = v
    applyTabsBar()
  }

  function setNotif(key: string, v: boolean): void {
    notifChecks.value[key] = v
  }

  /** 主题编辑器 token 变更：value 空值表示删除该 token（只持久化，DOM 由编辑器自绘） */
  function setCustomToken(token: string, value: string | null): void {
    if (value == null || value === '') delete customTokens.value[token]
    else customTokens.value[token] = value
  }

  /** 主题切换后联动：按新主题重设主题色（themechange 监听方调用） */
  function syncTheme(): void {
    applyColor()
  }

  /** 当前主题的有效主题色：存储值 → 实时计算值 → 默认色（逐字对齐原 readColor） */
  function currentColor(): string {
    const stored = themeColors.value[currentTheme()]
    if (stored) return stored
    const live = getComputedStyle(document.documentElement)
      .getPropertyValue('--oas-color-primary')
      .trim()
    return live || DEFAULT_COLOR
  }

  /** 外观重置：清主题色双键 + 圆角 + 自定义 token（不含字号/密度，语义对齐原 onReset） */
  function resetAppearance(): void {
    themeColors.value = { light: null, dark: null }
    radius.value = null
    customTokens.value = {}
    applyColor()
    applyRadius()
  }

  return {
    themeColors,
    radius,
    fontSize,
    density,
    formMode,
    pageSize,
    tabsBar,
    notifChecks,
    customTokens,
    applyAll,
    currentColor,
    setColor,
    setRadius,
    setFontSize,
    setDensity,
    setFormMode,
    setPageSize,
    setTabsBar,
    setNotif,
    setCustomToken,
    syncTheme,
    resetAppearance,
  }
})

type SettingsStore = ReturnType<typeof useSettingsStore>

/** $subscribe 回调：状态 → localStorage（可空字段 set-or-remove，键名逐字对齐原散点写入） */
function persistSettings(store: SettingsStore): void {
  for (const theme of ['light', 'dark'] as const) {
    const v = store.themeColors[theme]
    if (v != null) localStorage.setItem(`${THEME_PREFIX}${theme}`, v)
    else localStorage.removeItem(`${THEME_PREFIX}${theme}`)
  }
  if (store.radius != null) localStorage.setItem(RADIUS_KEY, String(store.radius))
  else localStorage.removeItem(RADIUS_KEY)
  localStorage.setItem(FONT_SIZE_KEY, store.fontSize)
  localStorage.setItem(DENSITY_KEY, store.density)
  localStorage.setItem(FORM_MODE_KEY, store.formMode)
  localStorage.setItem(PAGE_SIZE_KEY, store.pageSize)
  localStorage.setItem(TABS_BAR_KEY, String(store.tabsBar))
  for (const row of NOTIF_ROWS) {
    for (const c of NOTIF_CHANNELS) {
      const key = `${row.key}.${c.key}`
      localStorage.setItem(NOTIF_PREFIX + key, String(store.notifChecks[key]))
    }
  }
  const tokens = store.customTokens
  if (Object.keys(tokens).length > 0) {
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens))
  } else {
    localStorage.removeItem(CUSTOM_TOKENS_KEY)
  }
}

/** 已注册持久化订阅的 pinia 实例（每个实例只订阅一次，测试可反复新建） */
const subscribed = new WeakSet<Pinia>()

/** 应用启动时调用一次：注册 $subscribe 持久化 + 重放全部生效器（原 main.ts applySettings 时序） */
export function initSettingsStore(pinia?: Pinia): void {
  const store = useSettingsStore(pinia)
  const instance = pinia ?? getActivePinia()
  if (!instance) throw new Error('initSettingsStore 需要已安装的 pinia 实例（先 app.use(pinia)）')
  if (!subscribed.has(instance)) {
    store.$subscribe(() => persistSettings(store), { flush: 'sync' })
    subscribed.add(instance)
  }
  store.applyAll()
}
