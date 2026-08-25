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
  const rows = page.getByTestId('orders-list').locator('tbody tr')
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

test('admin 商品管理：上下架切换 + 新建表单校验', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page.getByTestId('product-grid')).toContainText('无线降噪耳机')

  const firstCard = page.getByTestId('product-grid').locator('oas-card.product-card').first()
  const switchEl = firstCard.getByTestId('product-switch')
  await expect(switchEl).toHaveAttribute('checked')
  await switchEl.click()
  await expect(firstCard).toContainText('已下架')
  await expect(page.locator('oas-message').filter({ hasText: '已下架' })).toBeVisible()

  await page.getByTestId('product-create').click()
  await expect(page.getByTestId('product-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('pf-save').click()
  await expect(page.locator('.error-text')).toContainText('请输入商品名称')
  await expect(page.getByTestId('product-drawer')).toHaveAttribute('visible', '')
  expect(errors).toEqual([])
})

test('viewer 访问商品管理显示 403', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '李四', 'viewer')
  await page.goto('/#/products')
  await expect(page.getByText('无权访问该页面')).toBeVisible()
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
