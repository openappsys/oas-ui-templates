import { expect, test } from '@playwright/test'

test('M1 架构验证：100K issues seed + 渲染', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(3000)
  await expect(page.getByTestId('titlebar')).toBeVisible()
  await expect(page.locator('.issue-row').first()).toBeVisible()
  const count = await page.locator('.issue-row').count()
  console.log('VISIBLE_ROWS=' + count)
  await page.screenshot({ path: 'test-results/pm-100k.png' })
})
