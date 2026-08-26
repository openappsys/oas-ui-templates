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

test('高级表单：页面加载并渲染高级控件', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('#/advanced-form')
  await expect(page.getByText('供应商信息登记')).toBeVisible()
  await expect(page.getByText('基本信息')).toBeVisible()
  await expect(page.getByText('联系方式')).toBeVisible()
  await expect(page.getByTestId('adv-staff')).toBeVisible()
  await expect(page.getByTestId('adv-pin')).toBeVisible()
  await expect(page.getByTestId('adv-rating')).toBeVisible()
  await expect(page.getByTestId('adv-tags')).toBeVisible()
  await expect(page.getByTestId('adv-transfer')).toBeVisible()
  expect(errors).toEqual([])
})

test('高级表单：空值提交触发必填校验拦截', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('#/advanced-form')
  await page.getByRole('button', { name: '提交登记' }).click()
  await expect(page.getByText('请输入公司名称')).toBeVisible()
  expect(errors).toEqual([])
})
