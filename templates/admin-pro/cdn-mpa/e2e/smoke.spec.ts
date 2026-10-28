import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, openNavItem } from './_helpers'

// unpkg 运行时引用 → 本地 node_modules 真实文件路径回填（离线稳定；i18n 语言包不能当 cdn.js 回填）
test.beforeEach(async ({ page }) => {
  mockOasRuntime(page)
})

test('登录 → dashboard 渲染统计卡与趋势图', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/dashboard\.html/)
  await expect(page.getByTestId('stat-visits')).toBeVisible()
  await expect(page.locator('#chart-trend svg .area-path')).toHaveCount(1)
})

test('users 表格渲染种子数据 + 弹窗新建入表', async ({ page }) => {
  await login(page)
  await openNavItem(page, '业务', '用户管理')
  await page.waitForURL(/users\.html/)
  await expect(page.getByTestId('users-table')).toContainText('张伟')
  await page.getByTestId('user-create').click()
  await page.getByTestId('field-name').locator('input').fill('测试用户')
  await page.getByTestId('field-email').locator('input').fill('test@example.com')
  await page.getByTestId('form-save').click()
  await expect(page.getByTestId('users-table')).toContainText('测试用户')
})

test('form 空值提交触发必填校验且不跳转', async ({ page }) => {
  await login(page)
  await openNavItem(page, '示例', '基础表单')
  await page.waitForURL(/form\.html/)
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
  await expect(page).toHaveURL(/form\.html/)
})

test('中英切换：点击后整页 reload 且壳层菜单变英文', async ({ page }) => {
  await login(page)
  await expect(page.locator('#nav')).toContainText('仪表盘')
  await page.getByTestId('lang-toggle').click()
  // MPA 切语言 = setLocale + reload；click 会等其触发的导航完成，后续 expect 的 web-first 重试兜底
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
  expect(await page.evaluate(() => localStorage.getItem('oas-admin-cdn-mpa.locale'))).toBe('en')
})

test.describe('首访语言嗅探', () => {
  test.use({ locale: 'en-US' })
  test('en-US 浏览器首访：<html lang> 与登录页均为英文', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h1')).toHaveText('Welcome back')
  })
})
