import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；本 spec 只验选择语义，5K 足够） */
const E2E_SEED_SIZE = 5_000

async function waitForSeed(page: Page) {
  test.setTimeout(240_000)
  await page.addInitScript(
    (n) => localStorage.setItem('oas-pm-seed-size', String(n)),
    E2E_SEED_SIZE,
  )
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 「已加载 N 条」的 N：表头全选的计数口径（窗口行数 ≠ 已加载数，虚拟列表只渲染可见行） */
async function loadedCount(page: Page): Promise<number> {
  const text = (await page.getByTestId('issue-total').textContent()) ?? ''
  return Number((text.match(/已加载\s*([\d,]+)/)?.[1] ?? '0').replace(/,/g, ''))
}

const selectAll = (page: Page) => page.getByTestId('select-all')
const bulkCount = (page: Page) => page.locator('.bulk-count')

test('B1 表头全选：选中全部已加载行，批量栏计数一致；再点取消清空', async ({ page }) => {
  await waitForSeed(page)
  const loaded = await loadedCount(page)
  expect(loaded).toBeGreaterThan(0)
  await expect(selectAll(page)).not.toHaveAttribute('checked', /.*/)

  await selectAll(page).click()
  await expect(page.getByTestId('bulk-bar')).toBeVisible({ timeout: 10_000 })
  await expect(bulkCount(page)).toHaveText(`已选 ${loaded}`)
  await expect(selectAll(page)).toHaveAttribute('checked', '')

  // 可见行勾选框全部跟随（虚拟列表只渲染窗口行）
  const rendered = await page.locator('.issue-row').count()
  expect(rendered).toBeGreaterThan(0)
  await expect(page.locator('.issue-row .row-check[checked]')).toHaveCount(rendered)

  // 再点：清空这批选择，批量栏收起
  await selectAll(page).click()
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0, { timeout: 10_000 })
  await expect(selectAll(page)).not.toHaveAttribute('checked', /.*/)
  await expect(page.locator('.issue-row .row-check[checked]')).toHaveCount(0)
})

test('B2 部分选中：表头显示半选（indeterminate + aria-checked=mixed）', async ({ page }) => {
  await waitForSeed(page)
  await page
    .locator('.issue-row .row-check')
    .first()
    .evaluate((el) => (el as HTMLInputElement).click())
  await expect(bulkCount(page)).toHaveText('已选 1')
  await expect(selectAll(page)).toHaveAttribute('indeterminate', '')
  // 组件把 indeterminate 同步到内部 input（视觉半选 + 读屏 mixed）
  await expect(selectAll(page).locator('input')).toHaveAttribute('aria-checked', 'mixed')

  // 半选态点击 = 补齐全选（不是取消）：批量栏计数落到已加载数
  const loaded = await loadedCount(page)
  await selectAll(page).click()
  await expect(bulkCount(page)).toHaveText(`已选 ${loaded}`)
  await expect(selectAll(page)).not.toHaveAttribute('indeterminate', /.*/)
})

test('B3 筛选后全选：只选当前已加载的过滤结果', async ({ page }) => {
  await waitForSeed(page)
  const before = await loadedCount(page)
  await page.getByTestId('side-list').locator('[data-value="status:done"]').click()
  await expect
    .poll(async () => page.locator('.issue-row .issue-status').allTextContents(), {
      timeout: 10_000,
    })
    .toEqual(expect.arrayContaining(['已完成']))
  const filtered = await loadedCount(page)
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThanOrEqual(before)

  await selectAll(page).click()
  await expect(bulkCount(page)).toHaveText(`已选 ${filtered}`)
  // 批量栏取消后回到未选中态
  await page.getByTestId('bulk-cancel').click()
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0, { timeout: 10_000 })
})
