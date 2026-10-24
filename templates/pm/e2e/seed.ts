import { expect, test, type Page } from '@playwright/test'

/** 共享种子等待：e2e 默认 5K + SEED_VER 标记 + 首屏行可见 */
export async function waitForSeed(page: Page, size = 5000) {
  test.setTimeout(120_000)
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), {
      timeout: 120_000,
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}
