import { expect, test } from '@playwright/test'

test('dbg app boot v4', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 400)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[cerr] ' + m.text().slice(0, 400))
  })
  await page.goto('/')
  await page.waitForTimeout(20000)
  await page.screenshot({ path: 'test-results/boot-v4.png', fullPage: false })
  const st = await page.evaluate(() => {
    const vl = document.querySelector('oas-virtual-list') as unknown as {
      items?: unknown[]
      shadowRoot?: ShadowRoot
    }
    return {
      seedV4: localStorage.getItem('oas-pm-seed-v4'),
      hasToolbar: !!document.querySelector('[data-testid=pm-toolbar]'),
      rows: document.querySelectorAll('.issue-row').length,
      rowsInShadow: vl?.shadowRoot?.querySelectorAll('.issue-row').length ?? -1,
      vlItems: (vl?.items ?? []).length,
      total: document.querySelector('[data-testid=issue-total]')?.textContent ?? '',
    }
  })
  console.log('BOOT=' + JSON.stringify(st))
  console.log('ERRORS=' + JSON.stringify(errors.slice(0, 4)))
})
