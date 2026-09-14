import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CDN_JS = readFileSync(join(import.meta.dirname, '../node_modules/@oas-ui/ui/dist/cdn.js'))
const THEME_CSS = readFileSync(join(import.meta.dirname, '../node_modules/@oas-ui/theme/index.css'))

// unpkg 运行时引用 → 本地 node_modules 副本（离线稳定）
// 必须显式 contentType：string body 默认 text/html，<link rel=stylesheet> 严格 MIME 检查会被静默拦截
test.beforeEach(async ({ page }) => {
  await page.route('**unpkg.com/@oas-ui/**', (route) => {
    const url = route.request().url()
    if (url.endsWith('.css'))
      return route.fulfill({ body: THEME_CSS, contentType: 'text/css; charset=utf-8' })
    return route.fulfill({ body: CDN_JS, contentType: 'application/javascript; charset=utf-8' })
  })
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
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page.getByTestId('users-table')).toContainText('张伟')
  await page.getByTestId('user-create').click()
  await page.getByTestId('field-name').locator('input').fill('测试用户')
  await page.getByTestId('field-email').locator('input').fill('test@example.com')
  await page.getByTestId('form-save').click()
  await expect(page.getByTestId('users-table')).toContainText('测试用户')
})

test('form 三步向导：空值下一步拦截且不跳转', async ({ page }) => {
  await login(page)
  await page.locator('#nav').getByText('创建订单').click()
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
