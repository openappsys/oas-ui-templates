import { expect, test } from '@playwright/test'

test('桌面渲染：壁纸 + 图标 + 任务栏时钟', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('desktop-icons')).toBeVisible()
  await expect(page.locator('.desktop-icon')).toHaveCount(4)
  const clock = await page.locator('#task-clock').textContent()
  expect(clock?.trim()).toMatch(/^\d{2}:\d{2}$/)
})

test('开窗：桌面图标打开窗口 → 焦点层级 → 关闭', async ({ page }) => {
  await page.goto('/')
  await page.locator('.desktop-icon[data-app="dashboard"]').click()
  await expect(page.locator('[data-testid="window-dashboard"]')).toBeVisible()
  // 再开一个，前置其上；关闭后从任务栏消失
  await page.locator('.desktop-icon[data-app="orders"]').click()
  await expect(page.locator('[data-testid="window-orders"]')).toBeVisible()
  await expect(page.locator('.task-item')).toHaveCount(2)
  await page.locator('[data-testid="window-orders"] [data-act="close"]').click()
  await expect(page.locator('[data-testid="window-orders"]')).toHaveCount(0)
  await expect(page.locator('.task-item')).toHaveCount(1)
})

test('窗口管理：最小化进任务栏 → 任务栏还原 → 最大化铺满', async ({ page }) => {
  await page.goto('/')
  await page.locator('.desktop-icon[data-app="orders"]').click()
  const win = page.locator('[data-testid="window-orders"]')
  await expect(win).toBeVisible()
  await win.locator('[data-act="min"]').click()
  await expect(win).toBeHidden()
  await page.locator('.task-item[data-app="orders"]').click()
  await expect(win).toBeVisible()
  await win.locator('[data-act="max"]').click()
  await expect(win).toHaveClass(/is-maximized/)
})

test('拖动：标题栏拖拽后窗口位置改变', async ({ page }) => {
  await page.goto('/')
  await page.locator('.desktop-icon[data-app="users"]').click()
  const win = page.locator('[data-testid="window-users"]')
  await expect(win).toBeVisible()
  const before = await win.boundingBox()
  await page.locator('[data-testid="window-users"] .titlebar').hover()
  await page.mouse.down()
  await page.mouse.move((before?.x ?? 100) + 560, (before?.y ?? 100) + 120, { steps: 8 })
  await page.mouse.up()
  const after = await win.boundingBox()
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeGreaterThan(100)
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeGreaterThan(60)
})

test('设置窗口：皮肤切换写 data-skin + 玻璃开关写 data-glass', async ({ page }) => {
  await page.goto('/')
  await page.locator('.desktop-icon[data-app="settings"]').click()
  const win = page.locator('[data-testid="window-settings"]')
  await expect(win).toBeVisible()
  await win.locator('#dt-skin .chip[data-skin="violet"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'violet')
  await win.locator('#dt-glass').click()
  await expect(page.locator('html')).toHaveAttribute('data-glass', '')
})
