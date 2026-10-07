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

test('创作台：媒体库/预览/属性/多轨时间轴渲染', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="studio"]').click()
  const studio = page.locator('[data-testid="studio"]')
  await expect(studio).toBeVisible()
  await expect(studio.locator('.st-lib-item')).toHaveCount(7)
  await expect(studio.locator('.st-lane')).toHaveCount(4)
  await expect(page.getByTestId('st-preview')).toBeVisible()
  await expect(studio.locator('.st-clip')).toHaveCount(5)
})

test('创作台：素材点击添加到对应轨道 + clip 选中回填属性', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="studio"]').click()
  const studio = page.locator('[data-testid="studio"]')
  await expect(studio).toBeVisible()
  // 音频轨原 1 条，添加「旁白配音」后 2 条
  const audioLane = studio.locator('.st-lane-row[data-track="音频轨"]')
  await expect(audioLane.locator('.st-clip')).toHaveCount(1)
  await studio.locator('.st-lib-item', { hasText: '旁白配音' }).click()
  await expect(audioLane.locator('.st-clip')).toHaveCount(2)
  await expect(page.getByTestId('st-clip-name')).toContainText('旁白配音')
  await expect(page.getByTestId('st-clip-track')).toContainText('音频轨')
  // 时间轴点选已有 clip → 属性回填
  await studio.locator('.st-clip', { hasText: '城市航拍 4K' }).click()
  await expect(page.getByTestId('st-clip-name')).toContainText('城市航拍 4K')
  await expect(page.getByTestId('st-clip-range')).toContainText('0:00 →')
})

test('创作台：播放走带联动预览与播放头 + 侧栏分类过滤媒体库', async ({ page }) => {
  await page.goto('/')
  await page.locator('.act-btn[data-section="studio"]').click()
  const studio = page.locator('[data-testid="studio"]')
  await expect(studio).toBeVisible()
  // 播放：时间码推进 + 预览命中片段名
  await studio.locator('#st-play').click()
  await page.waitForTimeout(1300)
  await expect(page.getByTestId('st-time')).not.toContainText('0:00')
  await expect(page.locator('#st-screen-name')).toContainText('城市航拍')
  // 侧栏分类过滤：音频 → 媒体库只剩 2 项
  await page.locator('.side-item', { hasText: '音频' }).click()
  await expect(studio.locator('.st-lib-item')).toHaveCount(2)
})
