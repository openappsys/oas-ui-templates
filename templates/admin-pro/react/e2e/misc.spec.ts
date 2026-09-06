// e2e/misc.spec.ts —— 杂项用例（移植自 vanilla-html/e2e/pages.spec.ts 订单段、tabs.spec 的
// 订单详情隐藏路由段、error-form.spec 基础表单段与 misc.spec 面包屑/命令面板段，
// 断言语义逐条对齐）：订单 tabs 筛选与状态流转、CSV 导出、订单详情归父页签、
// 基础表单必填校验、面包屑、Ctrl+K 命令面板直达
import { expect, test, type Page } from '@playwright/test'

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function login(page: Page, name: string, role: 'admin' | 'viewer'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  if (role === 'viewer') {
    await page.getByTestId('login-role').click()
    await page.getByText('访客（只读）').click()
  }
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('admin 订单管理：tabs 筛选只显对应状态 + 抽屉状态流转', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('订单管理').click()
  await expect(page.getByTestId('orders-export')).toBeVisible()
  await expect(page.locator('#orders-stats').locator('oas-card')).toHaveCount(3)

  await page.getByTestId('orders-tabs').getByText('待支付').click()
  await expect(page.getByTestId('orders-tabs')).toHaveAttribute('active', 'pending')
  const rows = page.getByTestId('orders-list').locator('tbody tr[part="row"]')
  // oas-table 的 data 属性重渲染为异步——等行集全部变为「待支付」后再取行数（替代裸 count 竞态）
  await expect.poll(async () => {
    const texts = await rows.allTextContents()
    return texts.length > 0 && texts.every((t) => t.includes('待支付'))
  }).toBe(true)
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText('待支付')
  }
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i).locator('oas-tag')).toHaveText('待支付')
  }

  await rows.first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await expect(page.getByTestId('order-detail-action')).toBeVisible()
  await expect(page.getByTestId('order-detail-action')).toHaveText('标记已支付')
  await page.getByTestId('order-detail-action').click()
  await expect(page.getByTestId('order-detail-tag')).toHaveText('已支付')
  expect(errors).toEqual([])
})

test('admin 导出订单 CSV 触发下载', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('订单管理').click()
  await expect(page.getByTestId('orders-export')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('orders-export').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^orders-.*\.csv$/)
  expect(errors).toEqual([])
})

test('admin 隐藏路由归属父级页签：订单详情不新增独立页签', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('订单管理').click()
  await page.getByTestId('orders-list').locator('tbody tr').first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('order-detail-link').click()
  await page.waitForURL('**/#/order-detail')
  await expect(page.getByTestId('page-tabs')).toHaveAttribute('active', '/orders')
  await expect(page.getByTestId('page-tabs').locator('[role="tab"]')).toHaveCount(2)
  await expect(
    page
      .getByTestId('page-tabs')
      .locator('[role="tab"]')
      .filter({ hasText: '订单管理' }),
  ).toHaveAttribute('aria-selected', 'true')
  expect(errors).toEqual([])
})

test('基础表单：空值提交触发必填校验', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/basic-form')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
  expect(errors).toEqual([])
})

test('admin 面包屑新页显示 应用 / 创建订单', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('创建订单').click()
  await expect(page.getByTestId('form-steps')).toBeVisible()
  await expect(page.locator('#crumbs')).toContainText('应用')
  await expect(page.locator('#crumbs')).toContainText('创建订单')
  expect(errors).toEqual([])
})

test('admin Command 面板 Ctrl+K 输「订单」Enter 直达 /orders', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.keyboard.press('Control+k')
  await expect(page.locator('#command')).toHaveAttribute('open', '')
  await page.locator('#command input[part="search"]').fill('订单')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/orders/)
  expect(errors).toEqual([])
})
