import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  test.setTimeout(240_000)
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)
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

/** 顶栏视图切换（oas-tabs 的 items/active 走 attribute，change 事件与 segmented 同契约） */
const setView = (page: Page, v: string) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

/** 筛选位置 segmented：点 shadow 内的选项 label（真实点击路径，不走程序性派发） */
const pickPlacement = (page: Page, label: string) =>
  page
    .getByTestId('filters-placement')
    .locator('label.item')
    .filter({ hasText: label })
    .first()
    .click()

/** 侧栏行（按分组 data-value 定位，不依赖行文案） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

const topBar = (page: Page) => page.getByTestId('topbar-filters')

/** 打开某个多选下拉并点选项（选项 label 带全量计数后缀，点击按前缀匹配） */
async function pickOption(page: Page, testid: string, label: string) {
  const select = page.getByTestId(testid)
  await select.locator('button.trigger').click()
  await expect(select.locator('.dropdown')).toHaveClass(/open/, { timeout: 5000 })
  await select.locator('.option').filter({ hasText: label }).first().click()
}

const rowStatuses = (page: Page) => page.locator('.issue-row .issue-status').allTextContents()

/** 看板卡片的列归属（oas-kanban cards 由宿主 property 注入，column = status） */
const boardColumns = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('oas-kanban') as HTMLElement & {
      cards?: Array<{ column: string }>
    }
    return (el?.cards ?? []).map((c) => c.column)
  })

test('P1 默认侧栏：筛选组与成员控件在侧栏，内容区无顶部筛选栏', async ({ page }) => {
  await waitForSeed(page)
  await expect(page.getByTestId('filters-placement')).toHaveAttribute('value', 'sidebar')
  // 侧栏：状态 / 优先级 / 迭代 组 + 一行成员控件
  await expect(sideItem(page, 'status:all')).toBeVisible()
  await expect(sideItem(page, 'priority:all')).toBeVisible()
  await expect(sideItem(page, 'cycle:all')).toBeVisible()
  await expect(page.getByTestId('side-filters')).toBeVisible()
  await expect(page.getByTestId('side-filter-assignee')).toBeVisible()
  // 内容区顶部没有任何筛选控件；列表工具条只留排序/分组/已保存视图（筛选不在第三处复制）
  await expect(topBar(page)).toHaveCount(0)
  await expect(page.getByTestId('issue-toolbar').locator('oas-select')).toHaveCount(3)
})

test('P2 切顶部：侧栏筛选组隐藏、四控件在内容区顶部，且工具条不再重复，偏好落库', async ({
  page,
}) => {
  await waitForSeed(page)
  await pickPlacement(page, '顶部')
  await expect(page.getByTestId('filters-placement')).toHaveAttribute('value', 'topbar')

  // 侧栏筛选组与成员控件消失（项目/视图/保存视图仍在）
  await expect(page.getByTestId('side-filters')).toHaveCount(0)
  await expect(sideItem(page, 'status:all')).toHaveCount(0)
  await expect(sideItem(page, 'priority:all')).toHaveCount(0)
  await expect(sideItem(page, 'cycle:all')).toHaveCount(0)
  await expect(sideItem(page, 'project:__all__')).toBeVisible()

  // 内容区顶部：状态/优先级/成员/迭代 + 清除筛选
  await expect(topBar(page)).toBeVisible()
  await expect(page.getByTestId('filters-status')).toBeVisible()
  await expect(page.getByTestId('filters-priority')).toBeVisible()
  await expect(page.getByTestId('filters-assignee')).toBeVisible()
  await expect(page.getByTestId('filters-cycle')).toBeVisible()
  await expect(page.getByTestId('filters-clear')).toBeDisabled()
  // 列表工具条不再承载筛选项：只有排序 / 分组 / 已保存视图三个下拉（筛选不在第三处复制）
  await expect(page.getByTestId('issue-toolbar').locator('oas-select')).toHaveCount(3)
  await expect(page.getByTestId('sort-by')).toBeVisible()

  // 偏好持久化：刷新后仍是顶部
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-filters-placement')))
    .toBe('topbar')
  await page.reload()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
  await expect(topBar(page)).toBeVisible()
  await expect(page.getByTestId('side-filters')).toHaveCount(0)
})

