import { expect, test } from '@playwright/test'

test('dbg dynamic-tags', async ({ page }) => {
  test.setTimeout(90_000)
  const seen: string[] = []
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v4')), { timeout: 30_000 })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 45_000 })
  await page.locator('.issue-row').first().evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(2000)
  // 监听 oas-change 抓 detail 形态
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=label-add]')
    el?.addEventListener('oas-change', (e) => {
      const d = (e as CustomEvent).detail
      seen.push('detail=' + JSON.stringify(d) + ' type=' + typeof d)
    })
    ;(window as unknown as { __seen: string[] }).__seen = []
    ;(window as unknown as { __seen: string[] }).__seen = (
      window as unknown as { __seen: string[] }
    ).__seen
  })
  await page.locator('[data-testid=label-add]').locator('input').first().click()
  await page.keyboard.type('frontend')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const st = await page.evaluate(() => {
    const el = document.querySelector('[data-testid=label-add]') as unknown as {
      modelValue?: string[]
      value?: string[]
    }
    return {
      modelValue: el?.modelValue,
      value: el?.value,
      seen: (window as unknown as { __seen: string[] }).__seen,
      chip: !!document.querySelector('[data-testid=label-chip-frontend]'),
    }
  })
  console.log('DT=' + JSON.stringify(st))
})
