import { expect, test } from '@playwright/test'

test('骨架渲染：app-bar + 底部导航 + 首页卡片流', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('oas-app-bar')).toContainText('OAS Mobile')
  await expect(page.getByTestId('bottom-nav')).toBeVisible()
  await expect(page.locator('#feed-list oas-card').first()).toBeVisible()
})

test('底部导航切换视图：首页 ↔ 我的', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#view-home')).toBeVisible()
  await page.locator('[data-testid="bottom-nav"]').getByText('我的').click()
  await expect(page.locator('#view-mine')).toBeVisible()
  await expect(page.locator('#view-home')).toBeHidden()
})

test('发布流：float-button 打开 bottom-sheet → 提交 → 首页顶部新增卡片', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="publish-fab"]').click()
  const sheet = page.locator('[data-testid="publish-sheet"]')
  await expect(sheet).toHaveAttribute('open', '')

  await page.getByTestId('publish-title').locator('input').fill('移动端首发测试')
  await page.getByTestId('publish-submit').click()
  await expect(sheet).not.toHaveAttribute('open', '')

  // 提交后切回首页，新卡片置顶
  await expect(page.locator('#feed-list oas-card').first()).toContainText('移动端首发测试')
})
