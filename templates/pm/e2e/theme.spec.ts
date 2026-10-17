import { expect, test } from '@playwright/test'

test('T1 默认跟随系统色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('theme-toggle')).toHaveText('跟随系统')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('theme-toggle')).toHaveText('跟随系统')
})

test('T2 切换到深色并持久化', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const toggle = page.getByTestId('theme-toggle')
  await expect(toggle).toBeVisible({ timeout: 10_000 })
  await toggle.click()
  await expect(toggle).toHaveText('浅色')
  await toggle.click()
  await expect(toggle).toHaveText('深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.getByTestId('theme-toggle')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('theme-toggle')).toHaveText('深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('T3 循环三态：跟随系统 → 浅色 → 深色 → 跟随系统', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const toggle = page.getByTestId('theme-toggle')
  await expect(toggle).toBeVisible({ timeout: 10_000 })
  await expect(toggle).toHaveText('跟随系统')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')

  await toggle.click()
  await expect(toggle).toHaveText('浅色')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')

  await toggle.click()
  await expect(toggle).toHaveText('深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await toggle.click()
  await expect(toggle).toHaveText('跟随系统')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('oas-pm-theme'))).toBe('system')
})
