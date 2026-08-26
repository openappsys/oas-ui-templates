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

test('数据看板：渲染统计卡与数字滚动', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('#/data-board')
  await expect(page.locator('.page-title')).toHaveText('数据看板')
  await expect(page.getByTestId('anim-orders')).toBeVisible()
  await expect(page.getByTestId('anim-gmv')).toBeVisible()
  await expect(page.getByTestId('stat-users')).toBeVisible()
  await expect(page.getByTestId('stat-conversion')).toBeVisible()
  expect(errors).toEqual([])
})

test('数据看板：刷新按钮可点击且不报错', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('#/data-board')
  await page.getByRole('button', { name: '刷新' }).click()
  await expect(page.getByTestId('anim-orders')).toBeVisible()
  expect(errors).toEqual([])
})
