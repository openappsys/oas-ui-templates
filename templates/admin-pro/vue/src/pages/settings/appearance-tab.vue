<script setup lang="ts">
// src/pages/settings/appearance-tab.vue —— 外观 Tab：主题色/圆角/字体大小/表格密度/主题编辑器/重置
//   主题色即时写 --oas-color-primary 并按明暗分键（oas-admin.settings.theme.{light|dark}）存储，
//   监听 document 'themechange' 换色；圆角写 --oas-radius-md；字号/密度调 applyFontSize()/applyDensity()；
//   主题编辑器 token 变更持久化到 CUSTOM_TOKENS_KEY；重置清 4 键并 removeProperty。
// Vue 化差异：oas-change 模板直绑；radio 组的 oas-change 在组容器上委托、composedPath[0] 取实际
import { onMounted, onUnmounted, ref } from 'vue'
import { useT } from '../../composables/use-t'
import { appMessage } from '../../lib/app-message'
import {
  CUSTOM_TOKENS_KEY,
  DEFAULT_COLOR,
  DEFAULT_RADIUS,
  DENSITY_KEY,
  FONT_SIZE_KEY,
  FONT_SIZE_OPTIONS,
  RADIUS_KEY,
  THEME_PREFIX,
  type Density,
  type FontSize,
  applyDensity,
  applyFontSize,
  currentTheme,
  readColor,
  readDensity,
  readFontSize,
  readRadius,
} from '../../settings-init'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  xs: 'settings.fontSize.xs',
  sm: 'settings.fontSize.sm',
  md: 'settings.fontSize.md',
  lg: 'settings.fontSize.lg',
  xl: 'settings.fontSize.xl',
}

const DENSITY_OPTIONS: Array<{ value: Density; labelKey: string }> = [
  { value: 'compact', labelKey: 'settings.density.compact' },
  { value: 'default', labelKey: 'settings.density.default' },
  { value: 'large', labelKey: 'settings.density.large' },
]

const { t: tt, locale } = useT()
/** 模板文案函数：读 locale.value 建立响应式依赖，切语言时重渲 */
function t(key: string, params?: Record<string, string | number>): string {
  void locale.value
  return tt(key, params)
}

const color = ref(readColor())
const radius = ref(readRadius())
const fontSize = ref(readFontSize())
const density = ref(readDensity())

/** oas-radio 组的 oas-change 在组容器上委托：composedPath[0] 取实际变动的 radio（vanilla 同款） */
function changedRadioValue(ev: Event): string | null {
  const radio = ev.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute('checked')) return null
  return radio.getAttribute('value')
}

// 主题色：即时写 --oas-color-primary；按当前明暗主题分键持久化（无 toast）
function onColorChange(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (!value) return
  document.documentElement.style.setProperty('--oas-color-primary', value)
  localStorage.setItem(`${THEME_PREFIX}${currentTheme()}`, value)
  color.value = value
}

// 圆角：即时写 --oas-radius-md 并持久化（无 toast）
function onRadiusChange(e: Event): void {
  const n = Number((e as CustomEvent<{ value: number }>).detail.value)
  if (!Number.isFinite(n)) return
  document.documentElement.style.setProperty('--oas-radius-md', `${n}px`)
  localStorage.setItem(RADIUS_KEY, String(n))
  radius.value = n
}

function onFontSizeChange(e: Event): void {
  const v = changedRadioValue(e) as FontSize | null
  if (!v) return
  localStorage.setItem(FONT_SIZE_KEY, v)
  applyFontSize()
  fontSize.value = v
  appMessage.success(tt('common.saved'))
}

function onDensityChange(e: Event): void {
  const v = changedRadioValue(e) as Density | null
  if (!v) return
  localStorage.setItem(DENSITY_KEY, v)
  applyDensity()
  density.value = v
  appMessage.success(tt('common.saved'))
}

