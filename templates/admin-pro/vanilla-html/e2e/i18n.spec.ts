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
