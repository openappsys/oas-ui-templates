// e2e/nav-accordion.spec.ts —— 侧栏手风琴开关（对齐 vanilla-html/e2e/nav-menu.spec.ts 手风琴段）
// 默认开（#nav 带 accordion）；预设关闭不带；设置中心开关实时翻转 #nav accordion 属性；
// 切到菜单条形态后开关不影响菜单渲染。
import { expect, test, type Page } from '@playwright/test'

async function login(page: Page, name: string): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('admin 侧栏手风琴：默认开（#nav 带 accordion 属性）', async ({ page }) => {
  await login(page, '张伟')
  await expect(page.locator('#nav')).toHaveAttribute('accordion', '')
})

test('admin 侧栏手风琴：预设关闭后 #nav 不带 accordion 属性', async ({ page }) => {
  void page.addInitScript(() => {
    localStorage.setItem('oas-admin.sidebar-accordion', 'false')
  })
  await login(page, '张伟')
  await expect(page.locator('#nav')).not.toHaveAttribute('accordion')
})

test('admin 侧栏手风琴：设置中心开关实时翻转 #nav accordion 属性', async ({ page }) => {
  await login(page, '张伟')
  // 默认开
  await expect(page.locator('#nav')).toHaveAttribute('accordion', '')

  await page.goto('/#/settings')
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  const toggle = page.getByTestId('sidebar-accordion-toggle')
  await expect(toggle).toBeVisible()

  // 关 → 属性消失
  await toggle.click()
  await expect(page.locator('#nav')).not.toHaveAttribute('accordion')

  // 开 → 属性回来
  await toggle.click()
  await expect(page.locator('#nav')).toHaveAttribute('accordion', '')
})

test('admin 侧栏手风琴：切到菜单条形态后开关不影响菜单渲染', async ({ page }) => {
  // 预设菜单条 + 顶部形态：#nav 为 oas-menubar（横排），本无 accordion 属性
  void page.addInitScript(() => {
    localStorage.setItem('oas-admin.menu-style', 'menubar')
    localStorage.setItem('oas-admin.menu-position', 'top')
  })
  await login(page, '张伟')
  await expect(page.locator('#nav')).toHaveAttribute('orientation', 'horizontal')

  await page.goto('/#/settings')
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  // 开关仍可点、不报错，菜单仍正常（oas-menubar 不受 accordion 影响）
  const toggle = page.getByTestId('sidebar-accordion-toggle')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('#nav')).toHaveAttribute('orientation', 'horizontal')
})
