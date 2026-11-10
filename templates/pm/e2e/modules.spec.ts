import { expect, test, type Page } from '@playwright/test'

/** 模块（v18）闭环：侧栏筛选/管理 CRUD/抽屉字段/group-by/批量归模块 */

async function openApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('oas-pm-seed-size', '5000')
    localStorage.setItem('oas-pm-theme', 'dark')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
    timeout: 180_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
}

const setView = (page: Page, v: string) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

test('MD1 侧栏模块组：筛选/未分组/取消', async ({ page }) => {
  test.setTimeout(120_000)
  await openApp(page)
  // 组头按需展开（点击是折叠开关）
  const group = page.locator('[data-value="group:modules"]')
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click()
  await expect(page.locator('[data-value="module:module-1"]')).toBeVisible({ timeout: 10_000 })
  // 种子口径：module-1 = 核心服务（10 条全渲染：10 < 视口窗口容量）
  await page.locator('[data-value="module:module-1"]').click()
  await expect(page.locator('.issue-row')).toHaveCount(10, { timeout: 10_000 })
  // 未分组：虚拟列表只渲染视口窗口（~21 行），数量显著大于 10 即可
  await page.locator('[data-value^="module:"]').first().click() // 取消 module-1
  await page.locator('[data-value="module:__none_module__"]').click()
  await expect
    .poll(() => page.locator('.issue-row').count(), { timeout: 10_000 })
    .toBeGreaterThan(15)
  // 再点取消 → 回到全部（同样只渲染视口窗口）
  await page.locator('[data-value="module:__none_module__"]').click()
  await expect
    .poll(() => page.locator('.issue-row').count(), { timeout: 10_000 })
    .toBeGreaterThan(15)
})

test('MD2 管理页签：建模块→重名拒绝→删除解绑', async ({ page }) => {
  test.setTimeout(150_000)
  // 唯一模块名：e2e 共享 IndexedDB（workers=1 串行），跨轮跑同库，固定名会撞重名拒绝
  const MOD = '支付' + Date.now().toString().slice(-6)
  await openApp(page)
  await setView(page, 'admin')
  await page.waitForTimeout(500)
  await page.getByTestId('admin-nav-modules').click()
  await expect(page.getByTestId('admin-tab-modules')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-module-name-module-1')).toHaveValue('核心服务')

  // 新建
  await page.getByTestId('admin-module-new-name').fill(MOD)
  await page.getByTestId('admin-module-new-desc').fill('支付相关')
  await page.getByTestId('admin-module-add').click()
  await expect(
    page.locator('.ms-card').filter({ has: page.locator(`input[value="${MOD}"]`) }),
  ).toBeVisible({ timeout: 5_000 })

  // 重名拒绝 + 错误提示
  await page.getByTestId('admin-module-new-name').fill('核心服务')
  await page.getByTestId('admin-module-add').click()
  await expect(page.getByTestId('admin-modules-error')).toBeVisible({ timeout: 5_000 })

  // 抽屉选中并保存归属：module-1 直取筛选后打开首行
  await setView(page, 'issues')
  await page.waitForTimeout(600)
  const group = page.locator('[data-value="group:modules"]')
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click()
  await page.locator('[data-value="module:module-1"]').click()
  await expect(page.locator('.issue-row')).toHaveCount(10, { timeout: 10_000 })
  // 记录此刻 module-1 计数（共享库跨轮跑可能有残留，断言用相对回收而非绝对值）
  const mod1Before = await page.locator('[data-value="module:module-1"]').innerText()
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  const modSel = page.getByTestId('detail-module')
  await expect(modSel).toBeAttached({ timeout: 10_000 })
  await modSel.locator('.trigger').click()
  await page.waitForTimeout(300)
  await modSel.locator('.option', { hasText: MOD }).first().click()
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  // 该模块计数 = 1（从 0 涨上来；跨轮跑唯一名保证无存量）
  await expect(page.locator('[data-value^="module:"]').filter({ hasText: MOD })).toContainText(
    '1',
    { timeout: 8_000 },
  )

  // 删除 → 影响面确认 → issue 退回未分组
  await setView(page, 'admin')
  await page.waitForTimeout(500)
  await page.getByTestId('admin-nav-modules').click()
  const row = page.locator('.ms-card').filter({ has: page.locator(`input[value="${MOD}"]`) })
  await row.locator('[data-testid^="admin-module-del-"]').click()
  await page.waitForTimeout(400)
  await page
    .locator('oas-popconfirm')
    .getByRole('button', { name: /确定|OK|Confirm/i })
    .first()
    .click()
  await expect(
    page.locator('.ms-card').filter({ has: page.locator(`input[value="${MOD}"]`) }),
  ).toHaveCount(0, { timeout: 5_000 })
  // 侧栏计数：module-1 = 捕获值 - 1（抽屉把 1 条移到 MOD；删 MOD 后它退回「未分组」，
  // 而不是回 module-1——这是单选归属的语义）
  await setView(page, 'issues')
  await page.waitForTimeout(600)
  const mod1Digits = String(Number(mod1Before.replace(/[^0-9]/g, '')) - 1)
  await expect(page.locator('[data-value="module:module-1"]')).toContainText(mod1Digits, {
    timeout: 8_000,
  })
})

test('MD3 group-by 按模块：组名/未分组末尾', async ({ page }) => {
  test.setTimeout(120_000)
  await openApp(page)
  await page.locator('[data-testid=group-by] .trigger').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid=group-by] .option', { hasText: '按模块' }).first().click()
  await page.waitForTimeout(600)
  const titles = await page.locator('.issue-group-title').allInnerTexts()
  console.log('group titles:', JSON.stringify(titles))
  expect(titles.length).toBeGreaterThan(0)
  // 未分组固定末尾
  expect(titles[titles.length - 1]).toContain('未分组')
  // 组名是中文模块名而非 id
  expect(titles.some((t) => t.includes('核心服务') || t.includes('管理后台'))).toBe(true)
})

