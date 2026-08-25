import { expect, test, type Page } from '@playwright/test'

async function login(page: Page, name = '张伟', role?: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  if (role) {
    await page.getByTestId('login-role').click()
    await page.getByText(role, { exact: true }).click()
  }
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('403：访客访问 admin 路由跳 forbidden 页', async ({ page }) => {
  await login(page, '李四', '访客（只读）')
  await page.goto('#/system/roles')
  await expect(page).toHaveURL(/#\/forbidden/)
  await expect(page.getByText('无权访问该页面')).toBeVisible()
})

test('404：未知路由跳 not-found 页', async ({ page }) => {
  await login(page)
  await page.goto('#/no-such-page')
  await expect(page).toHaveURL(/#\/not-found/)
  await expect(page.getByText('页面不存在')).toBeVisible()
})

test('基础表单：空值提交触发必填校验', async ({ page }) => {
  await login(page)
  await page.goto('#/basic-form')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
})
