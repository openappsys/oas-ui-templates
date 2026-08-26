import { expect, test, type Page } from '@playwright/test'

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function login(page: Page, name: string, role: 'admin' | 'viewer'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  if (role === 'viewer') {
    await page.getByTestId('login-role').click()
    await page.getByText('访客（只读）').click()
  }
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('admin 商品持久化：新建后 reload 仍在（localStorage 生效）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page.getByTestId('product-grid')).toContainText('无线降噪耳机')

  await page.getByTestId('product-create').click()
  await page.getByTestId('pf-name').locator('input').fill('持久化商品')
  await page.getByTestId('pf-price').locator('input').fill('199')
  await page.getByTestId('pf-save').click()
  await expect(page.getByTestId('product-grid')).toContainText('持久化商品')

  await page.reload()
  await expect(page.getByTestId('product-grid')).toContainText('持久化商品')
  expect(errors).toEqual([])
})

test('admin 仪表盘热销 Top5 卡可见且首行销量最大', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await expect(page.getByTestId('top5-list')).toBeVisible()
  const rows = page.getByTestId('top5-list').locator('.top5-row')
  await expect(rows).toHaveCount(5)
  const solds = await rows.evaluateAll((els) =>
    els.map((el) => {
      const text = el.querySelector('.top5-sold')?.textContent ?? ''
      return Number(text)
    }),
  )
  expect(solds.every((n) => Number.isFinite(n))).toBe(true)
  expect(solds[0]).toBe(Math.max(...solds))
  expect(errors).toEqual([])
})

test('admin 仪表盘 oas-chart 图表渲染（area 趋势 + donut 环形 + 图例）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  const trend = page.locator('#chart-trend')
  await expect(trend.locator('svg .area-path')).toHaveCount(1)
  await expect(trend.locator('svg .line-path')).toHaveCount(1)
  await expect(trend.locator('svg .dot')).toHaveCount(7)
  const donut = page.locator('#chart-orders')
  await expect(donut.locator('svg .slice')).toHaveCount(4)
  await expect(page.getByTestId('donut-legend').locator('.donut-legend-item')).toHaveCount(4)
  await expect(page.getByTestId('donut-legend')).toContainText('1,926')
  expect(errors).toEqual([])
})

test('admin 仪表盘 7/14/30 天切换全联动（趋势/订单构成/最近订单）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  const trend = page.locator('#chart-trend')
  await expect(trend.locator('svg .dot')).toHaveCount(7)
  await expect(page.getByTestId('donut-legend')).toContainText('1,926')
  await expect(page.getByTestId('orders-table').locator('tbody tr')).toHaveCount(5)

  await page.locator('#trend-range').getByText('14日').click()
  await expect(trend.locator('svg .dot')).toHaveCount(14)
  await expect(page.getByTestId('donut-legend')).toContainText('3,417')
  await expect(page.getByTestId('orders-table').locator('tbody tr')).toHaveCount(7)

  await page.locator('#trend-range').getByText('30日').click()
  await expect(trend.locator('svg .dot')).toHaveCount(30)
  await expect(page.getByTestId('donut-legend')).toContainText('6,208')
  await expect(page.getByTestId('orders-table').locator('tbody tr')).toHaveCount(11)
  const axisLabels = await trend
    .locator('svg text.axis-label')
    .evaluateAll((els) => els.map((el) => el.textContent ?? '').filter((text) => text.length > 0))
  expect(axisLabels).toEqual(['1日', '5日', '10日', '15日', '20日', '25日', '30日'])
  expect(errors).toEqual([])
})

test('admin Command 面板 Ctrl+K 输「订单」Enter 直达 /orders', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.keyboard.press('Control+k')
  await expect(page.locator('#command')).toHaveAttribute('open', '')
  await page.locator('#command input[part="search"]').fill('订单')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/orders/)
  expect(errors).toEqual([])
})

test('admin 面包屑新页显示 应用 / 创建订单', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('创建订单').click()
  await expect(page.getByTestId('form-steps')).toBeVisible()
  await expect(page.locator('#crumbs')).toContainText('应用')
  await expect(page.locator('#crumbs')).toContainText('创建订单')
  expect(errors).toEqual([])
})
