// e2e/orders.spec.ts —— 订单管理 + 订单详情页用例
// （移植自 react/e2e/misc.spec.ts 订单段与 form.spec.ts 订单详情段，断言语义逐条对齐）
// MPA 适配：订单详情为独立 HTML 页（SPA 版是隐藏 hash 路由 /#/order-detail），
// 抽屉「查看完整详情」是真实导航，参数经 sessionStorage 传递；
// viewer 数据权限分支跳过（本模版会话无 role，恒走全量分支）
import { expect, test } from '@playwright/test'
import { login, mockOasRuntime, noConsoleErrors } from './_helpers'

test.beforeEach(({ page }) => mockOasRuntime(page))

test('admin 订单管理：tabs 筛选只显对应状态 + 抽屉状态流转', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/orders.html')
  await expect(page.getByTestId('orders-export')).toBeVisible()
  await expect(page.locator('#orders-stats').locator('oas-card')).toHaveCount(3)

  await page.getByTestId('orders-tabs').getByText('待支付').click()
  await expect(page.getByTestId('orders-tabs')).toHaveAttribute('active', 'pending')
  const rows = page.getByTestId('orders-list').locator('tbody tr[part="row"]')
  // oas-table 的 data 属性重渲染为异步——等行集全部变为「待支付」后再取行数（替代裸 count 竞态）
  await expect
    .poll(async () => {
      const texts = await rows.allTextContents()
      return texts.length > 0 && texts.every((t) => t.includes('待支付'))
    })
    .toBe(true)
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText('待支付')
    await expect(rows.nth(i).locator('oas-tag')).toHaveText('待支付')
  }

  await rows.first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await expect(page.getByTestId('order-detail-action')).toBeVisible()
  await expect(page.getByTestId('order-detail-action')).toHaveText('标记已支付')
  await page.getByTestId('order-detail-action').click()
  await expect(page.getByTestId('order-detail-tag')).toHaveText('已支付')
  expect(errors).toEqual([])
})

test('admin 导出订单 CSV 触发下载', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/orders.html')
  // 等行集渲染完成再导出（数据层 100ms 延迟，空数据只会弹「暂无导出」提示）
  await expect(
    page.getByTestId('orders-list').locator('tbody tr[part="row"]').first(),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('orders-export').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^orders-.*\.csv$/)
  expect(errors).toEqual([])
})

test('admin 订单抽屉「查看完整详情」真实导航到 order-detail.html', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await page.goto('/orders.html')
  await expect(
    page.getByTestId('orders-list').locator('tbody tr[part="row"]').first(),
  ).toBeVisible()

  // part="row" 行才派发 oas-row-click（tbody 内还有汇总行）
  await page.getByTestId('orders-list').locator('tbody tr[part="row"]').first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  // MPA 等价断言：SPA waitForURL('**/#/order-detail') → HTML 直达真实导航
  await page.getByTestId('order-detail-link').click()
  await page.waitForURL(/order-detail\.html$/)
  // 页头标题为订单号（消费式属性 → shadow [part~=title]）
  await expect(page.getByTestId('order-page-header').locator('[part~="title"]')).toContainText(
    'SO-',
  )
  await expect(
    page.getByTestId('order-detail-timeline').locator('oas-timeline-item'),
  ).not.toHaveCount(0)
  expect(errors).toEqual([])
})
