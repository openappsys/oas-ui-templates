import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initI18n, t, setLocale, currentLocale, onLocaleChange } from './index'

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
