import { expect, test } from '@playwright/test'

test('dbg prod build boot', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 500)))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errors.push('[' + m.type() + '] ' + m.text().slice(0, 300))
  })
  await page.goto('/')
  await page.waitForTimeout(8000)
  const st = await page.evaluate(() => ({
    appHTML: (document.querySelector('#app')?.innerHTML ?? '').slice(0, 150),
    hasToolbar: !!document.querySelector('[data-testid=pm-toolbar]'),
    rows: document.querySelectorAll('.issue-row').length,
  }))
  console.log('BOOT=' + JSON.stringify(st))
  console.log('ERRORS=' + JSON.stringify(errors.slice(0, 6)))
  await page.screenshot({ path: 'test-results/prod-boot.png', fullPage: false })
})
