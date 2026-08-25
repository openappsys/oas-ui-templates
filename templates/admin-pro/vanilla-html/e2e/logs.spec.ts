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

test('admin 访问日志中心：虚拟列表与统计条渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/system/logs')
  await expect(page.getByTestId('logs-list')).toBeVisible()
  await expect(page.getByTestId('logs-anchor')).toBeVisible()
  await expect(page.locator('#logs-stats')).toContainText('今日新增')
  await expect(page.locator('#logs-stats')).toContainText('错误数')
  await expect(page.locator('#logs-stats')).toContainText('告警数')
  expect(errors).toEqual([])
})

test('admin 过滤 error 后列表 tag 为 danger 红色', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/system/logs')
  await expect(page.getByTestId('logs-list')).toBeVisible()

  await page.getByTestId('logs-level').click()
  await page.getByRole('option', { name: '错误' }).click()
  await expect(
    page.locator('oas-virtual-list [part="item"] oas-tag[type="danger"]').first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})
