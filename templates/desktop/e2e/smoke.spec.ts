import { expect, test } from '@playwright/test'

test('应用壳渲染：标题栏/菜单栏/活动栏/状态栏', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('titlebar')).toBeVisible()
  await expect(page.getByTestId('menubar')).toBeVisible()
  await expect(page.getByTestId('activity-bar')).toBeVisible()
  await expect(page.getByTestId('statusbar')).toContainText('就绪')
  await expect(page.locator('.act-btn')).toHaveCount(5)
})

test('活动栏切换：侧栏与内容区随 section 更新', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="orders"]').click()
  await expect(page.locator('.side-title')).toContainText('订单管理')
  await expect(page.getByTestId('content')).toContainText('SO-10001')
  await page.locator('.act-btn[data-section="users"]').click()
  await expect(page.locator('.side-title')).toContainText('用户管理')
  await expect(page.getByTestId('content')).toContainText('张伟')
})

test('菜单栏：视图 → 切换玻璃质感写 data-glass', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menubar').getByText('视图').click()
  await page.locator('.menu-pop-item').first().click()
  await expect(page.locator('html')).toHaveAttribute('data-glass', '')
  const stored = await page.evaluate(() => localStorage.getItem('oas-admin.settings.glass'))
  expect(stored).toBe('on')
})

test('标题栏：关闭弹出退出确认 → 取消留在应用；全屏按钮可点', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('win-close').click()
  await expect(page.locator('#quit-modal')).toHaveAttribute('visible', '')
  await page.getByTestId('quit-cancel').click()
  await expect(page.locator('#quit-modal')).not.toHaveAttribute('visible', '')
  await page.getByTestId('win-max').click()
  await page.waitForTimeout(400)
  const fs = await page.evaluate(() => document.fullscreenElement != null)
  expect(fs).toBe(true)
  await page.getByTestId('win-max').click()
})

test('设置：皮肤切换写 data-skin', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="settings"]').click()
  await page.locator('#dt-skin .chip[data-skin="violet"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'violet')
})

test('创作台：暗色工作站三栏 + 图表 + 传输条播放', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="studio"]').click()
  const studio = page.locator('[data-testid="studio"]')
  await expect(studio).toBeVisible()
  await expect(studio.locator('.st-lib-item')).toHaveCount(6)
  await expect(studio.locator('#st-chart-line')).toBeVisible()
  await studio.locator('.st-play').click()
  await page.waitForTimeout(1300)
  const time = await studio.locator('.st-time').first().textContent()
  expect(time).not.toBe('00:00')
})

test('创作台联动：侧栏切音轨 → 图表/传输条/素材库同步', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="studio"]').click()
  const studio = page.locator('[data-testid="studio"]')
  await expect(studio).toBeVisible()
  await expect(page.locator('[data-testid="st-trackname"]')).toContainText('人声主轨')
  await page.locator('.side-item[data-track="鼓组"]').click()
  await expect(page.locator('[data-testid="st-trackname"]')).toContainText('鼓组')
  await expect(studio.locator('.st-time').nth(1)).toContainText('03:38')
  await expect(studio.locator('.st-lib-item.is-active')).toContainText('鼓组')
  // 素材库点「贝斯」（无对应音轨）→ 仅选中态 + 属性面板反馈
  await studio.locator('.st-lib-item', { hasText: '贝斯' }).click()
  await expect(studio.locator('.st-props .st-panel-title')).toContainText('已加载「贝斯」')
})
