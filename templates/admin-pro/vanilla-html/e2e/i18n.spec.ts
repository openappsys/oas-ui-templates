import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('切换语言：壳层标题与页脚即时变化', async ({ page }) => {
  await login(page)
  await page.goto('/#/dashboard')
  await expect(page).toHaveTitle(/仪表盘/)
  await expect(
    page.getByTestId('page-tabs').locator('[role="tab"]').filter({ hasText: '仪表盘' }),
  ).toBeVisible()
  await page.locator('#lang-toggle').click()
  await page.locator('#lang-menu').getByText('English', { exact: true }).click()
  await expect(page).toHaveTitle(/Dashboard/)
  await expect(page.locator('.app-foot')).toContainText('zero-framework')
  await expect(
    page.getByTestId('page-tabs').locator('[role="tab"]').filter({ hasText: 'Dashboard' }),
  ).toBeVisible()
  await expect(
    page.getByTestId('page-tabs').locator('[role="tab"]').filter({ hasText: '仪表盘' }),
  ).toHaveCount(0)
})

test.describe('入口语言：首次访问按浏览器语言嗅探', () => {
  test.use({ locale: 'en-US' })
  test('en-US 首次访问：<html lang> 与登录页文案均为英文', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h2.login-title')).toHaveText(/Welcome/i)
    await expect(page.evaluate(() => document.documentElement.lang)).resolves.toBe('en')
  })

  test('en-US 浏览器，localStorage 已存 zh-CN：saved 优先于嗅探', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('oas-admin.locale', 'zh-CN')
    })
    await page.goto('/')
    await expect(page.locator('h2.login-title')).toHaveText('欢迎回来')
    await expect(page.evaluate(() => document.documentElement.lang)).resolves.toBe('zh-CN')
  })
})

test.describe('入口语言：zh 浏览器默认中文', () => {
  test.use({ locale: 'zh-CN' })
  test('zh-CN 首次访问：登录页中文', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h2.login-title')).toHaveText('欢迎回来')
    await expect(page.evaluate(() => document.documentElement.lang)).resolves.toBe('zh-CN')
  })
})
