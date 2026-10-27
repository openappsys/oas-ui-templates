import { expect, test } from '@playwright/test'

test('dbg icon metrics 2.6.1', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), { timeout: 120_000 })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
  const r = await page.evaluate(() => {
    const sr = (document.querySelector('oas-sidebar') as HTMLElement)?.shadowRoot
    if (!sr) return { err: 'no shadow' }
    const label = Array.from(sr.querySelectorAll('.label')).find(
      (n) => (n.textContent ?? '').trim() === '刘洋',
    )
    const item = label?.closest('.item')
    const icon = item?.querySelector('.icon')
    const cs = icon ? getComputedStyle(icon) : null
    const prioItem = Array.from(sr.querySelectorAll('.item')).find((n) =>
      (n.textContent ?? '').includes('全部优先级'),
    )
    const prioIcon = prioItem?.querySelector('.icon')
    const prioCs = prioIcon ? getComputedStyle(prioIcon) : null
    return {
      memberIcon: cs
        ? {
            w: cs.width,
            display: cs.display,
            hidden: (icon as HTMLElement).hidden,
            visibility: cs.visibility,
          }
        : null,
      prioIcon: prioCs ? { w: prioCs.width, display: prioCs.display } : null,
      uiVersion: 'npm @oas-ui/ui 2.6.1',
    }
  })
  console.log('METRICS=' + JSON.stringify(r, null, 1))
})
