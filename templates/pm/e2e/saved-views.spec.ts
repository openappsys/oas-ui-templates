import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；与其他用例同口径） */
const E2E_SEED_SIZE = 5_000

/** seed v10 预置的示例保存视图（名称中英并列，见 src/lib/saved-views.ts） */
const MY_VIEW = '我的进行中'
const HIGH_VIEW = '高优先级待办'
/** 下拉按创建时间倒序：高优先级视图更晚创建，排在前面 */
const SEEDED_ORDER = [HIGH_VIEW, MY_VIEW]

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  test.setTimeout(240_000)
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  // seed 完成的确定性信号：SEED_VER 标记写入（播完才 set）
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** 按分组 data-value 精确定位行（不依赖行文案） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

const savedSelect = (page: Page) => page.getByTestId('saved-view-select')

/** 下拉的选项文案（options 走 property 通道，由宿主 OSelect 的 effect 写入） */
const optionLabels = (page: Page) =>
  savedSelect(page).evaluate((el) =>
    ((el as unknown as { options?: Array<{ label: string }> }).options ?? []).map((o) => o.label),
  )

/** 真实点击路径：展开 → 点选项（下拉选中后自动收起） */
async function pickSavedView(page: Page, label: string) {
  await savedSelect(page).locator('button.trigger').click()
  await expect(savedSelect(page).locator('.dropdown')).toHaveClass(/open/, { timeout: 5000 })
  await savedSelect(page).locator('.option').filter({ hasText: label }).first().click()
  await expect(savedSelect(page).locator('.dropdown')).not.toHaveClass(/open/, { timeout: 5000 })
}

/** 列表行某列的类名（st-inside / pri-urgent）：用于断言筛选收敛，不依赖语言文案 */
const rowClasses = (page: Page, sel: string, prefix: string) =>
  page
    .locator(sel)
    .evaluateAll(
      (els, p) => els.map((el) => [...el.classList].find((c) => c.startsWith(p)) ?? ''),
      prefix,
    )

/** 行全满足：行数 > 0 且该列类名都在允许集内（列表窗口异步更新 → poll） */
async function expectAllRows(page: Page, sel: string, prefix: string, allowed: string[]) {
  await expect
    .poll(
      async () => {
        const cs = await rowClasses(page, sel, prefix)
        return cs.length > 0 && cs.every((c) => allowed.includes(c))
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}

test('保存视图：seed 预置 2 项 → 下拉应用两种视图 → 保存/删除往返 → 清空后禁用', async ({
  page,
}) => {
  await waitForSeed(page)

  // 1) seed 预置：工具条下拉与侧栏组各有两项（下拉按创建时间倒序）
  await expect.poll(() => optionLabels(page)).toEqual(SEEDED_ORDER)
  await expect(sideRow(page, MY_VIEW)).toBeVisible({ timeout: 10_000 })
  await expect(sideRow(page, HIGH_VIEW)).toBeVisible()
  // 展开后选项渲染为可点的行（真实点击路径可发现入口）
  await savedSelect(page).locator('button.trigger').click()
  await expect(savedSelect(page).locator('.dropdown')).toHaveClass(/open/, { timeout: 5000 })
  await expect(savedSelect(page).locator('.option')).toHaveCount(2)
  await page.locator('.issue-header h1').click()
  await expect(savedSelect(page).locator('.dropdown')).not.toHaveClass(/open/, { timeout: 5000 })

  // 2) 应用「我的进行中」：myOnly + 进行中，侧栏状态组与「我的」同步高亮，控件回到占位
  await pickSavedView(page, MY_VIEW)
  await expect(sideItem(page, 'status:in_progress')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'view:my')).toHaveAttribute('aria-pressed', 'true')
  await expectAllRows(page, '.issue-row .issue-status', 'st-', ['st-in_progress'])
  await expect(savedSelect(page).locator('button.trigger')).toContainText('已保存视图')

  // 3) 应用「高优先级待办」：紧急+高 × 待办+积压，侧栏两组同步（组内 OR、组间 AND）
  await pickSavedView(page, HIGH_VIEW)
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:high')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'status:todo')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'view:all')).toHaveAttribute('aria-pressed', 'true')
  await expectAllRows(page, '.issue-row .issue-priority', 'pri-', ['pri-urgent', 'pri-high'])
  await expectAllRows(page, '.issue-row .issue-status', 'st-', ['st-todo', 'st-backlog'])
  await expect(savedSelect(page).locator('button.trigger')).toContainText('已保存视图')

  // 4) 保存新视图 → 下拉 3 项，新视图（创建时间最新）排第一
  await page.getByTestId('save-view-btn').click()
  await expect(page.getByTestId('modal-save-view')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.getByTestId('save-view-name').locator('input').fill('E2E 下拉视图')
  await page.getByTestId('save-view-ok').click()
  await expect(page.getByTestId('modal-save-view')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect.poll(() => optionLabels(page)).toEqual(['E2E 下拉视图', ...SEEDED_ORDER])

  // 5) 侧栏删除该视图 → 下拉回 2 项（侧栏与下拉同源）
  const created = sideRow(page, 'E2E 下拉视图')
  await expect(created).toBeVisible({ timeout: 10_000 })
  await created.hover()
  await sideRow(page, '删除视图 E2E 下拉视图').click()
  await expect(sideRow(page, 'E2E 下拉视图')).toHaveCount(0, { timeout: 10_000 })
  await expect.poll(() => optionLabels(page)).toEqual(SEEDED_ORDER)

  // 6) 清空到零：控件禁用 + 悬停提示 + 空态占位（不再显示「已保存视图」诱导点击）
  for (const name of SEEDED_ORDER) {
    const row = sideRow(page, name)
    await row.hover()
    await sideRow(page, `删除视图 ${name}`).click()
    await expect(sideRow(page, name)).toHaveCount(0, { timeout: 10_000 })
  }
  await expect(savedSelect(page)).toHaveAttribute('disabled', '')
  await expect(savedSelect(page)).toHaveAttribute('title', '先保存一个视图')
  await expect(savedSelect(page).locator('button.trigger')).toContainText('暂无保存的视图')
})