test('P3 两者：侧栏筛选组与内容区顶部筛选栏同时在场', async ({ page }) => {
  await waitForSeed(page)
  await pickPlacement(page, '两者')
  await expect(page.getByTestId('filters-placement')).toHaveAttribute('value', 'both')
  await expect(sideItem(page, 'status:all')).toBeVisible()
  await expect(sideItem(page, 'priority:all')).toBeVisible()
  await expect(sideItem(page, 'cycle:all')).toBeVisible()
  await expect(page.getByTestId('side-filters')).toBeVisible()
  await expect(topBar(page)).toBeVisible()
  await expect(page.getByTestId('filters-status')).toBeVisible()
})

test('P4 各视图内容区顶部都有筛选控件：看板/时间线/资源/日程', async ({ page }) => {
  await waitForSeed(page)
  await pickPlacement(page, '顶部')
  for (const view of ['board', 'timeline', 'resource', 'schedule']) {
    await setView(page, view)
    await expect(topBar(page), `topbar filters @ ${view}`).toBeVisible()
    await expect(page.getByTestId('filters-status'), `status control @ ${view}`).toBeVisible()
    await expect(page.getByTestId('filters-cycle'), `cycle control @ ${view}`).toBeVisible()
  }
  // 仪表盘不在筛选视图里：切换过去时顶部筛选栏不渲染
  await setView(page, 'dashboard')
  await expect(topBar(page)).toHaveCount(0)
  await setView(page, 'issues')
  await expect(topBar(page)).toBeVisible()
})

test('P5 顶栏改状态/成员 → 列表与看板同步过滤；清除筛选后恢复，再切回侧栏', async ({ page }) => {
  await waitForSeed(page)
  await pickPlacement(page, '顶部')

  // 状态：待办
  await pickOption(page, 'filters-status', '待办')
  await expect(page.getByTestId('filters-status').locator('.chip').first()).toContainText('待办')
  await expect
    .poll(async () => {
      const st = await rowStatuses(page)
      return st.length > 0 && st.every((s) => s === '待办')
    })
    .toBe(true)

  // 成员：「未分配」置首，选它之后行头像全部是未分配
  const firstOption = await page.getByTestId('filters-assignee').evaluate((el) => {
    const opts = (el as { options?: Array<{ label: string; value: string }> }).options ?? []
    return opts[0] ?? null
  })
  expect(firstOption?.value).toBe('__none__')
  await pickOption(page, 'filters-assignee', '未分配')
  await expect
    .poll(async () => {
      const names = await page
        .locator('.issue-row oas-avatar')
        .evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))
      return names.length > 0 && names.every((n) => n === '未分配')
    })
    .toBe(true)

  // 看板同步：同一份筛选状态 → 卡片列只剩待办
  await setView(page, 'board')
  await expect(topBar(page)).toBeVisible()
  await expect
    .poll(async () => {
      const cols = await boardColumns(page)
      return cols.length > 0 && cols.every((c) => c === 'todo')
    })
    .toBe(true)

  // 清除筛选：控件回空、看板重新出现多列
  await expect(page.getByTestId('filters-clear')).toBeEnabled()
  await page.getByTestId('filters-clear').click()
  await expect(page.getByTestId('filters-status').locator('.chip')).toHaveCount(0)
  await expect(page.getByTestId('filters-clear')).toBeDisabled()
  await expect.poll(async () => new Set(await boardColumns(page)).size).toBeGreaterThan(1)

  // 切回侧栏：筛选组回归，顶部栏撤除
  await pickPlacement(page, '侧栏')
  await expect(page.getByTestId('filters-placement')).toHaveAttribute('value', 'sidebar')
  await expect(topBar(page)).toHaveCount(0)
  await expect(sideItem(page, 'status:all')).toBeVisible()
  await expect(page.getByTestId('side-filters')).toBeVisible()
})
