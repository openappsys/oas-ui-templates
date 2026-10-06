<script lang="ts">
  // src/pages/settings/appearance-tab.svelte —— 外观 Tab：主题色/圆角/字体大小/表格密度/主题编辑器/重置
  //   主题色即时写 --oas-color-primary 并按明暗分键（oas-admin.settings.theme.{light|dark}）存储，
  //   监听 document 'themechange' 换色；圆角写 --oas-radius-md；字号/密度调 applyFontSize()/applyDensity()；
  //   主题编辑器 token 变更持久化到 CUSTOM_TOKENS_KEY；皮肤写 data-skin（oas-skin 预设层，
  //   与自定义主色互斥）；重置清 5 键并 removeProperty。
  import { appMessage } from '../../lib/app-message'
  import { useT } from '../../lib/use-t.svelte'
  import {
    CUSTOM_TOKENS_KEY,
    DEFAULT_COLOR,
    DEFAULT_RADIUS,
    DENSITY_KEY,
    FONT_SIZE_KEY,
    FONT_SIZE_OPTIONS,
    GLASS_KEY,
    RADIUS_KEY,
    SKINS,
    SKIN_KEY,
    THEME_PREFIX,
    type Density,
    type FontSize,
    type Skin,
    applyDensity,
    applyFontSize,
    applyGlass,
    applySkin,
    currentTheme,
    readColor,
    readDensity,
    readFontSize,
    readGlass,
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

  const { t, locale } = useT()
  /** 模板文案函数：读 $locale 建立响应式依赖，切语言时重渲 */
  const tt = $derived.by(() => {
    void $locale
    return t
  })

  let color = $state(readColor())
  let colorPickerEl = $state<HTMLElement | null>(null)
  // color-picker 2.5.9 的 value property setter 在自定义元素 upgrade 时序下内部控件为 null
  // （syncControls 判空缺失，已登记 demands）——初始色/跟随改走 attribute 通道（react d0ecf79 同款）
  $effect(() => {
    colorPickerEl?.setAttribute('value', color)
  })
  let radius = $state(readRadius())
  let fontSize = $state<FontSize>(readFontSize())
  let density = $state<Density>(readDensity())
  let skin = $state<Skin>(readSkin())
  let glass = $state<boolean>(readGlass())
  let themeEditorEl = $state<HTMLElement | null>(null)
  let fontSizeGroupEl = $state<HTMLDivElement | null>(null)
  let densityGroupEl = $state<HTMLDivElement | null>(null)
  let skinGroupEl = $state<HTMLDivElement | null>(null)

  // div 组容器委托监听 oas-change：kebab 自定义事件的模板直绑仅声明在 oas-* 组件标签上，
  // 原生元素走 addEventListener
  $effect(() => {
    const fs = fontSizeGroupEl
    const ds = densityGroupEl
    const sk = skinGroupEl
    fs?.addEventListener('oas-change', onFontSizeChange)
    ds?.addEventListener('oas-change', onDensityChange)
    sk?.addEventListener('oas-change', onSkinChange)
    return () => {
      fs?.removeEventListener('oas-change', onFontSizeChange)
      ds?.removeEventListener('oas-change', onDensityChange)
      sk?.removeEventListener('oas-change', onSkinChange)
    }
  })

  /** oas-radio 组的 oas-change 在组容器上委托：composedPath[0] 取实际变动的 radio */
  function changedRadioValue(ev: Event): string | null {
    const radio = ev.composedPath()[0] as HTMLElement
    if (!radio.hasAttribute('checked')) return null
    return radio.getAttribute('value')
  }

  // 自定义主色与皮肤互斥：写 inline 主色即回默认皮肤（皮肤的品牌色族让位）
  function onColorChange(e: Event): void {
    const { value } = (e as CustomEvent<{ value: string }>).detail
    if (!value) return
    document.documentElement.removeAttribute('data-skin')
    localStorage.setItem(SKIN_KEY, '')
    skin = ''
    document.documentElement.style.setProperty('--oas-color-primary', value)
    localStorage.setItem(`${THEME_PREFIX}${currentTheme()}`, value)
    color = value
  }

  // 圆角：即时写 --oas-radius-md 并持久化（无 toast）
  function onRadiusChange(e: Event): void {
    const n = Number((e as CustomEvent<{ value: number }>).detail.value)
    if (!Number.isFinite(n)) return
    document.documentElement.style.setProperty('--oas-radius-md', `${n}px`)
    localStorage.setItem(RADIUS_KEY, String(n))
    radius = n
  }

  function onFontSizeChange(e: Event): void {
    const v = changedRadioValue(e) as FontSize | null
    if (!v) return
    localStorage.setItem(FONT_SIZE_KEY, v)
    applyFontSize()
    fontSize = v
    appMessage.success(t('common.saved'))
  }

  function onDensityChange(e: Event): void {
    const v = changedRadioValue(e) as Density | null
    if (!v) return
    localStorage.setItem(DENSITY_KEY, v)
    applyDensity()
    density = v
    appMessage.success(t('common.saved'))
  }

  // 皮肤切换：写 data-skin + 持久化；皮肤接管品牌色族，需清 inline 自定义主色
  function onSkinChange(e: Event): void {
    const v = changedRadioValue(e) as Skin | null
    if (v == null) return
    localStorage.setItem(SKIN_KEY, v)
    document.documentElement.style.removeProperty('--oas-color-primary')
    localStorage.removeItem(`${THEME_PREFIX}${currentTheme()}`)
    applySkin(v)
    skin = v
    appMessage.success(t('common.saved'))
  }

  // 玻璃质感：写 data-glass + 持久化（浮层磨砂层，默认关）
  function onGlassChange(e: Event): void {
    const checked = Boolean((e as CustomEvent<{ checked: boolean }>).detail?.checked)
    localStorage.setItem(GLASS_KEY, checked ? 'on' : 'off')
    applyGlass(checked)
    glass = checked
    appMessage.success(t('common.saved'))
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

  // 主题切换：取色器显示值换成新主题的有效色，并按新主题重设 --oas-color-primary
  $effect(() => {
    const onThemeChange = (): void => {
      const theme = currentTheme()
      color = readColor()
      const stored = localStorage.getItem(`${THEME_PREFIX}${theme}`)
      if (stored) document.documentElement.style.setProperty('--oas-color-primary', stored)
      else document.documentElement.style.removeProperty('--oas-color-primary')
    }
    document.addEventListener('themechange', onThemeChange)
    return () => document.removeEventListener('themechange', onThemeChange)
  })

  // 重置：清主题色双键 + 圆角 + 自定义 token + 皮肤共 5 键，removeProperty 两个 CSS 变量
  function onReset(): void {
    localStorage.removeItem(`${THEME_PREFIX}light`)
    localStorage.removeItem(`${THEME_PREFIX}dark`)
    localStorage.removeItem(RADIUS_KEY)
    localStorage.removeItem(CUSTOM_TOKENS_KEY)
    localStorage.removeItem(SKIN_KEY)
    applySkin('')
    skin = ''
    document.documentElement.style.removeProperty('--oas-color-primary')
    document.documentElement.style.removeProperty('--oas-radius-md')
    color = DEFAULT_COLOR
    radius = DEFAULT_RADIUS
    ;(themeEditorEl as unknown as { reset?: () => void } | null)?.reset?.()
    appMessage.success(t('settings.appearance.resetDone'))
  }
</script>

<div class="setting-group">
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.appearance.primaryLabel')}</div>
      <div class="setting-hint">{tt('settings.appearance.primaryHint')}</div>
    </div>
    <oas-color-picker
      id="appearance-color"
      data-testid="appearance-color"
      bind:this={colorPickerEl}
      onoas-change={onColorChange}
    ></oas-color-picker>
  </div>
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.appearance.primaryLabel')}</div>
      <div class="setting-hint">{tt('settings.appearance.swatchHint')}</div>
    </div>
    <oas-swatch-group
      id="appearance-swatch"
      data-testid="appearance-swatch"
      value={color}
      onoas-change={onColorChange}
    >
      {#each PRIMARY_SWATCHES as c (c)}
        <oas-swatch color={c}></oas-swatch>
      {/each}
    </oas-swatch-group>
  </div>
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.appearance.glassLabel')}</div>
      <div class="setting-hint">{tt('settings.appearance.glassHint')}</div>
    </div>
    <oas-switch
      id="appearance-glass"
      data-testid="appearance-glass"
      checked={glass ? '' : null}
      onoas-change={onGlassChange}
    ></oas-switch>
  </div>
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.appearance.skinLabel')}</div>
      <div class="setting-hint">{tt('settings.appearance.skinHint')}</div>
    </div>
    <!-- checked 用存在性语义（true→''、false→null 移除属性）：组件按属性存在判定选中 -->
    <div id="skin-group" class="radio-group inline" data-testid="skin-group" bind:this={skinGroupEl}>
      {#each SKINS as s (s)}
        <oas-radio name="skin" value={s} checked={skin === s ? '' : null}>
          {tt(SKIN_LABEL_KEYS[s])}
        </oas-radio>
      {/each}
    </div>
  </div>
</div>
<div class="setting-group">
  <div class="setting-row">
    <div>
      <div class="setting-label">{tt('settings.appearance.radiusLabel')}</div>
      <div class="setting-hint">{tt('settings.appearance.radiusHint')}</div>
    </div>
    <div class="radius-control">
      <oas-slider
        id="appearance-radius"
        data-testid="appearance-radius"
        min="1"
        max="12"
        step="1"
        value={radius}
        onoas-change={onRadiusChange}
      ></oas-slider>
      <span id="radius-value" class="mono">{radius}px</span>
    </div>
  </div>
</div>
<div class="setting-group">
  <div class="setting-group-title">{tt('settings.general.fontSizeTitle')}</div>
  <!-- checked 用存在性语义（true→''、false→null 移除属性）：组件按属性存在判定选中 -->
  <div
    id="font-size-group"
    class="radio-group inline"
    data-testid="font-size-group"
    bind:this={fontSizeGroupEl}
  >
    {#each FONT_SIZE_OPTIONS as o (o.value)}
      <oas-radio name="fontSize" value={o.value} checked={fontSize === o.value ? '' : null}>
        {tt(FONT_SIZE_MAP[o.value])}
      </oas-radio>
    {/each}
  </div>
</div>
<div class="setting-group">
  <div class="setting-group-title">{tt('settings.general.densityTitle')}</div>
  <div
    id="density-group"
    class="radio-group inline"
    data-testid="density-group"
    bind:this={densityGroupEl}
  >
    {#each DENSITY_OPTIONS as o (o.value)}
      <oas-radio name="density" value={o.value} checked={density === o.value ? '' : null}>
        {tt(o.labelKey)}
      </oas-radio>
    {/each}
  </div>
</div>
<div class="setting-group">
  <div class="setting-group-title">{tt('settings.appearance.themeEditorTitle')}</div>
  <div class="setting-hint">{tt('settings.appearance.themeEditorHint')}</div>
  <oas-theme-editor
    id="settings-theme-editor"
    bind:this={themeEditorEl}
    data-testid="settings-theme-editor"
    onoas-change={onThemeEditorChange}
  ></oas-theme-editor>
</div>
<div class="setting-group">
  <!-- oas-button 内部渲染原生 button，键盘事件由组件自带 -->
  <oas-button data-testid="appearance-reset" type="default" onclick={onReset}>
    {tt('settings.appearance.reset')}
  </oas-button>
</div>