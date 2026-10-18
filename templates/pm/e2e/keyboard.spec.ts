import { expect, test, type Page } from '@playwright/test'

async function waitForSeed(page: Page) {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v4')), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

test('K1 j/k 光标导航：无初始光标 → j 首行 → j 次行 → k 回首行', async ({ page }) => {
  await waitForSeed(page)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(0)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(1)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').nth(1)).toHaveClass(/is-cursor/)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(1)
  await page.keyboard.press('k')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(1)
})

test('K2 Enter 打开光标行详情抽屉 + Esc 关闭', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await page.keyboard.press('Enter')
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-drawer]') as { opened?: boolean })
              ?.opened ?? false,
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })
})

test('K3 x 多选切换：bulk-bar 出现/消失（admin 默认身份）', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await page.keyboard.press('x')
  await expect(page.getByTestId('bulk-bar')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('bulk-bar')).toContainText('已选 1')
  await page.keyboard.press('x')
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0, { timeout: 5000 })
})

test('K4 ? 快捷键帮助：打开 + Esc 关闭且抽屉状态不受影响', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcuts-help')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(page.locator('.shortcuts-body .shortcut-row')).toHaveCount(8)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcuts-help')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0)
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcuts-help')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
})

test('K5 输入守卫：搜索框聚焦时 j 不移动光标', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('toolbar-search').click()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-testid=toolbar-search]')
        const ae = document.activeElement
        if (ae === host) return true
        return !!ae && !!host?.shadowRoot && ae.getRootNode() === host.shadowRoot
      }),
    )
    .toBe(true)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(0)
  await page.locator('.issue-thead').click()
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
})
