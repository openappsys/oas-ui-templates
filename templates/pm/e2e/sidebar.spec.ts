import { expect, test, type Page } from '@playwright/test'

async function waitForSeed(page: Page) {
  // 高负载下 100K 播种可能超 100s：轮询与用例预算统一留余量
  test.setTimeout(240_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v7')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** 按分组 data-value 精确定位行：「全部」在状态组与优先级组同名，role/name 会撞车 */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** 列表渲染行的状态文案集合 */
const rowStatuses = (page: Page) => page.locator('.issue-row .issue-status').allTextContents()

test('S1 多组独立高亮：项目/视图/状态各组 active 互不干扰', async ({ page }) => {
  await waitForSeed(page)
  await expect(sideRow(page, 'OAS 平台')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '移动端 App')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, '全部 Issues')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '我的（张伟）')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')

  await sideRow(page, '已完成').click()
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, 'OAS 平台')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '全部 Issues')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S2 状态多选：组内 OR 并集，再点取消，「全部」清空', async ({ page }) => {
  await waitForSeed(page)
  await sideRow(page, '待规划').click()
  await sideRow(page, '已完成').click()
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'false')
  // 并集：渲染行只含这两种状态
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && st.every((s) => s === '待规划' || s === '已完成')
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 再点一次取消该值，仅剩另一态
  await sideRow(page, '已完成').click()
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && st.every((s) => s === '待规划')
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 全部：清空该组，回到全量
  await sideItem(page, 'status:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && new Set(st).size > 1
      },
      { timeout: 10_000 },
    )
    .toBe(true)
})

test('S3 成员多选 toggle：点两行取并集，再点清除', async ({ page }) => {
  await waitForSeed(page)
  const li = sideRow(page, '李娜')
  await expect(li).toHaveAttribute('aria-pressed', 'false')
  await li.click()
  await expect(li).toHaveAttribute('aria-pressed', 'true')
  const zhang = sideRow(page, '张伟')
  await zhang.click()
  await expect(zhang).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page.locator('.issue-row oas-avatar').evaluateAll((els) => {
        const names = els.map((e) => e.getAttribute('title') ?? '')
        return names.length > 0 && names.every((t) => t === '李娜' || t === '张伟')
      }),
    )
    .toBe(true)

  await li.click()
  await expect(li).toHaveAttribute('aria-pressed', 'false')
  await expect(zhang).toHaveAttribute('aria-pressed', 'true')
  await zhang.click()
  await expect(zhang).toHaveAttribute('aria-pressed', 'false')
})

test('S4 优先级组多选：紧急+高 并集，全部清空', async ({ page }) => {
  await waitForSeed(page)
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  await sideRow(page, '紧急').click()
  await sideRow(page, '高').click()
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:high')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'false')
  // 列表行优先级徽章只含 urgent/high（行 class 为 pri-<priority>）
  await expect
    .poll(
      async () =>
        page
          .locator('.issue-row .issue-priority')
          .evaluateAll(
            (els) =>
              els.length > 0 &&
              els.every((el) => ['pri-urgent', 'pri-high'].some((c) => el.classList.contains(c))),
          ),
      { timeout: 10_000 },
    )
    .toBe(true)

  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'false')
})

test('S5 保存的视图：多选筛选存读（点击行应用，删除动作不触发行选择）', async ({ page }) => {
  await waitForSeed(page)
  await sideRow(page, '待规划').click()
  await sideRow(page, '已完成').click()
  await sideRow(page, '紧急').click()

  await page.getByTestId('save-view-btn').click()
  await expect(page.getByTestId('modal-save-view')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.getByTestId('save-view-name').locator('input').fill('S5 视图')
  await page.getByTestId('save-view-ok').click()
  await expect(page.getByTestId('modal-save-view')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(sideRow(page, 'S5 视图')).toBeVisible({ timeout: 10_000 })

  await sideItem(page, 'status:all').click()
  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')

  await sideRow(page, 'S5 视图').click()
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')

  await sideItem(page, 'status:all').click()
  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  const sv = sideRow(page, 'S5 视图')
  await sv.hover()
  await sideRow(page, '删除视图 S5 视图').click()
  await expect(sideRow(page, 'S5 视图')).toHaveCount(0, { timeout: 10_000 })
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
})

test('S6 折叠 rail：56px 收窄、项目/成员行存活、badge 角标，再展开恢复', async ({ page }) => {
  await waitForSeed(page)
  const sidebar = page.getByTestId('side-list')
  const panel = page.getByTestId('side-panel')
  const toggle = sidebar.locator('[part="toggle"]')
  await expect(toggle).toBeVisible()
  // 成员行头像：展开态可见；折叠态行仍存活且头像不被宿主样式藏掉（上游折叠保留 avatar 项）
  const memberAvatar = sidebar.locator(
    '[part="item"][data-value="member:member-2"] [part="avatar"]',
  )
  await expect(memberAvatar).toBeVisible()
  // 成员行只有头像、不再挂 user icon（宿主 workaround 已摘除；上游给无 icon 行留 hidden 占位）
  await expect(sidebar.locator('[part="item"][data-value="member:member-2"] .icon')).toBeHidden()
  const barWidth = () => sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const panelWidth = () => panel.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  await expect.poll(barWidth).toBe(220)

  await toggle.click()
  await expect(sidebar).toHaveAttribute('collapsed', '')
  await expect.poll(barWidth).toBe(56)
  await expect.poll(panelWidth).toBe(72)

  await expect(sideRow(page, 'OAS 平台')).toBeVisible()
  await expect(sideRow(page, '全部 Issues')).toBeVisible()
  await expect(sideItem(page, 'status:all')).toBeVisible()
  await expect(sideRow(page, '李娜')).toBeVisible()
  await expect(memberAvatar).toBeVisible()
  await expect(sidebar.locator('[part="badge"]').first()).toBeVisible()

  await toggle.click()
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await expect.poll(barWidth).toBe(220)

  await sideRow(page, '已完成').click()
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S7 Ctrl+B 快捷键切换 collapsed', async ({ page }) => {
  await waitForSeed(page)
  const sidebar = page.getByTestId('side-list')
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await page.keyboard.press('Control+b')
  await expect(sidebar).toHaveAttribute('collapsed', '')
  await page.keyboard.press('Control+b')
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
})
