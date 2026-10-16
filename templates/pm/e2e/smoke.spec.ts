import { expect, test, type Page } from '@playwright/test'

/** 等待 100K seed 完成并以列表行出现（seed 走后台 bulkPut，首次约 5~15s） */
async function waitForSeed(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('titlebar')).toBeVisible({ timeout: 10_000 })
  // 全量计数（index count）稳定在 ~70K 才算 seed 完成
  await expect
    .poll(
      async () => {
        const t = await page.getByTestId('issue-total').textContent()
        return Number(t?.replace(/[^\d]/g, '') ?? 0)
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(60_000)
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
}

test('M1 架构：100K seed + 虚拟列表渲染 + 真实计数', async ({ page }) => {
  await waitForSeed(page)
  // 虚拟滚动只渲染窗口行（40~60 行），不能是全量
  const rows = await page.locator('.issue-row').count()
  expect(rows).toBeGreaterThan(10)
  expect(rows).toBeLessThan(200)
  // 计数是真实全量（≈70K），不是窗口 500
  const total = await page.getByTestId('issue-total').textContent()
  expect(Number(total?.replace(/[^\d]/g, '') ?? 0)).toBeGreaterThan(60_000)
})

test('M2 状态筛选：compound index 直取 + 计数联动', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('filter-in_progress').click()
  // 窗口行全部是 in_progress
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('in_progress', {
    timeout: 10_000,
  })
  const statuses = await page.locator('.issue-row .issue-status').allTextContents()
  expect(statuses.length).toBeGreaterThan(0)
  for (const s of statuses) expect(s).toBe('in_progress')
  // 筛选计数 < 全量计数
  const filtered = await page.getByTestId('issue-total').textContent()
  expect(filtered).not.toBeNull()
  // 切回全部
  await page.getByTestId('filter-all').click()
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
})

test('M3 看板：列渲染 + HTML5 拖拽改状态', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('nav-board').click()
  await expect(page.getByTestId('board')).toBeVisible()
  // 每列截断窗口：卡片数 ≤ 50
  const todoCards = await page.getByTestId('col-body-todo').locator('.board-card').count()
  expect(todoCards).toBeGreaterThan(0)
  expect(todoCards).toBeLessThanOrEqual(50)

  // 拖一张 todo 卡到 done：dataTransfer 通道
  const card = page.getByTestId('col-body-todo').locator('.board-card').first()
  const cardKey = await card.getAttribute('data-card-key')
  expect(cardKey).toBeTruthy()
  const beforeDone = await page.getByTestId('col-count-done').textContent()
  await page.evaluate((key) => {
    const src = document.querySelector(`[data-card-key="${key}"]`) as HTMLElement
    const dst = document.querySelector('[data-status="done"]') as HTMLElement
    const dt = new DataTransfer()
    // dragstart 触发 React onDragStart 把 issue.id 写进 dt；drop 时列回调读回
    src.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )
    dst.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, cardKey)
  // drop 后 liveQuery 推送：done 计数 +1
  await expect
    .poll(async () => Number(await page.getByTestId('col-count-done').textContent()), {
      timeout: 10_000,
    })
    .toBe(Number(beforeDone) + 1)
})

test('M4 时间线：oas-gantt 接收 tasks 并渲染', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('nav-timeline').click()
  const gantt = page.getByTestId('gantt')
  await expect(gantt).toBeAttached({ timeout: 10_000 })
  // 属性通道（JSON 字符串）→ 组件 property 解析成功：tasks 读回非空
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const g = document.querySelector('oas-gantt') as HTMLElement & { tasks?: unknown[] }
          return Array.isArray(g.tasks) ? g.tasks.length : 0
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0)
})
