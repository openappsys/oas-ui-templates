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

test('admin 创建订单完整向导 → /result 成功态 + sessionStorage 清理', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('创建订单').click()
  await expect(page.getByTestId('form-steps')).toBeVisible()

  await page.getByTestId('form-customer').locator('input').fill('测试客户')
  await page.getByTestId('form-phone').locator('input').fill('13812345678')
  await page.getByTestId('form-next').click()
  await expect(page.getByTestId('form-step2')).toBeVisible()

  const checkboxes = page.getByTestId('form-products').locator('oas-checkbox')
  await expect(checkboxes).not.toHaveCount(0)
  await checkboxes.first().locator('label').click()
  await page.getByTestId('form-qty').locator('input').fill('2')
  await page.getByTestId('form-next').click()
  await expect(page.getByTestId('form-step3')).toBeVisible()

  await page.getByTestId('form-confirm').locator('label').click()
  await page.getByTestId('form-submit').click()

  await page.waitForURL('**/#/result')
  await expect(page.getByTestId('form-result')).toHaveAttribute('status', 'success')
  await expect(page.getByTestId('form-result')).toContainText('创建成功')
  expect(await page.evaluate(() => sessionStorage.getItem('form-result'))).toBeNull()
  expect(errors).toEqual([])
})

test('admin 创建订单校验拦截：步1 空名点下一步停留步1', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('创建订单').click()
  await expect(page.getByTestId('form-steps')).toBeVisible()

  await page.getByTestId('form-next').click()
  await expect(page.getByTestId('form-step1')).toBeVisible()
  await expect(page.getByTestId('form-error-customer')).toBeVisible()
  await expect(page.getByTestId('form-error-customer')).toHaveText('请输入客户名称')
  expect(errors).toEqual([])
})

test('admin 从订单详情抽屉跳转订单详情页', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.locator('#nav').getByText('订单管理').click()
  await expect(page.getByTestId('orders-export')).toBeVisible()

  await page.getByTestId('orders-list').locator('tbody tr').first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('order-detail-link').click()

  await page.waitForURL('**/#/order-detail')
  await expect(page.getByTestId('order-page-header')).toContainText('SO-')
  await expect(page.getByTestId('order-detail-timeline').locator('oas-timeline-item')).not.toHaveCount(0)
  expect(errors).toEqual([])
})
