import { test } from '@playwright/test'

test('long wait', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(5000)
    const count = await page.locator('.issue-row').count()
    console.log(`t=${i * 5}s rows=${count}`)
    if (count > 0) break
  }
  await page.screenshot({ path: 'test-results/pm-100k.png' })
})
