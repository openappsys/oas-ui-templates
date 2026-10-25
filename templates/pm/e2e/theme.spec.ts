import { expect, test } from '@playwright/test'
import { closeSettings, openSettings, settingsAction } from './menus'

// 播种规模：本 spec 只验主题，不验数据量——e2e 统一 5K（$12 万），避免每用例重播 10 万条
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oas-pm-seed-size', '5000'))
})

/** 主题菜单项（oas-dropdown 内层渲染的 menuitem；宿主 testid 是数据载体） */
const themeItem = (page: Parameters<typeof openSettings>[0]) => settingsAction(page, /主题/)

test('T1 默认跟随系统色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await openSettings(page)
  await expect(themeItem(page)).toContainText('跟随系统')
  await expect(page.getByTestId('theme-toggle')).toContainText('跟随系统')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  await expect(themeItem(page)).toContainText('跟随系统')
})

test('T2 切换到深色并持久化', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await openSettings(page)
  await themeItem(page).click()
  await expect(themeItem(page)).toContainText('浅色')
  await themeItem(page).click()
  await expect(themeItem(page)).toContainText('深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // 原生控件（勾选框/滚动条）配色跟随主题：由 upstream theme 的 [data-theme=dark] 提供，
  // 宿主不再补 color-scheme（摘除回归守卫）
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe('dark')
  await closeSettings(page)
  await page.reload()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await openSettings(page)
  await expect(themeItem(page)).toContainText('深色')
})

test('T3 循环三态：跟随系统 → 浅色 → 深色 → 跟随系统', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await openSettings(page)
  await expect(themeItem(page)).toContainText('跟随系统')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')

  await themeItem(page).click()
  await expect(themeItem(page)).toContainText('浅色')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')

  await themeItem(page).click()
  await expect(themeItem(page)).toContainText('深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await themeItem(page).click()
  await expect(themeItem(page)).toContainText('跟随系统')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('oas-pm-theme'))).toBe('system')
})