// 主题编辑器：每次修改把 token 持久化，重启后由 settings-init.applyCustomTokens 重放
function onThemeEditorChange(e: Event): void {
  const { token, value } = (e as CustomEvent<{ token: string; value: string }>).detail
  if (typeof token !== 'string' || !token.startsWith('--')) return
  try {
    const raw = localStorage.getItem(CUSTOM_TOKENS_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    if (value == null || value === '') delete map[token]
    else map[token] = value
    localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function onThemeChange(): void {
  const theme = currentTheme()
  color.value = readColor()
  const stored = localStorage.getItem(`${THEME_PREFIX}${theme}`)
  if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
  else document.documentElement.style.removeProperty('--oas-color-primary')
}
onMounted(() => document.addEventListener('themechange', onThemeChange))
onUnmounted(() => document.removeEventListener('themechange', onThemeChange))

const themeEditorEl = ref<HTMLElement | null>(null)

// 重置：清主题色双键 + 圆角 + 自定义 token 共 4 键，removeProperty 两个 CSS 变量
function onReset(): void {
  localStorage.removeItem(`${THEME_PREFIX}light`)
  localStorage.removeItem(`${THEME_PREFIX}dark`)
  localStorage.removeItem(RADIUS_KEY)
  localStorage.removeItem(CUSTOM_TOKENS_KEY)
  document.documentElement.style.removeProperty('--oas-color-primary')
  document.documentElement.style.removeProperty('--oas-radius-md')
  color.value = DEFAULT_COLOR
  radius.value = DEFAULT_RADIUS
  ;(themeEditorEl.value as unknown as { reset?: () => void } | null)?.reset?.()
  appMessage.success(tt('settings.appearance.resetDone'))
}
</script>

<template>
  <div class="setting-group">
    <div class="setting-row">
      <div>
        <div class="setting-label">{{ t('settings.appearance.primaryLabel') }}</div>
        <div class="setting-hint">{{ t('settings.appearance.primaryHint') }}</div>
      </div>
      <oas-color-picker
        id="appearance-color"
        data-testid="appearance-color"
        :value="color"
        @oas-change="onColorChange"
      />
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-row">
      <div>
        <div class="setting-label">{{ t('settings.appearance.radiusLabel') }}</div>
        <div class="setting-hint">{{ t('settings.appearance.radiusHint') }}</div>
      </div>
      <div class="radius-control">
        <oas-slider
          id="appearance-radius"
          data-testid="appearance-radius"
          min="1"
          max="12"
          step="1"
          :value="radius"
          @oas-change="onRadiusChange"
        />
        <span id="radius-value" class="mono">{{ radius }}px</span>
      </div>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title">{{ t('settings.general.fontSizeTitle') }}</div>
    <div
      id="font-size-group"
      class="radio-group inline"
      data-testid="font-size-group"
      @oas-change="onFontSizeChange"
    >
      <!-- checked 用存在性语义（true→''、false→null 移除属性）：oas-radio 无同名 DOM 访问器，
           Vue 布尔直绑会写成 checked="false" 字符串，而组件按属性存在判定选中（全壳同规） -->
      <oas-radio
        v-for="o in FONT_SIZE_OPTIONS"
        :key="o.value"
        name="fontSize"
        :value="o.value"
        :checked="fontSize === o.value ? '' : null"
      >
        {{ t(FONT_SIZE_MAP[o.value]) }}
      </oas-radio>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title">{{ t('settings.general.densityTitle') }}</div>
    <div
      id="density-group"
      class="radio-group inline"
      data-testid="density-group"
      @oas-change="onDensityChange"
    >
      <oas-radio
        v-for="o in DENSITY_OPTIONS"
        :key="o.value"
        name="density"
        :value="o.value"
        :checked="density === o.value ? '' : null"
      >
        {{ t(o.labelKey) }}
      </oas-radio>
    </div>
  </div>
  <div class="setting-group">
    <div class="setting-group-title">{{ t('settings.appearance.themeEditorTitle') }}</div>
    <div class="setting-hint">{{ t('settings.appearance.themeEditorHint') }}</div>
    <oas-theme-editor
      id="settings-theme-editor"
      ref="themeEditorEl"
      data-testid="settings-theme-editor"
      @oas-change="onThemeEditorChange"
    />
  </div>
  <div class="setting-group">
    <oas-button data-testid="appearance-reset" type="default" @click="onReset">
      {{ t('settings.appearance.reset') }}
    </oas-button>
  </div>
</template>
