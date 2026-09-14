// e2e/errors.spec.ts —— 错误页用例（react 版 403 为 viewer 分支用例，本模版无角色体系，
// 错误页改为静态 HTML 直达的核心流程验证：文案渲染 + 返回首页导航）
// MPA 适配：SPA hash 路由 → forbidden / not-found / 500.html 直达（真实浏览器导航）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('403 页渲染无权访问文案，返回首页回 dashboard', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/forbidden.html')
  await expect(page.locator('h1.notice-title')).toHaveText('无权访问该页面')
  await page.locator('[data-action="home"]').click()
  await page.waitForURL(/dashboard\.html$/)
  await expect(page.getByTestId('stat-visits')).toBeVisible()
  expect(errors).toEqual([])
})

test('404 / 500 页各自渲染对应文案', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)

  await page.goto('/not-found.html')
  await expect(page.locator('h1.notice-title')).toHaveText('页面不存在')

  await page.goto('/500.html')
  await expect(page.locator('h1.notice-title')).toHaveText('页面加载失败')
  expect(errors).toEqual([])
})
