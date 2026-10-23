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
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v10')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** 按分组 data-value 精确定位行（不依赖 role/name：行文案随语言与分组语义变化） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** 列表渲染行的状态文案集合 */
const rowStatuses = (page: Page) => page.locator('.issue-row .issue-status').allTextContents()

/** 侧栏成员多选（oas-select multiple+searchable+clearable）：trigger / 选项行都在 shadow 内 */
const assigneeSelect = (page: Page) => page.getByTestId('side-filter-assignee')
const assigneeDropdown = (page: Page) => assigneeSelect(page).locator('.dropdown')

async function openAssignee(page: Page) {
  await assigneeSelect(page).locator('button.trigger').click()
  await expect(assigneeDropdown(page)).toHaveClass(/open/, { timeout: 5000 })
}

/** 点某个选项（label 含计数后缀，如「李娜 (58)」） */
const pickAssignee = (page: Page, label: string) =>
  assigneeSelect(page).locator('.option').filter({ hasText: label }).first().click()

/** 行头像姓名集合（oas-avatar 的 title 属性随成员名） */
const rowAssignees = (page: Page) =>
  page
    .locator('.issue-row oas-avatar')
    .evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))

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

test('S3 侧栏成员多选：点两项取并集（chips 回显），再点取消', async ({ page }) => {
  await waitForSeed(page)
  await openAssignee(page)
  // 选项 label 带全量计数后缀（与列表窗口无关）；点击与断言只用成员名（去掉 " (n)"）
  const labels = await assigneeSelect(page).evaluate((el) => {
    const opts = (el as { options?: Array<{ label: string; value: string }> }).options ?? []
    return opts.filter((o) => o.value !== '__none__').map((o) => o.label)
  })
  expect(labels.length).toBeGreaterThanOrEqual(2)
  const plain = (label: string) => label.replace(/\s*\(\d+\)$/, '')
  const names = labels.map(plain).slice(0, 2) as [string, string]
  const [first, second] = names

  await expect(assigneeSelect(page).locator('.value')).toHaveText('全部成员')
  await pickAssignee(page, first)
  await expect(assigneeSelect(page).locator('.chip:not(.chip-plus)').first()).toContainText(first)
  await expect
    .poll(async () => {
      const list = await rowAssignees(page)
      return list.length > 0 && list.every((n) => n === first)
    })
    .toBe(true)

  // 侧栏只有一行宽度：max-tag-count=1，第二项折叠成 +1（选中集仍读 property）
  await pickAssignee(page, second)
  expect(await assigneeSelect(page).evaluate((el) => (el as { value?: string[] }).value)).toEqual([
    expect.any(String),
    expect.any(String),
  ])
  await expect(assigneeSelect(page).locator('.chip-plus')).toHaveText('+1', { timeout: 5000 })
  // 并集：渲染行只含这两位成员
  await expect
    .poll(async () => {
      const list = await rowAssignees(page)
      return list.length > 0 && list.every((n) => n === first || n === second)
    })
    .toBe(true)

  // 再点已选项 = 取消该值，仅剩另一位
  await pickAssignee(page, first)
  await expect(assigneeSelect(page).locator('.chip:not(.chip-plus)')).toHaveCount(1)
  await expect(assigneeSelect(page).locator('.chip-plus')).toHaveCount(0)
  await expect
    .poll(async () => {
      const list = await rowAssignees(page)
      return list.length > 0 && list.every((n) => n === second)
    })
    .toBe(true)
})

test('S4 优先级组多选：紧急+高 并集，全部清空', async ({ page }) => {
  await waitForSeed(page)
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  // 两次点击之间必须等状态落地：侧栏数据重挂会整树重建，连点两次会打在被替换的旧节点上
  await sideRow(page, '紧急').click()
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
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

test('S6 折叠 rail：56px 收窄、行存活、badge 角标，再展开恢复', async ({ page }) => {
  await waitForSeed(page)
  const sidebar = page.getByTestId('side-list')
  const panel = page.getByTestId('side-panel')
  const toggle = sidebar.locator('[part="toggle"]')
  await expect(toggle).toBeVisible()
  // 成员筛选是侧栏顶部的一行控件（不是行组）：行组只剩项目/视图/状态/优先级/迭代
  await expect(sideItem(page, 'priority:all')).toBeVisible()
  await expect(sidebar.locator('[part="item"][data-value^="member:"]')).toHaveCount(0)
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
  await expect(sideItem(page, 'priority:all')).toBeVisible()
  await expect(sidebar.locator('[part="badge"]').first()).toBeVisible()

  await toggle.click()
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await expect.poll(barWidth).toBe(220)

  await sideRow(page, '已完成').click()
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S8 侧栏成员多选：搜索过滤选项、+N 折叠、清空回全部', async ({ page }) => {
  await waitForSeed(page)
  await openAssignee(page)
  // 搜索：输入姓「李」只剩李娜一项（选项按 label 本地过滤）
  await assigneeSelect(page).locator('input.search-input').fill('李')
  await expect(assigneeSelect(page).locator('.option')).toHaveCount(1, { timeout: 5000 })
  await expect(assigneeSelect(page).locator('.option')).toContainText('李娜')

  // 选中后搜索词自动清空，其余选项回到列表
  await pickAssignee(page, '李娜')
  await expect(assigneeSelect(page).locator('.option').filter({ hasText: '张伟' })).toHaveCount(1)

  // 三选：max-tag-count=1（侧栏一行放不下更多 chip）→ 折叠出 +N（数字随宽度浮动，只断言形态）
  await pickAssignee(page, '张伟')
  await pickAssignee(page, '王强')
  await expect(assigneeSelect(page).locator('.chip-plus')).toHaveText(/^\+\d+$/, {
    timeout: 5000,
  })
  expect(
    await assigneeSelect(page).locator('.chip:not(.chip-plus):visible').count(),
  ).toBeGreaterThan(0)

  // clearable：清空回全部成员（占位文案复位，行恢复多成员）
  await assigneeSelect(page).locator('[part="clear"]').click()
  await expect(assigneeSelect(page).locator('.value')).toHaveText('全部成员')
  await expect.poll(async () => new Set(await rowAssignees(page)).size).toBeGreaterThan(1)
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
