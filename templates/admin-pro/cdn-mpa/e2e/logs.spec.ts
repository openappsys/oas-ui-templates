// e2e/logs.spec.ts —— 访问日志中心用例（移植自 react/e2e/logs.spec.ts，
// 断言语义逐条对齐）：虚拟列表 + 统计条渲染、级别筛选后 danger tag
// MPA 适配：/#/system/logs → logs.html 直达；viewer 分支跳过（本模版会话无 role）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 访问日志中心：虚拟列表与统计条渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/logs.html')
  await expect(page.getByTestId('logs-list')).toBeVisible()
  await expect(page.getByTestId('logs-anchor')).toBeVisible()
  await expect(page.locator('#logs-stats')).toContainText('今日新增')
  await expect(page.locator('#logs-stats')).toContainText('错误数')
  await expect(page.locator('#logs-stats')).toContainText('告警数')
  expect(errors).toEqual([])
})

test('admin 过滤 error 后列表 tag 为 danger 红色', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/logs.html')
  await expect(page.getByTestId('logs-list')).toBeVisible()

  await page.getByTestId('logs-level').click()
  await page.getByRole('option', { name: '错误' }).click()
  // 虚拟列表按 items 重渲染为异步——first() + toBeVisible 自动重试兜底
  await expect(
    page.locator('oas-virtual-list [part="item"] oas-tag[type="danger"]').first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})
