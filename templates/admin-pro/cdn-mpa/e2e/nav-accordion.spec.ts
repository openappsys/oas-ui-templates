// e2e/nav-accordion.spec.ts —— 侧栏手风琴开关（对齐 vanilla-html/e2e/nav-menu.spec.ts 手风琴段）
// MPA 适配：
// - localStorage 键前缀 oas-admin-cdn-mpa.*
// - 导航用 /settings.html（MPA 真实页面，非 hash）
// - 默认开（#nav 带 accordion）；预设关闭不带；设置中心开关实时翻转 #nav accordion 属性；
//   切到菜单条形态后开关不影响菜单渲染。
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 侧栏手风琴：默认开（#nav 带 accordion 属性）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await expect(page.locator('#nav')).toHaveAttribute('accordion', '')
  expect(errors).toEqual([])
})

test('admin 侧栏手风琴：预设关闭后 #nav 不带 accordion 属性', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  void page.addInitScript(() => {
    localStorage.setItem('oas-admin-cdn-mpa.sidebar-accordion', 'false')
  })
  await login(page)
  await expect(page.locator('#nav')).not.toHaveAttribute('accordion')
  expect(errors).toEqual([])
})

test('admin 侧栏手风琴：设置中心开关实时翻转 #nav accordion 属性', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  // 默认开
  await expect(page.locator('#nav')).toHaveAttribute('accordion', '')

  await page.goto('/settings.html')
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  const toggle = page.getByTestId('sidebar-accordion-toggle')
  await expect(toggle).toBeVisible()

  // 关 → 属性消失
  await toggle.click()
  await expect(page.locator('#nav')).not.toHaveAttribute('accordion')

  // 开 → 属性回来
  await toggle.click()
  await expect(page.locator('#nav')).toHaveAttribute('accordion', '')
  expect(errors).toEqual([])
})

test('admin 侧栏手风琴：切到菜单条形态后开关不影响菜单渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  // 预设菜单条 + 顶部形态：#nav 为 oas-menubar（横排），本无 accordion 属性
  void page.addInitScript(() => {
    localStorage.setItem('oas-admin-cdn-mpa.menu-style', 'menubar')
    localStorage.setItem('oas-admin-cdn-mpa.menu-position', 'top')
  })
  await login(page)
  await expect(page.locator('#nav')).toHaveAttribute('orientation', 'horizontal')

  await page.goto('/settings.html')
  await page.getByTestId('settings-tabs').getByText('布局与导航', { exact: true }).click()
  // 开关仍可点、不报错，菜单仍正常（oas-menubar 不受 accordion 影响）
  const toggle = page.getByTestId('sidebar-accordion-toggle')
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('#nav')).toHaveAttribute('orientation', 'horizontal')
  expect(errors).toEqual([])
})
