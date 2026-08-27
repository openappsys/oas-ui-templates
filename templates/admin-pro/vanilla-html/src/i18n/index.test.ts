import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectLocale, initI18n, t, setLocale, currentLocale, onLocaleChange } from './index'

describe('i18n adapter', () => {
  beforeEach(() => {
    localStorage.clear()
    currentLocale() // ensure inited
    setLocale('zh-CN')
  })

  it('currentLocale 返回已设 locale', () => {
    expect(currentLocale()).toBe('zh-CN')
  })

  it('t() 解析 app 文案，未知 key 回退 key 本身', () => {
    expect(t('nav.dashboard')).toBe('仪表盘')
    expect(t('app.no.such.key')).toBe('app.no.such.key')
  })

  it('组件内置 key 同源可译', () => {
    setLocale('en')
    expect(t('modal.cancel')).toBe('Cancel')
    setLocale('zh-CN')
    expect(t('modal.cancel')).toBe('取消')
  })

  it('params 插值', () => {
    expect(t('users.editUser', { id: 7 })).toBe('编辑用户 #7')
  })

  it('setLocale 持久化 + 订阅回调 + html.lang', () => {
    const fn = vi.fn()
    const off = onLocaleChange(fn)
    setLocale('en')
    expect(localStorage.getItem('oas-admin.locale')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(fn).toHaveBeenCalledWith('en')
    expect(t('nav.dashboard')).toBe('Dashboard')
    off()
  })

  it('zh 与 en 的 app 字典 key 集合一致（防漏翻）', async () => {
    const [zh, en] = await Promise.all([import('./app-zh'), import('./app-en')])
    expect(Object.keys(zh.default).sort()).toEqual(Object.keys(en.default).sort())
  })
})

describe('detectLocale', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function setNav(lang: string): void {
    Object.defineProperty(window.navigator, 'language', { configurable: true, value: lang })
  }

  it('saved=zh-CN 优先于 navigator', () => {
    localStorage.setItem('oas-admin.locale', 'zh-CN')
    setNav('en-US')
    expect(detectLocale()).toBe('zh-CN')
  })

  it('saved=en 优先于 navigator', () => {
    localStorage.setItem('oas-admin.locale', 'en')
    setNav('zh-CN')
    expect(detectLocale()).toBe('en')
  })

  it('无 saved 时 zh 系列 → zh-CN', () => {
    setNav('zh-CN')
    expect(detectLocale()).toBe('zh-CN')
    setNav('zh-TW')
    expect(detectLocale()).toBe('zh-CN')
    setNav('zh')
    expect(detectLocale()).toBe('zh-CN')
  })

  it('无 saved 时 en 系列 → en', () => {
    setNav('en-US')
    expect(detectLocale()).toBe('en')
    setNav('en')
    expect(detectLocale()).toBe('en')
  })

  it('无 saved 且非 zh/en 时默认 zh-CN', () => {
    setNav('ja-JP')
    expect(detectLocale()).toBe('zh-CN')
  })

  it('saved 为非法值按无 saved 处理', () => {
    localStorage.setItem('oas-admin.locale', 'fr-FR')
    setNav('en-US')
    expect(detectLocale()).toBe('en')
  })
})
