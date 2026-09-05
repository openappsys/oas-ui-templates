import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n'
import { useT } from './use-t'

function Probe() {
  const { t, locale } = useT()
  return (
    <div>
      <span data-testid="fullname">{t('app.fullname')}</span>
      <span data-testid="dashboard">{t('nav.dashboard')}</span>
      <span data-testid="locale">{locale}</span>
    </div>
  )
}

describe('useT', () => {
  beforeEach(() => setLocale('zh-CN'))
  // 恢复 locale，避免污染其他测试文件；vitest 未开 globals，需手动 cleanup
  afterEach(() => {
    cleanup()
    setLocale('zh-CN')
  })

  it('默认渲染中文文案与当前 locale', () => {
    render(<Probe />)
    expect(screen.getByTestId('fullname').textContent).toBe('OAS Admin Pro')
    expect(screen.getByTestId('dashboard').textContent).toBe('仪表盘')
    expect(screen.getByTestId('locale').textContent).toBe('zh-CN')
  })

  it('setLocale 切换后组件重渲染为对应语言', () => {
    render(<Probe />)
    act(() => setLocale('en'))
    expect(screen.getByTestId('dashboard').textContent).toBe('Dashboard')
    expect(screen.getByTestId('locale').textContent).toBe('en')
    act(() => setLocale('zh-CN'))
    expect(screen.getByTestId('dashboard').textContent).toBe('仪表盘')
    expect(screen.getByTestId('locale').textContent).toBe('zh-CN')
  })
})
