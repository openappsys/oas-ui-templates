import { expect, test } from '@playwright/test'

test('dbg row metrics', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v3') === '1', {
    timeout: 30_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
  await page.waitForTimeout(1000)
  const r = await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el)
      const root = el.getRootNode()
      const kids = Array.from(el.children).map((k) => {
        const r = (k as HTMLElement).getBoundingClientRect()
        return `${(k as HTMLElement).className} ${Math.round(r.width)}px`
      })
      return {
        gtc: cs.gridTemplateColumns,
        rowW: Math.round(el.getBoundingClientRect().width),
        display: cs.display,
        rootType: root.constructor.name,
        hasStyle: !!((root as ShadowRoot).querySelector?.('style[data-issue-row]') ?? false),
        kids,
      }
    })
  console.log('ROW=' + JSON.stringify(r, null, 1))
})
