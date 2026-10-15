import { test } from '@playwright/test'

test('debug', async ({ page }) => {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 200))
  })
  await page.goto('/')
  await page.waitForTimeout(3000)
  const body = await page.evaluate(() => document.body.innerHTML.slice(0, 300))
  console.log('BODY=' + JSON.stringify(body))
  console.log('ERRS=' + JSON.stringify(errs, null, 1))
})
