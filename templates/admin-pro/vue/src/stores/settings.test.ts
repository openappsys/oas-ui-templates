import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  CUSTOM_TOKENS_KEY,
  DENSITY_KEY,
  FONT_SIZE_KEY,
  FORM_MODE_KEY,
  NOTIF_PREFIX,
  PAGE_SIZE_KEY,
  RADIUS_KEY,
  TABS_BAR_KEY,
  THEME_PREFIX,
} from '../settings-init'
import { initSettingsStore, useSettingsStore } from './settings'

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--oas-color-primary')
    document.documentElement.style.removeProperty('--oas-radius-md')
    document.documentElement.style.removeProperty('--oas-table-cell-padding-block')
    document.documentElement.style.removeProperty('--app-font-scale')
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.tabsBar
    setActivePinia(createPinia())
  })

  it('启动重放：localStorage 的主题色/圆角/字号/密度落 DOM', () => {
    localStorage.setItem(`${THEME_PREFIX}light`, '#123456')
    localStorage.setItem(RADIUS_KEY, '9')
    localStorage.setItem(FONT_SIZE_KEY, 'lg')
    localStorage.setItem(DENSITY_KEY, 'compact')
    initSettingsStore()
    const store = useSettingsStore()
    expect(document.documentElement.style.getPropertyValue('--oas-color-primary')).toBe('#123456')
    expect(document.documentElement.style.getPropertyValue('--oas-radius-md')).toBe('9px')
    expect(document.documentElement.style.getPropertyValue('--app-font-scale')).toBe('1.0625')
    expect(document.documentElement.style.getPropertyValue('--oas-table-cell-padding-block')).toBe(
      '6px',
    )
    expect(store.radius).toBe(9)
  })

  it('未自定义圆角时不写 --oas-radius-md 内联值（回落主题默认）', () => {
    initSettingsStore()
    expect(useSettingsStore().radius).toBeNull()
    expect(document.documentElement.style.getPropertyValue('--oas-radius-md')).toBe('')
  })

  it('setColor 写当前主题分键并生效，另一主题键保持未设置', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setColor('#7c3aed')
    expect(localStorage.getItem(`${THEME_PREFIX}light`)).toBe('#7c3aed')
    expect(localStorage.getItem(`${THEME_PREFIX}dark`)).toBeNull()
    expect(document.documentElement.style.getPropertyValue('--oas-color-primary')).toBe('#7c3aed')
    expect(store.currentColor()).toBe('#7c3aed')
  })

  it('切主题后 syncTheme 按新主题换色（dark 未设置则移除内联值）', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setColor('#7c3aed')
    document.documentElement.dataset.theme = 'dark'
    store.syncTheme()
    expect(document.documentElement.style.getPropertyValue('--oas-color-primary')).toBe('')
    expect(localStorage.getItem(`${THEME_PREFIX}light`)).toBe('#7c3aed')
  })

  it('字号/密度/页签栏动作：状态、DOM、持久化三者一致', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setFontSize('xl')
    store.setDensity('large')
    store.setTabsBar(false)
    expect(localStorage.getItem(FONT_SIZE_KEY)).toBe('xl')
    expect(localStorage.getItem(DENSITY_KEY)).toBe('large')
    expect(localStorage.getItem(TABS_BAR_KEY)).toBe('false')
    expect(document.documentElement.style.getPropertyValue('--app-font-scale')).toBe('1.125')
    expect(document.documentElement.dataset.tabsBar).toBe('off')
  })

  it('表单呈现方式/每页条数动作写原键名', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setFormMode('dialog')
    store.setPageSize('20')
    expect(localStorage.getItem(FORM_MODE_KEY)).toBe('dialog')
    expect(localStorage.getItem(PAGE_SIZE_KEY)).toBe('20')
  })

  it('通知矩阵开关写 NOTIF 前缀键', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setNotif('orders.inapp', false)
    expect(localStorage.getItem(`${NOTIF_PREFIX}orders.inapp`)).toBe('false')
    expect(store.notifChecks['orders.inapp']).toBe(false)
  })

  it('主题编辑器 token：写入持久化为 JSON，清空后移除键', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setCustomToken('--oas-brand-x', '#112233')
    expect(JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY)!)).toEqual({
      '--oas-brand-x': '#112233',
    })
    store.setCustomToken('--oas-brand-x', '')
    expect(localStorage.getItem(CUSTOM_TOKENS_KEY)).toBeNull()
  })

  it('resetAppearance 清主题色双键/圆角/自定义 token 并移除对应内联样式', () => {
    initSettingsStore()
    const store = useSettingsStore()
    store.setColor('#7c3aed')
    store.setRadius(10)
    store.setCustomToken('--oas-brand-x', '#112233')
    store.resetAppearance()
    expect(localStorage.getItem(`${THEME_PREFIX}light`)).toBeNull()
    expect(localStorage.getItem(`${THEME_PREFIX}dark`)).toBeNull()
    expect(localStorage.getItem(RADIUS_KEY)).toBeNull()
    expect(localStorage.getItem(CUSTOM_TOKENS_KEY)).toBeNull()
    expect(store.radius).toBeNull()
    expect(document.documentElement.style.getPropertyValue('--oas-color-primary')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--oas-radius-md')).toBe('')
  })
})
