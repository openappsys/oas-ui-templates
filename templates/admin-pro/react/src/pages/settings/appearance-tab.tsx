// src/pages/settings/appearance-tab.tsx —— 外观 Tab：主题色/圆角/字体大小/表格密度/主题编辑器/重置
//   主题色即时写 --oas-color-primary 并按明暗分键（oas-admin.settings.theme.{light|dark}）存储，
//   监听 document 'themechange' 换色；圆角写 --oas-radius-md；字号/密度调 applyFontSize()/applyDensity()；
//   主题编辑器 token 变更持久化到 CUSTOM_TOKENS_KEY；皮肤写 data-skin（oas-skin 预设层，
//   与自定义主色互斥）；重置清 5 键并 removeProperty。
import { useEffect, useRef, useState } from 'react'
import { useOasEvent } from '../../hooks/use-oas-event'
import { useT } from '../../hooks/use-t'
import { appMessage } from '../../lib/app-message'
import {
  CUSTOM_TOKENS_KEY,
  DEFAULT_COLOR,
  DEFAULT_RADIUS,
  DENSITY_KEY,
  FONT_SIZE_KEY,
  FONT_SIZE_OPTIONS,
  RADIUS_KEY,
  SKINS,
  SKIN_KEY,
  GLASS_KEY,
  THEME_PREFIX,
  type Density,
  type FontSize,
  type Skin,
  applyDensity,
  applyFontSize,
  applySkin,
  currentTheme,
  readColor,
  readGlass,
  readDensity,
  readFontSize,
  readRadius,
  readSkin,
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

const SKIN_LABEL_KEYS: Record<Skin, string> = {
  '': 'settings.skin.default',
  violet: 'settings.skin.violet',
  emerald: 'settings.skin.emerald',
  rose: 'settings.skin.rose',
  amber: 'settings.skin.amber',
  graphite: 'settings.skin.graphite',
  teal: 'settings.skin.teal',
}

/** 主题预设色板（theme 11 预设的常用子集，色值与 --oas-preset-* 一致） */
const PRIMARY_SWATCHES = [
  '#1677ff', // blue
  '#2f54eb', // geekblue
  '#722ed1', // purple
  '#13c2c2', // cyan
  '#52c41a', // green
  '#faad14', // gold
  '#fa541c', // volcano
  '#f5222d', // red
]
/** oas-radio 组的 oas-change 在组容器上委托：composedPath[0] 取实际变动的 radio（vanilla 同款） */
function changedRadioValue(ev: Event): string | null {
  const radio = ev.composedPath()[0] as HTMLElement
  if (!radio.hasAttribute('checked')) return null
  return radio.getAttribute('value')
}

export function AppearanceTab() {
  const { t } = useT()
  const [color, setColor] = useState(readColor)
  const [glass, setGlass] = useState(readGlass)
  const [radius, setRadius] = useState(readRadius)
  const [fontSize, setFontSize] = useState(readFontSize)
  const [density, setDensity] = useState(readDensity)
  const [skin, setSkin] = useState<Skin>(readSkin)

  const colorRef = useRef<HTMLElement | null>(null)
  const swatchRef = useRef<HTMLElement | null>(null)
  const glassRef = useRef<HTMLElement | null>(null)
  const radiusRef = useRef<HTMLElement | null>(null)
  const fontSizeGroupRef = useRef<HTMLDivElement | null>(null)
  const densityGroupRef = useRef<HTMLDivElement | null>(null)
  const skinGroupRef = useRef<HTMLDivElement | null>(null)
  const themeEditorRef = useRef<HTMLElement | null>(null)

  // 主题色：即时写 --oas-color-primary；按当前明暗主题分键持久化（无 toast）
  const applyPrimaryColor = (value: string): void => {
    document.documentElement.style.setProperty('--oas-color-primary', value)
    localStorage.setItem(`${THEME_PREFIX}${currentTheme()}`, value)
    setColor(value)
  }

  // 自定义主色与皮肤互斥：写 inline 主色即回默认皮肤（皮肤的品牌色族让位）
  const applyCustomColor = (value: string): void => {
    document.documentElement.removeAttribute('data-skin')
    localStorage.setItem(SKIN_KEY, '')
    setSkin('')
    applyPrimaryColor(value)
  }

  // 玻璃质感开关：写 data-glass + 持久化（启动由 settings-init.applySettings 恢复）
  useOasEvent<{ checked: boolean }>(glassRef, 'oas-change', (detail) => {
    const on = detail?.checked
    if (typeof on !== 'boolean') return
    localStorage.setItem(GLASS_KEY, on ? 'on' : 'off')
    setGlass(on)
  })
  useOasEvent<{ value: string }>(colorRef, 'oas-change', (detail) => {
    if (!detail.value) return
    applyCustomColor(detail.value)
  })

  // 预设色板：一键切换（拾色器保留精确自定义，二者写入同一持久化键）
  useOasEvent<{ value: string }>(swatchRef, 'oas-change', (detail) => {
    if (!detail.value) return
    applyCustomColor(detail.value)
  })

  // 皮肤切换：写 data-skin + 持久化；皮肤接管品牌色族，需清 inline 自定义主色
  useOasEvent(skinGroupRef, 'oas-change', (_detail: unknown, ev) => {
    const v = changedRadioValue(ev) as Skin | null
    if (v == null) return
    localStorage.setItem(SKIN_KEY, v)
    document.documentElement.style.removeProperty('--oas-color-primary')
    localStorage.removeItem(`${THEME_PREFIX}${currentTheme()}`)
    applySkin(v)
    setSkin(v)
    appMessage.success(t('common.saved'))
  })

  // 圆角：即时写 --oas-radius-md 并持久化（无 toast）
  useOasEvent<{ value: number }>(radiusRef, 'oas-change', (detail) => {
    const n = Number(detail.value)
    if (!Number.isFinite(n)) return
    document.documentElement.style.setProperty('--oas-radius-md', `${n}px`)
    localStorage.setItem(RADIUS_KEY, String(n))
    setRadius(n)
  })

  useOasEvent(fontSizeGroupRef, 'oas-change', (_detail: unknown, ev) => {
    const v = changedRadioValue(ev) as FontSize | null
    if (!v) return
    localStorage.setItem(FONT_SIZE_KEY, v)
    applyFontSize()
    setFontSize(v)
    appMessage.success(t('common.saved'))
  })

  useOasEvent(densityGroupRef, 'oas-change', (_detail: unknown, ev) => {
    const v = changedRadioValue(ev) as Density | null
    if (!v) return
    localStorage.setItem(DENSITY_KEY, v)
    applyDensity()
    setDensity(v)
    appMessage.success(t('common.saved'))
  })

  // 主题编辑器：每次修改把 token 持久化，重启后由 settings-init.applyCustomTokens 重放
  useOasEvent<{ token: string; value: string }>(themeEditorRef, 'oas-change', (detail) => {
    const { token, value } = detail
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
  })

  useEffect(() => {
    const onThemeChange = (): void => {
      const theme = currentTheme()
      setColor(readColor())
      const stored = localStorage.getItem(`${THEME_PREFIX}${theme}`)
      if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
      else document.documentElement.style.removeProperty('--oas-color-primary')
    }
    document.addEventListener('themechange', onThemeChange)
    return () => document.removeEventListener('themechange', onThemeChange)
  }, [])

  // 重置：清主题色双键 + 圆角 + 自定义 token + 皮肤共 5 键，removeProperty 两个 CSS 变量
  const onReset = (): void => {
    localStorage.removeItem(`${THEME_PREFIX}light`)
    localStorage.removeItem(`${THEME_PREFIX}dark`)
    localStorage.removeItem(RADIUS_KEY)
    localStorage.removeItem(CUSTOM_TOKENS_KEY)
    localStorage.removeItem(SKIN_KEY)
    applySkin('')
    setSkin('')
    document.documentElement.style.removeProperty('--oas-color-primary')
    document.documentElement.style.removeProperty('--oas-radius-md')
    setColor(DEFAULT_COLOR)
    setRadius(DEFAULT_RADIUS)
    ;(themeEditorRef.current as unknown as { reset?: () => void } | null)?.reset?.()
    appMessage.success(t('settings.appearance.resetDone'))
  }

  return (
    <>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.appearance.primaryLabel')}</div>
            <div className="setting-hint">{t('settings.appearance.primaryHint')}</div>
          </div>
          <oas-color-picker
            ref={colorRef}
            value={color}
            data-testid="appearance-color"
            id="appearance-color"
          />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.appearance.primaryLabel')}</div>
            <div className="setting-hint">{t('settings.appearance.swatchHint')}</div>
          </div>
          <oas-swatch-group ref={swatchRef} data-testid="appearance-swatch" value={color}>
            {PRIMARY_SWATCHES.map((c) => (
              <oas-swatch key={c} color={c} />
            ))}
          </oas-swatch-group>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.appearance.glassLabel')}</div>
            <div className="setting-hint">{t('settings.appearance.glassHint')}</div>
          </div>
          <oas-switch ref={glassRef} data-testid="appearance-glass" checked={glass} />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.appearance.skinLabel')}</div>
            <div className="setting-hint">{t('settings.appearance.skinHint')}</div>
          </div>
          <div
            className="radio-group inline"
            data-testid="skin-group"
            id="skin-group"
            ref={skinGroupRef}
          >
            {SKINS.map((s) => (
              <oas-radio key={s} name="skin" value={s} checked={skin === s}>
                {t(SKIN_LABEL_KEYS[s])}
              </oas-radio>
            ))}
          </div>
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.appearance.radiusLabel')}</div>
            <div className="setting-hint">{t('settings.appearance.radiusHint')}</div>
          </div>
          <div className="radius-control">
            <oas-slider
              ref={radiusRef}
              data-testid="appearance-radius"
              id="appearance-radius"
              min="1"
              max="12"
              step="1"
              value={radius}
            />
            <span id="radius-value" className="mono">
              {radius}px
            </span>
          </div>
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-group-title">{t('settings.general.fontSizeTitle')}</div>
        <div
          className="radio-group inline"
          data-testid="font-size-group"
          id="font-size-group"
          ref={fontSizeGroupRef}
        >
          {FONT_SIZE_OPTIONS.map((o) => (
            <oas-radio key={o.value} name="fontSize" value={o.value} checked={fontSize === o.value}>
              {t(FONT_SIZE_MAP[o.value])}
            </oas-radio>
          ))}
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-group-title">{t('settings.general.densityTitle')}</div>
        <div
          className="radio-group inline"
          data-testid="density-group"
          id="density-group"
          ref={densityGroupRef}
        >
          {DENSITY_OPTIONS.map((o) => (
            <oas-radio key={o.value} name="density" value={o.value} checked={density === o.value}>
              {t(o.labelKey)}
            </oas-radio>
          ))}
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-group-title">{t('settings.appearance.themeEditorTitle')}</div>
        <div className="setting-hint">{t('settings.appearance.themeEditorHint')}</div>
        <oas-theme-editor
          ref={themeEditorRef}
          data-testid="settings-theme-editor"
          id="settings-theme-editor"
        />
      </div>
      <div className="setting-group">
        <oas-button data-testid="appearance-reset" type="default" onClick={onReset}>
          {t('settings.appearance.reset')}
        </oas-button>
      </div>
    </>
  )
}
