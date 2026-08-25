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

test('admin 新建角色：自定义数据范围 + transfer 选部门后入表', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('角色管理').click()
  await expect(page.getByTestId('roles-table')).toContainText('超级管理员')

  await page.getByTestId('role-create').click()
  await expect(page.getByTestId('role-form-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('rf-name').locator('input').fill('运营专员')
  await page.getByTestId('rf-code').locator('input').fill('ops_specialist')
  await page.locator('#rf-scope oas-radio').filter({ hasText: '自定义数据' }).click()
  await expect(page.getByTestId('rf-transfer')).toBeVisible()

  const transfer = page.getByTestId('rf-transfer')
  await transfer.locator('[part="option"]').filter({ hasText: '技术部' }).click()
  await transfer.locator('[part="option"]').filter({ hasText: '市场部' }).click()
  await transfer.locator('[part="actions"] button.to-right').click()

  await page.getByTestId('rf-save').click()
  await expect(page.getByTestId('roles-table')).toContainText('运营专员')
  await expect(page.getByTestId('roles-table')).toContainText('ops_specialist')
  expect(errors).toEqual([])
})

test('admin 权限树选中按钮节点：详情卡显示权限标识', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('权限管理').click()
  await expect(page.getByTestId('menu-tree')).toBeVisible()

  await page.getByTestId('menu-tree').getByText('用户:删除').click()
  await expect(page.getByTestId('menu-detail-perms')).toHaveText('user:delete')
  await expect(page.getByTestId('menu-detail-perms')).toBeVisible()
  expect(errors).toEqual([])
})

test('viewer 访问角色管理显示 403', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '李四', 'viewer')
  await page.goto('/#/system/roles')
  await expect(page.getByText('无权访问该页面')).toBeVisible()
  expect(errors).toEqual([])
})
