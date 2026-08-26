import { expect, test, type Page } from '@playwright/test'

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

const tabs = (page: Page) => page.getByTestId('page-tabs')
const tab = (page: Page, label: string) =>
  tabs(page).locator('[role="tab"]').filter({ hasText: label })

test('admin 页签累积：访问多页后页签追加且激活随路由同步', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(1)
  await expect(tabs(page)).toHaveAttribute('active', '/dashboard')

  await page.locator('#nav').getByText('订单管理').click()
  await page.locator('#nav').getByText('用户管理').click()
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(3)
  await expect(tabs(page)).toHaveAttribute('active', '/users')
  await expect(tab(page, '仪表盘')).toBeVisible()
  await expect(tab(page, '订单管理')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 点击页签切换路由并回写激活', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('订单管理').click()
  await page.locator('#nav').getByText('用户管理').click()
  await tab(page, '订单管理').click()
  await expect(page).toHaveURL(/#\/orders/)
  await expect(tabs(page)).toHaveAttribute('active', '/orders')
  expect(errors).toEqual([])
})

test('admin 关闭当前页签切到相邻页签', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('订单管理').click()
  await page.locator('#nav').getByText('用户管理').click()
  await expect(tabs(page)).toHaveAttribute('active', '/users')

  await tab(page, '订单管理').locator('[data-ptab-close]').click()
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(2)
  await expect(tabs(page)).toHaveAttribute('active', '/users')

  await tab(page, '用户管理').locator('[data-ptab-close]').click()
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('admin 隐藏路由归属父级页签：订单详情不新增独立页签', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('订单管理').click()
  await page.getByTestId('orders-list').locator('tbody tr').first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('order-detail-link').click()
  await page.waitForURL('**/#/order-detail')
  await expect(tabs(page)).toHaveAttribute('active', '/orders')
  await expect(tabs(page).locator('[role="tab"]')).toHaveCount(2)
  await expect(tab(page, '订单管理')).toHaveAttribute('aria-selected', 'true')
  expect(errors).toEqual([])
})

test('admin 仪表盘页签固定不可关闭', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await expect(tab(page, '仪表盘').locator('[data-ptab-close]')).toHaveCount(0)
  expect(errors).toEqual([])
})
