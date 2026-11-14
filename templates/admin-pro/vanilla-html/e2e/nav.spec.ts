import { expect, test, type Page } from '@playwright/test'
import { openNavItem } from './helpers'

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

test('admin 折叠态 hover 分组弹出 flyout 子菜单（组件原生）', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)

  await page.locator('#nav [part="toggle"]').click()
  await expect(page.locator('oas-sider')).toHaveAttribute('collapsed', '')

  // 2.5.7 树形折叠态：分组父节点 hover 弹出 flyout 子菜单（叶子 role=menuitem 在浮层中可见）
  const group = page.locator('#nav [part="item"]').first()
  await group.hover()
  const leaf = page.locator('#nav [part="item"][role="menuitem"]').first()
  await expect(leaf).toBeVisible()
  await expect(leaf).toContainText('仪表盘')
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

test('admin 选中高亮随路由同步：aria-current 高亮项随路由迁移', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)

  await expect(page.locator('#nav')).toHaveAttribute('active', '/dashboard')
  await expect(page.locator('#nav [aria-current="page"]')).toContainText('仪表盘')

  await openNavItem(page, '业务', '用户管理')
  await expect(page.locator('#nav')).toHaveAttribute('active', '/users')
  await expect(page.locator('#nav [aria-current="page"]')).toContainText('用户管理')

  await openNavItem(page, '总览', '数据看板')
  await expect(page.locator('#nav')).toHaveAttribute('active', '/data-board')
  await expect(page.locator('#nav [aria-current="page"]')).toContainText('数据看板')
})

test('admin 侧栏数据大屏：新标签页打开 screen.html', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    openNavItem(page, '总览', '数据大屏'),
  ])
  await popup.waitForLoadState()
  expect(popup.url()).toContain('screen.html')
  await popup.close()
})

test('admin 数据大屏：history 模式二级路径下哨兵打开根下 /screen.html（非 /system/screen.html）', async ({
  page,
  context,
}) => {
  void page.addInitScript(() => {
    localStorage.setItem('oas-admin.router-mode', 'history')
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  // 导航到二级路径页面：history 模式 pushState，文档 URL 变 /system/logs
  await openNavItem(page, '系统', '日志中心')
  await expect(page).toHaveURL(/\/system\/logs$/)
  // 点「数据大屏」哨兵 → 新标签
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    openNavItem(page, '总览', '数据大屏'),
  ])
  await popup.waitForLoadState()
  // 修复前：相对 ./screen.html 在 /system/logs 下解析成 /system/screen.html（prod 404）；
  // 修复后：绝对 /screen.html（根部署正确）
  expect(new URL(popup.url()).pathname).toBe('/screen.html')
  await popup.close()
})
