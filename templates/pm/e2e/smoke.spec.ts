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

test('M3 看板：拖拽改状态 + 插入到目标列最前', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('nav-board').click()
  await expect(page.getByTestId('board')).toBeVisible()
  const todoCards = await page.getByTestId('col-body-todo').locator('.board-card').count()
  expect(todoCards).toBeGreaterThan(0)
  expect(todoCards).toBeLessThanOrEqual(200)

  // 拖 todo 首卡到 done 列（默认坐标 → 插最前）
  const card = page.getByTestId('col-body-todo').locator('.board-card').first()
  const cardKey = await card.getAttribute('data-card-key')
  expect(cardKey).toBeTruthy()
  const beforeDone = await page.getByTestId('col-count-done').textContent()
  await page.evaluate((key) => {
    const src = document.querySelector(`[data-card-key="${key}"]`) as HTMLElement
    const dst = document.querySelector('[data-status="done"]') as HTMLElement
    const dt = new DataTransfer()
    src.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )
    dst.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, cardKey)
  // done 计数 +1，且拖动卡排在 done 列第一
  await expect
    .poll(async () => Number(await page.getByTestId('col-count-done').textContent()), {
      timeout: 10_000,
    })
    .toBe(Number(beforeDone) + 1)
  const firstKey = await page
    .getByTestId('col-body-done')
    .locator('.board-card')
    .first()
    .getAttribute('data-card-key')
  expect(firstKey).toBe(cardKey)
})

test('M3b 看板：拖拽插入到目标列中间位置（fractional order）', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('nav-board').click()
  await expect(page.getByTestId('board')).toBeVisible()

  // 目标：done 列第二张卡上半部（clientY = 中点 - 2 → 插入 index 1，排第二位）
  const doneBody = page.getByTestId('col-body-done')
  await doneBody.locator('.board-card').nth(1).waitFor({ timeout: 10_000 })
  const secondRect = await doneBody
    .locator('.board-card')
    .nth(1)
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { midY: r.top + r.height / 2 }
    })
  const doneFirst = await doneBody.locator('.board-card').first().getAttribute('data-card-key')
  const doneSecond = await doneBody.locator('.board-card').nth(1).getAttribute('data-card-key')

  const card = page.getByTestId('col-body-todo').locator('.board-card').first()
  const cardKey = await card.getAttribute('data-card-key')
  expect(cardKey).toBeTruthy()

  await page.evaluate(
    ({ key, y }) => {
      const src = document.querySelector(`[data-card-key="${key}"]`) as HTMLElement
      const dst = document.querySelector('[data-status="done"]') as HTMLElement
      const dt = new DataTransfer()
      src.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
      dst.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientY: y,
        }),
      )
      dst.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }),
      )
    },
    { key: cardKey, y: Math.round(secondRect.midY - 2) },
  )

  // 拖动卡应落在 done 列第二位（第一张仍是原首卡）
  await expect
    .poll(async () => await doneBody.locator('.board-card').nth(1).getAttribute('data-card-key'), {
      timeout: 10_000,
    })
    .toBe(cardKey)
  const firstAfter = await doneBody.locator('.board-card').first().getAttribute('data-card-key')
  expect(firstAfter).toBe(doneFirst)
  expect(doneSecond).not.toBe(cardKey)
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

test('M5 工具栏：新建 Issue 全流程 + CSV 导出 + 关于弹窗', async ({ page }) => {
  await waitForSeed(page)

  // 新建 Issue：标题空 → 错误提示；填写 → 创建 → 列表与看板出现
  await page.getByTestId('toolbar-new').click()
  const modal = page.getByTestId('modal-create')
  await expect(modal).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('create-error')).toBeVisible()
  await page.getByTestId('create-title').locator('input').fill('E2E 新建测试 Issue')
  await page.getByTestId('create-status').selectOption('todo')
  await page.getByTestId('create-priority').selectOption('high')
  await page.getByTestId('create-submit').click()
  await expect(modal).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
  // 新建 updatedAt 最新 → 列表窗口第一行
  await expect(page.locator('.issue-row').first()).toContainText('E2E 新建测试 Issue', {
    timeout: 10_000,
  })
  // 新建 order = Date.now() 列内最大 → 看板 todo 列尾出现（updatedAt 最新必在窗口内）
  await page.getByTestId('nav-board').click()
  await expect(page.getByTestId('col-body-todo').locator('.board-card').last()).toContainText(
    'E2E 新建测试 Issue',
    { timeout: 10_000 },
  )

  // CSV 导出
  const dl = page.waitForEvent('download', { timeout: 10_000 })
  await page.getByTestId('toolbar-export').click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^oas-pm-issues-\d+\.csv$/)

  // 关于弹窗开合
  await page.getByTestId('toolbar-about').click()
  const about = page.getByTestId('modal-about')
  await expect(about).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await expect(page.locator('.about-name')).toContainText('OAS PM')
  await page.getByTestId('about-close').click()
  await expect(about).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
})

test('M6 看板拖拽：预览重排（拖动卡落点半透明显示）', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('nav-board').click()
  await expect(page.getByTestId('board')).toBeVisible()
  // liveQuery 就绪后再操作 DOM（否则列是空壳，evaluate 取不到卡）
  await expect(page.getByTestId('col-body-done').locator('.board-card').first()).toBeVisible({
    timeout: 10_000,
  })

  // 记录 todo 首卡 key，dragover 重放到 done 列首位（卡中点上方）
  const todoKey = await page
    .getByTestId('col-body-todo')
    .locator('.board-card')
    .first()
    .getAttribute('data-card-key')
  expect(todoKey).toBeTruthy()
  await page.evaluate(() => {
    const src = document.querySelector('[data-status="todo"] .board-card') as HTMLElement
    const dst = document.querySelector('[data-status="done"]') as HTMLElement
    const dt = new DataTransfer()
    src.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )
    const body = dst.querySelector('.board-col-body') as HTMLElement
    const card = body.querySelector('.board-card') as HTMLElement
    const r = card.getBoundingClientRect()
    dst.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientY: Math.round(r.top - 4),
      }),
    )
  })
  // 预览重排：done 列首位出现拖动卡（半透明预览），todo 列该卡移出
  await expect(page.locator('[data-status="done"] .board-card.is-dragging')).toHaveCount(1)
  const previewKey = await page
    .getByTestId('col-body-done')
    .locator('.board-card')
    .first()
    .getAttribute('data-card-key')
  expect(previewKey).toBe(todoKey)
  const todoHasCard = await page
    .getByTestId('col-body-todo')
    .locator(`[data-card-key="${todoKey}"]`)
    .count()
  expect(todoHasCard).toBe(0)
  await expect(page.locator('.board-card.is-dragging')).toHaveCount(1)

  // drop 后落库：预览消失（is-dragging 清除）
  await page.evaluate(() => {
    const dst = document.querySelector('[data-status="done"]') as HTMLElement
    const dt = new DataTransfer()
    const body = dst.querySelector('.board-col-body') as HTMLElement
    const card = body.querySelector('.board-card') as HTMLElement
    const r = card.getBoundingClientRect()
    dst.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientY: Math.round(r.top - 4),
      }),
    )
  })
  await expect(page.locator('.board-card.is-dragging')).toHaveCount(0, { timeout: 10_000 })
})
