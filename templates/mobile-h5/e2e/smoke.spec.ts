import { expect, test } from '@playwright/test'

test('骨架渲染：app-bar + 底部导航 + 首页卡片流', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('oas-app-bar')).toContainText('OAS Mobile')
  await expect(page.getByTestId('bottom-nav')).toBeVisible()
  await expect(page.locator('#feed-list oas-card').first()).toBeVisible()
})

test('hash 路由：底部导航切换 + 物理返回键回退', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#view-home')).toBeVisible()

  await page.locator('[data-testid="bottom-nav"]').getByText('我的').click()
  await expect(page).toHaveURL(/#\/mine/)
  await expect(page.locator('#view-mine')).toBeVisible()
  await expect(page.locator('#view-home')).toBeHidden()

  // 物理返回键语义：hash 回退到 #/home，首页恢复
  await page.goBack()
  await expect(page).toHaveURL(/#\/home/)
  await expect(page.locator('#view-home')).toBeVisible()
})

test('列表页：深链直达 + 搜索过滤 + chips 筛选', async ({ page }) => {
  await page.goto('/#/list')
  await expect(page.locator('#view-list')).toBeVisible()
  await expect(page.locator('#list-body oas-card').first()).toBeVisible()

  // 搜索：命中 2.5.7 发布卡片
  await page.getByTestId('list-search').locator('input').fill('2.5.7')
  await expect(page.locator('#list-body oas-card')).toHaveCount(1)
  await page.getByTestId('list-search').locator('input').fill('')

  // chips：只看「公告」
  await page.locator('[data-testid="list-chips"]').getByText('公告').click()
  await expect(page.locator('#list-body oas-card')).toHaveCount(1)
  await page.locator('[data-testid="list-chips"]').getByText('全部').click()
  await expect(page.locator('#list-body oas-card')).toHaveCount(3)
})

test('发布流：float-button 打开 bottom-sheet → 提交 → 首页顶部新增卡片', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="publish-fab"]').click()
  const sheet = page.locator('[data-testid="publish-sheet"]')
  await expect(sheet).toHaveAttribute('open', '')

  await page.getByTestId('publish-title').locator('input').fill('移动端首发测试')
  await page.getByTestId('publish-submit').click()
  await expect(sheet).not.toHaveAttribute('open', '')

  // 提交后路由切回首页，新卡片置顶；列表页同步可见（同源数据）
  await expect(page).toHaveURL(/#\/home/)
  await expect(page.locator('#feed-list oas-card').first()).toContainText('移动端首发测试')
  await page.goto('/#/list')
  await expect(page.locator('#list-body oas-card').first()).toContainText('移动端首发测试')
})
