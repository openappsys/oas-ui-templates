import { expect, test } from '@playwright/test'

test('dbg sidebar spacing', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), { timeout: 120_000 })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
  const probe = await page.evaluate(() => {
    const sb = document.querySelector('oas-sidebar') as HTMLElement
    const sr = sb?.shadowRoot
    if (!sr) return { err: 'no shadow' }
    // 找「全部优先级」行和「刘洋」行的 icon/avatar/label 三元组
    const find = (text: string) => {
      const el = Array.from(sr.querySelectorAll('*')).find(
        (n) => n.children.length === 0 && (n.textContent ?? '').trim() === text,
      )
      if (!el) return null
      const item = el.closest('.item') ?? el.parentElement
      const kids = item
        ? Array.from(item.querySelectorAll('*'))
            .filter((n) => n.children.length === 0 || n.tagName === 'OAS-AVATAR')
            .slice(0, 4)
            .map((n) => {
              const r = n.getBoundingClientRect()
              const cs = getComputedStyle(n)
              return `${n.tagName}.${String(n.className).slice(0, 24)} w=${Math.round(r.width)} mr=${cs.marginRight} ml=${cs.marginLeft}`
            })
        : []
      return { itemClass: item?.className?.slice?.(0, 40), kids }
    }
    return {
      prio: find('全部优先级'),
      member: find('刘洋'),
      sidebarCs: (() => {
        const item = Array.from(sr.querySelectorAll('.item')).find((n) =>
          (n.textContent ?? '').includes('刘洋'),
        )
        if (!item) return null
        const cs = getComputedStyle(item)
        return { gap: cs.gap, display: cs.display }
      })(),
    }
  })
  console.log('SP=' + JSON.stringify(probe, null, 1))
})
