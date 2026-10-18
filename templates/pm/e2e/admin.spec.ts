import { expect, test, type Page } from '@playwright/test'

async function waitForSeed(page: Page) {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v5')), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

function statNumber(text: string | null): number {
  return Number(text?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') ?? 0)
}

test('A1 管理总览：入口 → 统计/工作量/健康度 → 行点击回项目 → 占位页签 → 返回工作台', async ({
  page,
}) => {
  await waitForSeed(page)

  await expect(page.getByTestId('admin-entry')).toBeVisible()
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await expect(page.getByTestId('side-panel')).toHaveCount(0)
  await expect(page.getByTestId('admin-tab-overview')).toBeVisible()

  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-issues').textContent()), {
      timeout: 30_000,
    })
    .toBeGreaterThan(60000)
  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-projects').textContent()))
    .toBe(2)
  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-members').textContent()))
    .toBe(8)
  await expect(page.getByTestId('admin-stat-done')).toContainText(/[1-9]/)

  await expect
    .poll(async () => {
      const d = await page.getByTestId('admin-chart-workload').getAttribute('data')
      return /"value":\d/.test(d ?? '') ? 1 : 0
    })
    .toBe(1)

  const rows = page.getByTestId('admin-table-health').locator('tbody tr')
  await expect
    .poll(
      async () =>
        page
          .getByTestId('admin-table-health')
          .evaluate((el) => ((el as { data?: unknown[] }).data ?? []).length),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0)
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
  const firstRowText = (await rows.first().textContent()) ?? ''
  const targetProject = firstRowText.includes('移动端 App') ? 'project-2' : 'project-1'
  await rows.first().click()
  await expect(page.getByTestId('admin-view')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await expect(page.getByTestId(`project-${targetProject}`)).toHaveClass(/is-active/)
  await expect(page.locator('.issue-row .issue-key').first()).toContainText(
    targetProject === 'project-2' ? 'APP-' : 'OAS-',
    { timeout: 10_000 },
  )

  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await page.getByTestId('admin-nav-members').click()
  await expect(page.getByTestId('admin-tab-members')).toBeVisible()
  await expect(page.getByTestId('admin-tab-members')).toContainText('本页签在后续任务实现')
  await page.getByTestId('admin-back').click()
  await expect(page.getByTestId('admin-view')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
})

test('A2 viewer 门禁：无管理入口', async ({ page }) => {
  await waitForSeed(page)
  await switchUser(page, 'member-4')
  await expect(page.getByTestId('admin-entry')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await switchUser(page, 'member-1')
})

test('A3 member 门禁：无管理入口', async ({ page }) => {
  await waitForSeed(page)
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-entry')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await switchUser(page, 'member-1')
})

test('A4 门禁回落：admin 视图内切身份为 member → 自动回工作台', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-view')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
  await switchUser(page, 'member-1')
})
