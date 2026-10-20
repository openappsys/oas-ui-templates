import { expect, test, type Page } from '@playwright/test'

async function waitForSeed(page: Page) {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v7')), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

test('S1 多组独立高亮：项目/视图/状态各组 active 互不干扰', async ({ page }) => {
  await waitForSeed(page)
  await expect(sideRow(page, 'OAS 平台')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '移动端 App')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, '全部 Issues')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '我的（张伟）')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, '全部')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '待规划')).toHaveAttribute('aria-pressed', 'false')

  await sideRow(page, '已完成').click()
  await expect(sideRow(page, '已完成')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '全部')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, 'OAS 平台')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '全部 Issues')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S2 成员 toggle：点击设置负责人筛选，再点清除', async ({ page }) => {
  await waitForSeed(page)
  const li = sideRow(page, '李娜')
  await expect(li).toHaveAttribute('aria-pressed', 'false')
  await li.click()
  await expect(li).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '张伟')).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(() =>
      page.locator('.issue-row oas-avatar').evaluateAll((els) => {
        const titles = els.map((e) => e.getAttribute('title') ?? '')
        return titles.length > 0 && titles.every((t) => t === '李娜')
      }),
    )
    .toBe(true)
  await li.click()
  await expect(li).toHaveAttribute('aria-pressed', 'false')
})

test('S3 保存的视图：点击行应用筛选，删除动作不触发行选择', async ({ page }) => {
  await waitForSeed(page)
  await sideRow(page, '待规划').click()
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('待规划', {
    timeout: 10_000,
  })

  await page.getByTestId('save-view-btn').click()
  await expect(page.getByTestId('modal-save-view')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.getByTestId('save-view-name').locator('input').fill('S3 视图')
  await page.getByTestId('save-view-ok').click()
  await expect(page.getByTestId('modal-save-view')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(sideRow(page, 'S3 视图')).toBeVisible({ timeout: 10_000 })

  await sideRow(page, '全部').click()
  await expect(sideRow(page, '全部')).toHaveAttribute('aria-pressed', 'true')

  await sideRow(page, 'S3 视图').click()
  await expect(sideRow(page, '待规划')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('待规划', {
    timeout: 10_000,
  })

  await sideRow(page, '全部').click()
  await expect(sideRow(page, '全部')).toHaveAttribute('aria-pressed', 'true')
  const sv = sideRow(page, 'S3 视图')
  await sv.hover()
  await sideRow(page, '删除视图 S3 视图').click()
  await expect(sideRow(page, 'S3 视图')).toHaveCount(0, { timeout: 10_000 })
  await expect(sideRow(page, '全部')).toHaveAttribute('aria-pressed', 'true')
})

test('S4 折叠 rail：56px 收窄、项目/成员行存活、badge 角标，再展开恢复', async ({ page }) => {
  await waitForSeed(page)
  const sidebar = page.getByTestId('side-list')
  const panel = page.getByTestId('side-panel')
  const toggle = sidebar.locator('[part="toggle"]')
  await expect(toggle).toBeVisible()
  const barWidth = () => sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const panelWidth = () => panel.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  await expect.poll(barWidth).toBe(220)

  await toggle.click()
  await expect(sidebar).toHaveAttribute('collapsed', '')
  await expect.poll(barWidth).toBe(56)
  await expect.poll(panelWidth).toBe(72)

  await expect(sideRow(page, 'OAS 平台')).toBeVisible()
  await expect(sideRow(page, '全部 Issues')).toBeVisible()
  await expect(sideRow(page, '全部')).toBeVisible()
  await expect(sideRow(page, '李娜')).toBeVisible()
  await expect(sidebar.locator('[part="badge"]').first()).toBeVisible()

  await toggle.click()
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await expect.poll(barWidth).toBe(220)

  await sideRow(page, '已完成').click()
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S5 Ctrl+B 快捷键切换 collapsed', async ({ page }) => {
  await waitForSeed(page)
  const sidebar = page.getByTestId('side-list')
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await page.keyboard.press('Control+b')
  await expect(sidebar).toHaveAttribute('collapsed', '')
  await page.keyboard.press('Control+b')
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
})
