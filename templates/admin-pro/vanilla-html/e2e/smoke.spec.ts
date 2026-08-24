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

test('未登录访问任意路由跳转登录页', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await page.goto('/#/users')
  await expect(page.getByTestId('login-submit')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 登录 → 仪表盘统计卡渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await expect(page.getByTestId('stat-visits')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 全链路：用户管理新建/删除', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('用户管理').click()
  await expect(page.getByTestId('users-table')).toContainText('张伟')

  await page.getByTestId('user-create').click()
  await page.getByTestId('field-name').locator('input').fill('e2e新人')
  await page.getByTestId('field-email').locator('input').fill('e2e@example.com')
  await page.getByTestId('form-save').click()
  await expect(page.getByTestId('users-table')).toContainText('e2e新人')

  await page.getByTestId('users-table').getByText('e2e新人').first().click()
  await page.getByTestId('detail-delete').click()
  await page.locator('oas-popconfirm').locator('[part="ok"]').click()
  await expect(page.getByTestId('users-table')).not.toContainText('e2e新人')
  expect(errors).toEqual([])
})

test('viewer 访问受限页显示 403', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '李四', 'viewer')
  await page.goto('/#/users')
  await expect(page.getByText('无权访问该页面')).toBeVisible()
  expect(errors).toEqual([])
})

test('主题切换写 data-theme', async ({ page }) => {
  await login(page, '张伟', 'admin')
  await page.locator('#theme-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
