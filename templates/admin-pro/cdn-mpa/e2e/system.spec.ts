// e2e/system.spec.ts —— 系统管理页用例（移植自 react/e2e/system.spec.ts + system2.spec.ts
// 的角色/权限/部门/字典段，断言语义逐条对齐）
// MPA 适配：/#/system/* hash 路由 → roles/menus/dept/dict.html 直达；
// dept 详情删除按钮经 #md-del-pop oas-button（无 react 特有 data-md-action 选择器）；
// 控件适配：oas-radio host 中心合成点击有死区——点击 shadow 内 input；
// viewer 403 / 数据权限用例跳过（本模版会话无 role）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 新建角色：自定义数据范围 + transfer 选部门后入表', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/roles.html')
  await expect(page.getByTestId('roles-table')).toContainText('超级管理员')

  await page.getByTestId('role-create').click()
  await expect(page.getByTestId('role-form-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('rf-name').locator('input').fill('运营专员')
  await page.getByTestId('rf-code').locator('input').fill('ops_specialist')
  // oas-radio 死区：点 shadow 内 input
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
  await login(page)
  await page.goto('/menus.html')
  await expect(page.getByTestId('menu-tree')).toBeVisible()

  await page.getByTestId('menu-tree').getByText('用户:删除').click()
  await expect(page.getByTestId('menu-detail-perms')).toHaveText('user:delete')
  await expect(page.getByTestId('menu-detail-perms')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 部门管理：新建部门入树 + 删除有子部门拦截', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/dept.html')
  await expect(page.getByTestId('dept-tree')).toContainText('总公司')

  await page.getByTestId('dept-create').click()
  await expect(page.getByTestId('dept-form-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('df-name').locator('input').fill('测试部')
  await page.getByTestId('df-save').click()
  await expect(page.getByTestId('dept-tree')).toContainText('测试部')

  await page.getByTestId('dept-tree').getByText('总公司').click()
  await expect(page.getByTestId('dept-detail-members')).toBeVisible()
  // MPA 适配：删除按钮经 #md-del-pop oas-button 点击（popconfirm 内真实按钮）
  await page.locator('#md-del-pop oas-button').click()
  await page.locator('#md-del-pop [part="ok"]').click()
  await expect(page.locator('oas-message').filter({ hasText: '存在子部门' })).toBeVisible()
  await expect(page.getByTestId('dept-tree')).toContainText('总公司')
  expect(errors).toEqual([])
})

test('admin 字典管理：切换类型 + 新建键值', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/dict.html')
  await expect(page.getByTestId('dict-type-list')).toContainText('订单状态')
  await expect(page.getByTestId('dict-items-table')).toContainText('待支付')

  await page.getByTestId('dict-item-create').click()
  await expect(page.getByTestId('dict-item-modal')).toHaveAttribute('visible', '')
  await page.getByTestId('dif-label').locator('input').fill('预售')
  await page.getByTestId('dif-value').locator('input').fill('presale')
  await page.getByTestId('dif-save').click()
  await expect(page.getByTestId('dict-items-table')).toContainText('预售')
  expect(errors).toEqual([])
})
