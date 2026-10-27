import { expect, test } from '@playwright/test'

test('dbg icon span', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), { timeout: 120_000 })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
  const r = await page.evaluate(() => {
    const sb = document.querySelector('oas-sidebar') as HTMLElement
    const sr = sb?.shadowRoot
    if (!sr) return { err: 'no shadow' }
    const label = Array.from(sr.querySelectorAll('.label')).find(
      (n) => (n.textContent ?? '').trim() === '刘洋',
    )
    if (!label) return { err: 'no label' }
    const item = label.closest('.item')
    const av = item?.querySelector('.item-avatar')
    const icon = item?.querySelector('.icon')
    return {
      avatarHTML: av?.outerHTML.slice(0, 200) ?? null,
      iconHTML: icon?.outerHTML.slice(0, 200) ?? null,
    }
  })
  console.log('IC=' + JSON.stringify(r))
})
