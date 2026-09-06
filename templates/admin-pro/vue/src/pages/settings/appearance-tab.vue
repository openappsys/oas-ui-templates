<script setup lang="ts">
// src/pages/settings/appearance-tab.vue —— 外观 Tab：主题色/圆角/字体大小/表格密度/主题编辑器/重置
//   读写走 Pinia settings store：动作改状态 → 生效器写 DOM → $subscribe 同步持久化（键名不变）；
//   主题色按明暗分键（oas-admin.settings.theme.{light|dark}），监听 document 'themechange'
//   调 store.syncTheme 换色；重置走 store.resetAppearance 清对应存储位。
// Vue 化差异：oas-change 模板直绑；radio 组的 oas-change 在组容器上委托、composedPath[0] 取实际
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useT } from '../../composables/use-t'
import { appMessage } from '../../lib/app-message'
import { useSettingsStore } from '../../stores/settings'
import {
  DEFAULT_COLOR,
  DEFAULT_RADIUS,
  FONT_SIZE_OPTIONS,
  type Density,
  type FontSize,
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

const store = useSettingsStore()
const { fontSize, density } = storeToRefs(store)

// 取色器显示值：当前主题的有效主题色（主题切换时手动同步——主题切换非响应式状态）
const color = ref(store.currentColor())
/** 圆角显示值：未自定义回落默认 6px */
const radius = computed(() => store.radius ?? DEFAULT_RADIUS)

/** oas-radio 组的 oas-change 在组容器上委托：composedPath[0] 取实际变动的 radio（vanilla 同款） */
function changedRadioValue(ev: Event): string | null {
  const radio = ev.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute('checked')) return null
  return radio.getAttribute('value')
}

// 主题色：写 store 当前主题分键 + 即时生效（无 toast）
function onColorChange(e: Event): void {
  const { value } = (e as CustomEvent<{ value: string }>).detail
  if (!value) return
  store.setColor(value)
  color.value = value
}

// 圆角：写 store 并即时生效（无 toast）
function onRadiusChange(e: Event): void {
  const n = Number((e as CustomEvent<{ value: number }>).detail.value)
  if (!Number.isFinite(n)) return
  store.setRadius(n)
}

function onFontSizeChange(e: Event): void {
  const v = changedRadioValue(e) as FontSize | null
  if (!v) return
  store.setFontSize(v)
  appMessage.success(tt('common.saved'))
}

function onDensityChange(e: Event): void {
  const v = changedRadioValue(e) as Density | null
  if (!v) return
  store.setDensity(v)
  appMessage.success(tt('common.saved'))
}

// 主题编辑器：每次修改经 store 持久化（value 空值 = 删除该 token）
function onThemeEditorChange(e: Event): void {
  const { token, value } = (e as CustomEvent<{ token: string; value: string }>).detail
  if (typeof token !== 'string' || !token.startsWith('--')) return
  store.setCustomToken(token, value)
}

// 主题切换：取色器显示值换成新主题的有效色，store 生效器按新主题重设 --oas-color-primary
function onThemeChange(): void {
  color.value = store.currentColor()
  store.syncTheme()
}
onMounted(() => document.addEventListener('themechange', onThemeChange))
onUnmounted(() => document.removeEventListener('themechange', onThemeChange))

const themeEditorEl = ref<HTMLElement | null>(null)

// 重置：清主题色双键 + 圆角 + 自定义 token（store 状态复位 + $subscribe 同步清存储）
function onReset(): void {
  store.resetAppearance()
  color.value = DEFAULT_COLOR
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
