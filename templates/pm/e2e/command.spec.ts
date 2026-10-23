import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  // 预算沿用 10 万口径（M1 仍跑 10 万，其余 5K）：轮询与用例预算统一留足
  test.setTimeout(240_000)
  // 播种规模：e2e 默认 5K（产品默认仍 10 万）。每个用例都是新上下文、都要重播种子，
  // 10 万条实测 44–134s（随负载波动），会撞穿用例预算 → 轮换式 seed 超时
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)

  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v9')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

function readItems(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid=command-palette]') as unknown as {
      items?: Array<{ label: string; value: string }>
    }
    return el.items ?? []
  })
}

test('C1 Ctrl+K 与顶栏按钮都能打开命令面板', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('command-open').click()
  // 高负载下（并行 worker + 种子播种）命令面板首开可能迟滞，等待放宽到 15s
  await expect(page.getByTestId('command-palette')).toHaveAttribute('open', /.*/, {
    timeout: 15_000,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-palette')).not.toHaveAttribute('open', /.*/, {
    timeout: 15_000,
  })
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toHaveAttribute('open', /.*/, {
    timeout: 15_000,
  })
})

test('C2 Issue 搜索：输入关键字 → Enter 打开详情抽屉', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toHaveAttribute('open', /.*/)
  await page.keyboard.type('1001')
  await expect
    .poll(async () => (await readItems(page)).some((i) => i.value === 'issue:issue-project-1-1001'))
    .toBe(true)
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
  await expect(page.locator('.detail-title')).toContainText('#1001')
})

test('C3 导航：搜索看板 → Enter 切换看板视图', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toHaveAttribute('open', /.*/)
  await page.keyboard.type('看板')
  await expect
    .poll(async () => (await readItems(page)).some((i) => i.value === 'nav:board'))
    .toBe(true)
  await page.keyboard.press('Enter')
  // 不再「盲按第二次 Enter」：面板已关闭时再按不会重试导航，只会把真实失败拖成 15s 超时
  await expect(page.getByTestId('board')).toBeVisible({ timeout: 10_000 })
})

test('C4 Esc 关闭命令面板', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toHaveAttribute('open', /.*/, {
    timeout: 5000,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-palette')).not.toHaveAttribute('open', /.*/, {
    timeout: 5000,
  })
})

test('C5 viewer 身份不出现新建/保存视图命令', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('pick-user-member-4').click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toHaveAttribute('open', /.*/, {
    timeout: 5000,
  })
  const items = await readItems(page)
  expect(items.some((i) => i.value === 'act:new-issue')).toBe(false)
  expect(items.some((i) => i.value === 'act:save-view')).toBe(false)
  expect(items.some((i) => i.value === 'nav:dashboard')).toBe(true)
})