test('MD4 批量归模块', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  // 全选当前窗口前 3 行（跨模块混合）
  const group = page.locator('[data-value="group:modules"]')
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click()
  const before = await page.locator('[data-value="module:__none_module__"]').innerText()
  const rows = page.locator('.issue-row')
  for (let i = 0; i < 3; i++) {
    // row-check 在 shadow 内且宿主 click 双发——evaluate 直点（smoke.spec 同口径）
    await rows
      .nth(i)
      .locator('.row-check')
      .evaluate((el) => (el as HTMLElement).click())
    await page.waitForTimeout(150)
  }
  await expect(page.getByTestId('bulk-bar')).toBeVisible({ timeout: 5_000 })
  // property + 契约事件通道（下拉浮层鼠标路径不可靠，keyboard/smoke 同口径）
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=bulk-module]') as HTMLElement & {
      value: string
    }
    el.value = 'module-2'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'module-2' } }),
    )
  })
  await page.getByTestId('bulk-apply').click()
  await page.waitForTimeout(800)
  // 未分组计数减少 3（总量不变、module-1/2 已加 3 的佐证在 module-2 行）
  const after = await page.locator('[data-value="module:__none_module__"]').innerText()
  const num = (s: string) => Number(s.replace(/[^0-9]/g, '').slice(-8)) || 0
  expect(num(after)).toBe(num(before) - 3)
})

test('MD5 模块排序：改数字换序（拖排与数字共用 reorder 通道）', async ({ page }) => {
  test.setTimeout(120_000)
  await openApp(page)
  await setView(page, 'admin')
  await page.waitForTimeout(500)
  await page.getByTestId('admin-nav-modules').click()
  await expect(page.getByTestId('admin-tab-modules')).toBeVisible({ timeout: 10_000 })
  const nameInputs = page.locator('.ms-card input[data-testid^="admin-module-name-"]')
  const readNames = () =>
    nameInputs.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
  const before = await readNames()
  console.log('order before:', JSON.stringify(before))
  expect(before.length).toBeGreaterThanOrEqual(2)
  // 把最后一行位置改为 1 → 它应跳到首位
  const cards = page.locator('.ms-card')
  const last = cards.nth(before.length - 1)
  const lastName = before[before.length - 1]!
  await last.locator('input[data-testid^="admin-module-order-"]').fill('1')
  await last.locator('input[data-testid^="admin-module-order-"]').blur()
  await page.waitForTimeout(800)
  const after = await readNames()
  console.log('order after:', JSON.stringify(after))
  expect(after[0]).toBe(lastName)
  // 侧栏跟随同一 repo 顺序：第 2 行（首行是「全部模块」）应是 lastName
  await setView(page, 'issues')
  await page.waitForTimeout(600)
  const group = page.locator('[data-value="group:modules"]')
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click()
  await page.waitForTimeout(300)
  const sideFirst = await page.locator('[data-value^="module:"]').nth(1).innerText()
  console.log('sidebar first module:', sideFirst)
  expect(sideFirst).toContain(lastName)
})
