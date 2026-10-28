import { expect, test, type Page } from '@playwright/test'
import { mockCdnRuntime, openNavItem } from './helpers'

// unpkg 运行时引用 → 本地 node_modules 产物（离线稳定；path 形式按真实文件回填，
// i18n 语言包不能当 cdn.js 回填）。显式 contentType 由 path 形式按扩展名推断。
test.beforeEach(async ({ page }) => {
  await mockCdnRuntime(page)
})

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('登录 → dashboard 渲染统计卡与趋势图', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(page.getByTestId('stat-visits')).toBeVisible()
  await expect(page.locator('#chart-trend svg .area-path')).toHaveCount(1)
})

test('users 表格渲染种子数据 + 弹窗新建入表', async ({ page }) => {
  await login(page)
  await openNavItem(page, '业务', '用户管理')
  await expect(page.getByTestId('users-table')).toContainText('张伟')
  await page.getByTestId('user-create').click()
  await page.getByTestId('field-name').locator('input').fill('测试用户')
  await page.getByTestId('field-email').locator('input').fill('test@example.com')
  await page.getByTestId('form-save').click()
  await expect(page.getByTestId('users-table')).toContainText('测试用户')
})

test('form 三步向导：空值下一步拦截且不跳转', async ({ page }) => {
  await login(page)
  await openNavItem(page, '业务', '创建订单')
  await expect(page.getByTestId('form-steps')).toBeVisible()
  await page.getByTestId('form-next').click()
  await expect(page.getByTestId('form-error-customer')).toContainText('请输入客户名称')
  await expect(page.getByTestId('form-error-phone')).toContainText('请输入手机号')
  await expect(page).toHaveURL(/#\/form/)
  await expect(page.getByTestId('form-step1')).toBeVisible()
})

test('中英切换：壳层标题与菜单即时变化', async ({ page }) => {
  await login(page)
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await expect(page.locator('#nav')).not.toContainText('仪表盘')
})

test('刷新后语言保持（localStorage 生效）', async ({ page }) => {
  await login(page)
  await page.getByTestId('lang-toggle').click()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await page.reload()
  await expect(page.locator('#nav')).toContainText('Dashboard')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate(() => localStorage.getItem('oas-admin-cdn.locale'))).toBe('en')
})

test.describe('首访语言嗅探', () => {
  test.use({ locale: 'en-US' })
  test('en-US 浏览器首访：<html lang> 与登录页均为英文', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h1')).toHaveText('Welcome back')
  })
})
