import { expect, test, type Page } from '@playwright/test'

// API 模式由 localStorage 决断；用 storageState 预置（addInitScript 会在每次 reload 重新写回，切不回本地）
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5878',
        localStorage: [{ name: 'oas-pm-data', value: 'api' }],
      },
    ],
  },
})

/** oas-select 设值（property + 契约事件，宿主 OSelect 监听同元素） */
async function setOSelect(page: Page, testid: string, value: string) {
  await page.evaluate(
    ([tid, val]) => {
      const el = document.querySelector(`[data-testid="${tid}"]`) as
        | (HTMLElement & { value?: string })
        | null
      if (!el) return
      el.value = String(val)
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    },
    [testid, value],
  )
}

const STATUS_TEXT: Record<string, string> = {
  backlog: '待规划',
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
}

const issueTotal = async (page: Page) => {
  const text = (await page.getByTestId('issue-total').textContent()) ?? ''
  return Number((text.match(/^[\d,]+/)?.[0] ?? '0').replace(/,/g, ''))
}

test('A1 引导：reset 端点 + mock 2K 数据渲染 + 徽标 API + 不跑 Dexie seed', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  // 复用 dev server 时 store 会跨跑污染：先用 reset 端点回到确定性种子
  const reset = await request.post('/api/admin/reset')
  expect(reset.ok()).toBe(true)
  expect((await request.get('/api/revision')).ok()).toBe(true)

  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('data-source-badge')).toHaveText('API')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 15_000 })

  // mock 种子规模：项目内 1K 级（不是 10W 级），虚拟列表只渲染窗口行
  const total = await issueTotal(page)
  expect(total).toBeGreaterThan(900)
  expect(total).toBeLessThan(2000)
  const rows = await page.locator('.issue-row').count()
  expect(rows).toBeGreaterThan(10)
  expect(rows).toBeLessThan(200)
  await expect(page.locator('.issue-row .issue-key').first()).toContainText('OAS-')

  // API 模式不碰 IndexedDB：Dexie seed 标记不应出现
  expect(await page.evaluate(() => localStorage.getItem('oas-pm-seed-v7'))).toBeNull()
})

test('A2 编辑推送：UI 改状态即时生效 + 外部 PATCH 经 revision 轮询推送到表内', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  await request.post('/api/admin/reset')
  await page.goto('/')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 15_000 })

  // 1) UI 改状态：打开首行详情抽屉 → 改状态 → 关抽屉 → 表内该行状态跟随
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
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
  const current = await page.evaluate(
    () =>
      (document.querySelector('[data-testid=detail-status]') as { value?: string })?.value ?? '',
  )
  const next = current === 'done' ? 'in_progress' : 'done'
  await setOSelect(page, 'detail-status', next)
  await page.keyboard.press('Escape')
  await expect
    .poll(
      async () =>
        ((await page.locator('.issue-row .issue-status').first().textContent()) ?? '').trim(),
      { timeout: 10_000 },
    )
    .toBe(STATUS_TEXT[next])

  // 2) 外部 PATCH（不在本页发起）：轮询到 revision 变化后表内标题跟随
  const head = await page.evaluate(async () => {
    const res = await fetch('/api/issues?projectId=project-1&limit=1')
    const json = (await res.json()) as { items: Array<{ id: string; title: string }> }
    return json.items[0]
  })
  expect(head?.id).toBeTruthy()
  const title = `外部改标题 ${Date.now()}`
  const patched = await request.patch(`/api/issues/${head.id}`, {
    data: { changes: { title } },
  })
  expect(patched.ok()).toBe(true)
  const started = Date.now()
  await expect(page.locator('.issue-row .issue-title').first()).toContainText(title, {
    timeout: 6000,
  })
  const elapsed = Date.now() - started
  // 轮询间隔 1200ms：一次 revision 读 + 一次重取即到；留足 CI 抖动
  expect(elapsed).toBeLessThan(5000)
})

test('A3 切回本地：DEV 徽标点击写回 dexie 并走既有 Dexie seed', async ({ page }) => {
  // 高负载下 100K 播种可能超 100s：轮询与用例预算统一留余量
  test.setTimeout(240_000)
  await page.goto('/')
  await expect(page.getByTestId('data-source-badge')).toHaveText('API', { timeout: 15_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 15_000 })

  // DEV 下徽标即切换按钮：写 localStorage 后 reload
  await page.getByTestId('data-source-badge').click()
  await expect(page.getByTestId('data-source-badge')).toHaveText('本地', { timeout: 20_000 })
  expect(await page.evaluate(() => localStorage.getItem('oas-pm-data'))).toBeNull()

  // 既有 Dexie seed 等待预算（100K；高负载下留足余量）
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v7')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
  expect(await issueTotal(page)).toBeGreaterThan(60_000)
})
