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
  await expect(page.locator('.notice-code')).toHaveText('403')
  await expect(page.locator('.notice-title')).toHaveText('无权访问该页面')
  await expect(page.locator('.notice-actions [data-action="back"]')).toBeVisible()
  await expect(page.locator('.notice-actions [data-action="home"]')).toBeVisible()
  await page.locator('.notice-actions [data-action="home"]').click()
  await expect(page).toHaveURL(/#\/dashboard/)
})

test('404：未知路由跳 not-found 页', async ({ page }) => {
  await login(page)
  await page.goto('#/no-such-page')
  await expect(page).toHaveURL(/#\/not-found/)
  await expect(page.locator('.notice-code')).toHaveText('404')
  await expect(page.locator('.notice-title')).toHaveText('页面不存在')
  await expect(page.locator('.notice-actions [data-action="back"]')).toBeVisible()
  await expect(page.locator('.notice-actions [data-action="home"]')).toBeVisible()
  await page.locator('.notice-actions [data-action="home"]').click()
  await expect(page).toHaveURL(/#\/dashboard/)
})

test('500：直达错误页并展示大号状态码', async ({ page }) => {
  await login(page)
  await page.goto('#/500')
  await expect(page.locator('.notice-code')).toHaveText('500')
  await expect(page.locator('.notice-title')).toHaveText('页面加载失败')
  await expect(page.locator('.notice-actions [data-action="back"]')).toBeVisible()
  await expect(page.locator('.notice-actions [data-action="home"]')).toBeVisible()
  await page.locator('.notice-actions [data-action="home"]').click()
  await expect(page).toHaveURL(/#\/dashboard/)
})

test('错误页：home 按钮文案随语言切换', async ({ page }) => {
  await login(page)
  await page.goto('#/not-found')
  await expect(page.locator('.notice-actions [data-action="home"]')).toContainText('返回首页')
  await expect(page.locator('.notice-actions [data-action="back"]')).toContainText('返回上一页')
  await page.locator('#lang-menu').hover()
  await page.locator('#lang-menu').getByText('English').click()
  await expect(page.locator('.notice-actions [data-action="home"]')).toContainText('Back Home')
  await expect(page.locator('.notice-actions [data-action="back"]')).toContainText('Go Back')
})

test('示例分组：侧栏提供错误页入口并可导航', async ({ page }) => {
  await login(page)
  await expect(page.locator('#nav')).toContainText('示例')
  await page.locator('#nav').getByText('无权访问').click()
  await expect(page).toHaveURL(/#\/forbidden/)
  await expect(page.locator('.notice-code')).toHaveText('403')
  await page.locator('#nav').getByText('页面不存在').click()
  await expect(page).toHaveURL(/#\/not-found/)
  await expect(page.locator('.notice-code')).toHaveText('404')
  await page.locator('#nav').getByText('页面加载失败').click()
  await expect(page).toHaveURL(/#\/500/)
  await expect(page.locator('.notice-code')).toHaveText('500')
})

test('基础表单：空值提交触发必填校验', async ({ page }) => {
  await login(page)
  await page.goto('#/basic-form')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('#basic-form')).toContainText('请输入项目名称')
})
