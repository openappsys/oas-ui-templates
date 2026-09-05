import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setLocale } from '../i18n'
import { useT } from './use-t'

// 渲染 fullname（中英同文案）+ nav.dashboard（随 locale 变化）+ 当前 locale 的演示组件
const Demo = defineComponent({
  setup() {
    const { t, locale } = useT()
    return () =>
      h('div', [
        h('span', { class: 'fullname' }, t('app.fullname')),
        h('span', { class: 'nav' }, t('nav.dashboard')),
        h('span', { class: 'locale' }, locale.value),
      ])
  },
})

describe('useT', () => {
  // 模块级共享 ref 在 import 时按初始 locale 创建，需先 useT() 建立订阅再 setLocale，
  // 否则 ref 收不到通知会保留过期值；afterEach 恢复 zh-CN 防跨用例污染
  beforeEach(() => {
    useT()
    setLocale('zh-CN')
  })
  afterEach(() => {
    setLocale('zh-CN')
  })

  it('挂载组件显示 t() 文案与当前 locale', () => {
    const wrapper = mount(Demo)
    expect(wrapper.get('.fullname').text()).toBe('OAS Admin Pro')
    expect(wrapper.get('.nav').text()).toBe('仪表盘')
    expect(wrapper.get('.locale').text()).toBe('zh-CN')
  })

  it('setLocale 驱动响应式更新：文案随 locale 切换', async () => {
    const wrapper = mount(Demo)
    setLocale('en')
    await nextTick()
    expect(wrapper.get('.nav').text()).toBe('Dashboard')
    expect(wrapper.get('.locale').text()).toBe('en')
    setLocale('zh-CN')
    await nextTick()
    expect(wrapper.get('.nav').text()).toBe('仪表盘')
  })

  it('多次调用共享同一响应式 locale 源', async () => {
    const a = useT()
    const b = useT()
    expect(a.locale).toBe(b.locale)
    setLocale('en')
    await nextTick()
    expect(a.locale.value).toBe('en')
    expect(b.locale.value).toBe('en')
  })

  it('返回的 setLocale 与 i18n setLocale 为同一函数', () => {
    const { setLocale: fromUseT, t } = useT()
    expect(fromUseT).toBe(setLocale)
    expect(typeof t).toBe('function')
  })
})
