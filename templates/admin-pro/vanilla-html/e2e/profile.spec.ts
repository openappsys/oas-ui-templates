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

test('个人中心：主题卡切换写 data-theme', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/profile')

  await page.getByRole('button', { name: '深色主题' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('button', { name: '浅色主题' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: '跟随系统' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  expect(errors).toEqual([])
})

test('设置中心：主题色按明暗主题独立存储并联动生效', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/settings')
  await page.getByTestId('settings-tabs').getByText('外观').click()

  // 浅色主题下设主题色 → 存到 .theme.light
  await page.locator('html').evaluate(() => {
    document.documentElement.dataset.theme = 'light'
  })
  const picker = page.getByTestId('appearance-color')
  await picker.evaluate((el: HTMLElement) => {
    el.setAttribute('value', '#7c3aed')
    el.dispatchEvent(new CustomEvent('oas-change', { detail: { value: '#7c3aed' }, bubbles: true }))
  })
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin.settings.theme.light')),
  ).toBe('#7c3aed')

  // 切到深色：dark 未设置，light 存储保留（独立存储，互不覆盖）
  await page.locator('html').evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
    document.dispatchEvent(new Event('themechange'))
  })
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin.settings.theme.light')),
  ).toBe('#7c3aed')
  expect(
    await page.evaluate(() => localStorage.getItem('oas-admin.settings.theme.dark')),
  ).toBeNull()
  expect(errors).toEqual([])
})
