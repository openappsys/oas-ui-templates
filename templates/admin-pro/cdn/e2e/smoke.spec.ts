import { expect, test } from '@playwright/test'
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
      return route.fulfill({ body: THEME_CSS, contentType: 'text/css' })
    return route.fulfill({ body: CDN_JS, contentType: 'application/javascript' })
  })
})

async function login(page: import('@playwright/test').Page): Promise<void> {
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
  await page.getByTestId('user-new').click()
  await page.getByTestId('uf-name').locator('input').fill('测试用户')
  await page.getByTestId('uf-email').locator('input').fill('test@example.com')
  await page.getByTestId('uf-save').click()
  await expect(page.getByTestId('users-table')).toContainText('测试用户')
})

test('form 空值提交触发必填校验且不跳转', async ({ page }) => {
  await login(page)
  await page.locator('#nav').getByText('基础表单').click()
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
  await expect(page).toHaveURL(/#\/form/)
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
  expect(await page.evaluate(() => localStorage.getItem('oas-admin-cdn.locale'))).toBe('en')
})
