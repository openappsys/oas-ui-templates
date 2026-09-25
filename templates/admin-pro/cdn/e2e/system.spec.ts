// e2e/system.spec.ts —— 系统管理页用例一（移植自 react/e2e/system.spec.ts + system2.spec.ts
// 部门段，断言语义逐条对齐）：角色新建（transfer）/ 权限树详情 / 部门新建与删除拦截
// 适配点：cdn 会话无 role 字段——react 版「viewer 访问角色管理显示 403」不移植
//（路由 meta.roles 保留但守卫未启用，见 cdn routes.js 注释）；
// oas-radio host 中心合成点击有死区——点击 shadow 内 input
import { expect, test } from '@playwright/test'
import { beforeEachMock, login, noConsoleErrors, openNavItem } from './helpers'

beforeEachMock()

test('新建角色：自定义数据范围 + transfer 选部门后入表', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openNavItem(page, '系统', '角色管理')
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

test('权限树选中按钮节点：详情卡显示权限标识', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openNavItem(page, '系统', '权限管理')
  await expect(page.getByTestId('menu-tree')).toBeVisible()

  await page.getByTestId('menu-tree').getByText('用户:删除').click()
  await expect(page.getByTestId('menu-detail-perms')).toHaveText('user:delete')
  await expect(page.getByTestId('menu-detail-perms')).toBeVisible()
  expect(errors).toEqual([])
})

test('部门管理：新建部门入树 + 删除有子部门拦截', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/dept')
  await expect(page.getByTestId('dept-tree')).toContainText('总公司')

  await page.getByTestId('dept-create').click()
  await expect(page.getByTestId('dept-form-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('df-name').locator('input').fill('测试部')
  await page.getByTestId('df-save').click()
  await expect(page.getByTestId('dept-tree')).toContainText('测试部')

  await page.getByTestId('dept-tree').getByText('总公司').click()
  await expect(page.getByTestId('dept-detail-members')).toBeVisible()
  await page.locator('[data-md-action="delete"]').click()
  await page.locator('#md-del-pop [part="ok"]').click()
  await expect(page.locator('oas-message').filter({ hasText: '存在子部门' })).toBeVisible()
  await expect(page.getByTestId('dept-tree')).toContainText('总公司')
  expect(errors).toEqual([])
})
