import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill('张伟')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

async function siderWidth(page: Page): Promise<number> {
  return page.locator('oas-sider').evaluate((el) => Math.round(el.getBoundingClientRect().width))
}

async function contentWidth(page: Page): Promise<number> {
  return page.locator('.content-col').evaluate((el) => Math.round(el.getBoundingClientRect().width))
}

test('admin 桌面侧栏折叠收窄到 64px，再展开恢复 200px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  await expect(page.locator('#nav-toggle')).toBeHidden()
  expect(await siderWidth(page)).toBe(200)
  const contentBefore = await contentWidth(page)

  await page.locator('#nav [part="toggle"]').click()
  await expect(page.locator('oas-sider')).toHaveAttribute('collapsed', '')
  await expect.poll(() => siderWidth(page)).toBe(64)
  await expect(page.locator('#nav [part="toggle"]')).toHaveText('»')
  expect(await contentWidth(page)).toBeGreaterThan(contentBefore)

  await page.locator('#nav [part="toggle"]').click()
  await expect(page.locator('oas-sider')).not.toHaveAttribute('collapsed', '')
  await expect.poll(() => siderWidth(page)).toBe(200)
})

test('admin 移动端抽屉开合：汉堡打开、遮罩关闭、Esc 关闭', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 })
  await login(page)
  await expect(page.locator('#nav-toggle')).toBeVisible()
  expect(await siderWidth(page)).toBe(0)
  await expect(page.locator('#nav')).toHaveAttribute('data-mobile', 'true')

  await page.locator('#nav-toggle').click()
  await expect(page.locator('#nav')).toHaveAttribute('drawer-open', '')

  await page.locator('#nav [part="mask"]').click()
  await expect(page.locator('#nav')).not.toHaveAttribute('drawer-open', '')

  await page.locator('#nav-toggle').click()
  await expect(page.locator('#nav')).toHaveAttribute('drawer-open', '')

  await page.keyboard.press('Escape')
  await expect(page.locator('#nav')).not.toHaveAttribute('drawer-open', '')
})

test('admin 断点切换：500px 汉堡可见，800px 隐藏并恢复侧栏', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 })
  await login(page)
  await expect(page.locator('#nav-toggle')).toBeVisible()
  expect(await siderWidth(page)).toBe(0)

  await page.setViewportSize({ width: 800, height: 800 })
  await expect(page.locator('#nav-toggle')).toBeHidden()
  await expect(page.locator('#nav')).not.toHaveAttribute('data-mobile')
  await expect.poll(() => siderWidth(page)).toBe(200)
})

test('admin 选中高亮随路由同步：active 属性随路由迁移', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)

  await expect(page.locator('#nav')).toHaveAttribute('active', '/dashboard')

  await page.locator('#nav').getByText('用户管理').click()
  await expect(page.locator('#nav')).toHaveAttribute('active', '/users')

  await page.locator('#nav').getByText('个人中心').click()
  await expect(page.locator('#nav')).toHaveAttribute('active', '/profile')
})
