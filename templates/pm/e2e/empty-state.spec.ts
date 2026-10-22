import { expect, test, type Page } from '@playwright/test'

async function fillOInput(page: Page, testid: string, text: string) {
  await page.evaluate(
    ([tid, val]) => {
      const host = document.querySelector(`[data-testid="${tid}"]`)
      const inner =
        (host?.shadowRoot?.querySelector('input, textarea') as HTMLInputElement) ??
        (host as HTMLInputElement)
      inner.value = val as string
      host?.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: val } }))
    },
    [testid, text],
  )
}

test('空态语义：搜索无结果 → 无匹配 Issue；清除筛选 → 空态消失', async ({ page }) => {
  // 高负载下 100K 播种可能超 100s：轮询与用例预算统一留余量
  test.setTimeout(240_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v8')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })

  await fillOInput(page, 'toolbar-search', 'zzzz不存在')
  await expect(page.getByTestId('issues-empty')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('issues-empty')).toHaveAttribute('description', '无匹配 Issue')

  await page.getByTestId('filter-clear').click()
  await expect(page.getByTestId('issues-empty')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
})
