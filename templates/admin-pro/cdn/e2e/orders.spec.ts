// e2e/orders.spec.ts —— 订单管理用例（移植自 react/e2e/misc.spec.ts 订单段 + form.spec.ts
// 订单详情段，断言语义逐条对齐）：tabs 筛选与抽屉状态流转、CSV 导出、订单详情页跳转与流转
// 适配点：oas-page-header 的 title 为消费式属性（渲染进 shadow [part="title"]），
// 订单号断言走 shadow part；cdn 无角色系统，viewer 数据权限分支用例不移植
import { expect, test } from '@playwright/test'
import { beforeEachMock, login, noConsoleErrors, openNavItem } from './helpers'

beforeEachMock()

test('订单管理：tabs 筛选只显对应状态 + 抽屉状态流转', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openNavItem(page, '业务', '订单管理')
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
  }

  await rows.first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await expect(page.getByTestId('order-detail-action')).toBeVisible()
  await expect(page.getByTestId('order-detail-action')).toHaveText('标记已支付')
  await page.getByTestId('order-detail-action').click()
  await expect(page.getByTestId('order-detail-tag')).toHaveText('已支付')
  expect(errors).toEqual([])
})

test('订单管理：导出订单 CSV 触发下载', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openNavItem(page, '业务', '订单管理')
  // 等数据行就绪再导出：导出按钮先于异步数据可见，空数据分支只弹提示不下载
  await expect(
    page.getByTestId('orders-list').locator('tbody tr[part="row"]').first(),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('orders-export').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^orders-.*\.csv$/)
  expect(errors).toEqual([])
})

test('从订单详情抽屉跳转订单详情页（时间线渲染）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openNavItem(page, '业务', '订单管理')
  await expect(page.getByTestId('orders-export')).toBeVisible()

  // tbody 首个 tr 可能是合计行（amount 列 summary），数据行带 part="row" 才派发行点击
  await page.getByTestId('orders-list').locator('tbody tr[part="row"]').first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('order-detail-link').click()

  await page.waitForURL('**/#/order-detail')
  // oas-page-header title 为消费式属性：订单号写进 shadow [part="title"]
  await expect(page.getByTestId('order-page-header').locator('[part="title"]')).toContainText('SO-')
  await expect(
    page.getByTestId('order-detail-timeline').locator('oas-timeline-item'),
  ).not.toHaveCount(0)
  expect(errors).toEqual([])
})

test('订单详情页状态流转：已支付 → 配送中', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page)
  await openNavItem(page, '业务', '订单管理')
  await expect(page.getByTestId('orders-list').locator('tbody tr')).not.toHaveCount(0)

  // 种子数据中「云图软件」为已支付单：详情页应有「开始配送」流转动作
  await page.getByTestId('orders-list').locator('tbody tr', { hasText: '云图软件' }).first().click()
  await expect(page.getByTestId('order-drawer')).toHaveAttribute('visible', '')
  await page.getByTestId('order-detail-link').click()
  await page.waitForURL('**/#/order-detail')
  await expect(page.getByTestId('order-status-tag')).toHaveText('已支付')

  await page.getByTestId('order-detail-action').click()
  await expect(page.getByTestId('order-status-tag')).toHaveText('配送中')
  await expect(page.locator('oas-message').filter({ hasText: '开始配送' })).toBeVisible()
  expect(errors).toEqual([])
})
