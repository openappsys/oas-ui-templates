// e2e/logs.spec.ts —— 日志中心用例（移植自 react/e2e/logs.spec.ts，断言语义逐条对齐）：
// 虚拟列表 + 统计条渲染、级别筛选后 danger tag
import { expect, test } from '@playwright/test'
import { beforeEachMock, login, noConsoleErrors } from './helpers'

beforeEachMock()

test('日志中心：虚拟列表与统计条渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/logs')
  await expect(page.getByTestId('logs-list')).toBeVisible()
  await expect(page.getByTestId('logs-anchor')).toBeVisible()
  await expect(page.locator('#logs-stats')).toContainText('今日新增')
  await expect(page.locator('#logs-stats')).toContainText('错误数')
  await expect(page.locator('#logs-stats')).toContainText('告警数')
  expect(errors).toEqual([])
})

test('过滤 error 后列表 tag 为 danger 红色', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/#/system/logs')
  await expect(page.getByTestId('logs-list')).toBeVisible()

  await page.getByTestId('logs-level').click()
  await page.getByRole('option', { name: '错误' }).click()
  await expect(
    page.locator('oas-virtual-list [part="item"] oas-tag[type="danger"]').first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})
