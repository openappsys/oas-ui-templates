// e2e/system.spec.ts —— 系统管理页用例（移植自 vanilla-html/e2e/system.spec.ts，断言语义逐条对齐）
// 本模版 /system/* 六页均已真实实现，viewer 403 用例可直接移植（此前 smoke 中用
// /products 代替的适配保持不动，避免破坏既有绿）
// 控件适配：oas-radio host 中心合成点击有死区——点击 shadow 内 input（vue 版实测结论）
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
  await page
    .locator('#rf-scope oas-radio')
    .filter({ hasText: '自定义数据' })
    .locator('input')
    .click()
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
