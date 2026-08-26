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

test('admin 通知中心：登录后 badge 显示未读数 3', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await expect(page.locator('#notif-badge')).toHaveAttribute('value', '3')
  await expect(page.locator('#notif-badge [part="badge"]')).toHaveText('3')
  expect(errors).toEqual([])
})

test('admin 通知中心：抽屉打开后列表渲染且未读项带 is-unread', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#notif-toggle').click()
  await expect(page.locator('#notif-drawer')).toHaveAttribute('visible', '')
  await expect(page.locator('#notif-list oas-list-item')).toHaveCount(5)
  await expect(page.locator('#notif-list oas-list-item.is-unread')).toHaveCount(3)
  await expect(page.locator('#notif-list')).toContainText('系统公告')
  expect(errors).toEqual([])
})

test('admin 通知中心：点击单条未读标记已读且 badge 减一', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#notif-toggle').click()
  await page.locator('#notif-list oas-list-item.is-unread').first().click()
  await expect(page.locator('#notif-list oas-list-item.is-unread')).toHaveCount(2)
  await expect(page.locator('#notif-badge')).toHaveAttribute('value', '2')
  expect(errors).toEqual([])
})

test('admin 通知中心：全部已读后 badge 归零且按钮禁用', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#notif-toggle').click()
  await page.locator('#notif-readall').click()
  await expect(page.locator('#notif-list oas-list-item.is-unread')).toHaveCount(0)
  await expect(page.locator('#notif-badge')).toHaveAttribute('value', '0')
  await expect(page.locator('#notif-readall')).toBeDisabled()
  expect(errors).toEqual([])
})
