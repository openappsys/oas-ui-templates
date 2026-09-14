// e2e/data-board.spec.ts —— 数据看板用例（react 版无独立看板 spec，本文件按页面补齐核心流程，
// 图表渲染断言口径与 smoke.spec.ts 的 #chart-trend svg 断言一致）
// MPA 适配：SPA hash 路由 → data-board.html 直达；viewer 分支跳过（本模版会话无 role）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 数据看板：统计卡、图表与季度目标进度条渲染', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/data-board.html')

  // 统计卡：4 张（2 张数字动画 + 2 张 oas-statistic）
  await expect(page.locator('#board-grid').locator('oas-card')).toHaveCount(4)
  await expect(page.getByTestId('anim-gmv')).toBeVisible()
  await expect(page.getByTestId('stat-users')).toBeVisible()
  await expect(page.locator('#board-grid')).toContainText('总销售额')

  // 三类图表：柱状 / 饼图 / 堆叠柱，svg 内容非空
  for (const id of ['chart-bar', 'chart-pie', 'chart-stacked']) {
    await expect(page.locator(`#${id} svg`)).toBeVisible()
  }
  await expect(page.locator('#chart-bar svg path, #chart-bar svg rect').first()).toBeVisible()

  // 季度目标进度条：JS 灌 value（72 / 58 / 85）
  await expect(page.getByTestId('board-progress-order')).toHaveAttribute('value', '72')
  await expect(page.getByTestId('board-progress-revenue')).toHaveAttribute('value', '58')
  await expect(page.getByTestId('board-progress-users')).toHaveAttribute('value', '85')
  expect(errors).toEqual([])
})
