import { expect, test, type Page } from '@playwright/test'

/**
 * 收集 console error + pageerror（返回活引用数组，断言时已累积全部）。
 * 正常路径下 world.geojson（public/）与 maplibre worker（dev 提供）均加载成功，
 * 不应产生资源级 error。资源级 fetch 失败 error 无法从 JS 抑制，但本测试走
 * 正常加载路径不触发；若 headless 出现良性 error（WebGL/字体/MapLibre 弃用告警），
 * 按实测过滤并在此注明理由。
 */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

test('数据大屏：暗色、KPI、图表、地图（canvas + 15 标签，非 fallback）', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/screen.html')

  // 恒暗色（head 内 paint 前强制 dark）
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // 4 KPI
  await expect(page.getByTestId('screen-kpi-gmv')).toBeVisible()
  await expect(page.getByTestId('screen-kpi-orders')).toBeVisible()
  await expect(page.getByTestId('screen-kpi-users')).toBeVisible()
  await expect(page.getByTestId('screen-kpi-conversion')).toBeVisible()

  // 3 图表（bar / stacked / donut）
  await expect(page.locator('oas-chart')).toHaveCount(3)

  // 地图容器 + 退出按钮
  await expect(page.getByTestId('screen-map')).toBeVisible()
  await expect(page.getByTestId('screen-exit')).toBeVisible()

  // 地图真实渲染（非 WebGL fallback）：canvas 存在 + 15 国标签
  await expect(page.getByTestId('screen-map').locator('canvas')).toBeVisible()
  await expect(page.getByTestId('screen-map').locator('.map-label')).toHaveCount(15)

  expect(errors).toEqual([])
})

test('数据大屏：退出按钮离开 screen.html', async ({ page }) => {
  await page.goto('/screen.html')
  await expect(page.getByTestId('screen-exit')).toBeVisible()
  await page.getByTestId('screen-exit').click()
  // window.close() 被浏览器拦截时，500ms 后 fallback 导航到 index.html
  await expect(page).toHaveURL(/index\.html/, { timeout: 5000 })
})

test('数据大屏：Esc 键退出', async ({ page }) => {
  await page.goto('/screen.html')
  await expect(page.getByTestId('screen-kpi-gmv')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/index\.html/, { timeout: 5000 })
})

test('数据大屏：时钟随 locale 变化（英文 locale 显示英文星期）', async ({ page }) => {
  // addInitScript 在页面脚本前写入，避免任何首帧竞态。
  // 值必须是应用 locale 白名单内的 'en'（i18n isAppLocale 只认 'zh-CN'/'en'，
  // 'en-US' 会被拒并回落到 navigator 嗅探，config 已固定 locale: 'zh-CN'）
  await page.addInitScript(() => localStorage.setItem('oas-admin.locale', 'en'))
  await page.goto('/screen.html')
  await expect(page.locator('.clock-date')).toContainText(
    /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/,
  )
})

test('数据大屏：时钟默认 zh-CN 显示中文星期', async ({ page }) => {
  await page.goto('/screen.html')
  await expect(page.locator('.clock-date')).toContainText(/星期/)
})

test('数据大屏：榜单 tick 细粒度更新（identity 保留 + 宽度/值变化）', async ({ page }) => {
  await page.goto('/screen.html')
  const rank = page.getByTestId('screen-rank')
  // 第二行：首行恒 100%（max 自身），width 无 from===to 参考价值
  const bar = rank.locator('.rank-item').nth(1).locator('.rank-bar i')
  const handle = await bar.elementHandle()
  if (!handle) throw new Error('rank bar not found')
  const beforeWidth = await page.evaluate((h) => (h as HTMLElement).style.width, handle)
  const beforeVal = await rank.locator('.rank-item').nth(1).locator('.rank-val').textContent()

  await page.waitForTimeout(5500) // ≥1 个 5s tick

  // identity：reconcile 后节点未被重建（重建则旧 handle 引用与新查询不同）
  const sameNode = await page.evaluate(
    (h) =>
      h ===
      document.querySelector('[data-testid="screen-rank"] .rank-item:nth-child(2) .rank-bar i'),
    handle,
  )
  expect(sameNode).toBe(true)

  const afterWidth = await page.evaluate((h) => (h as HTMLElement).style.width, handle)
  const afterVal = await rank.locator('.rank-item').nth(1).locator('.rank-val').textContent()
  expect(afterWidth !== beforeWidth || afterVal !== beforeVal).toBe(true)
})

test('数据大屏：地图标签优先级避让（15 总数 + 隐藏数区间）', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/screen.html')
  await expect(page.getByTestId('screen-map').locator('canvas')).toBeVisible()
  await page.waitForTimeout(600) // 地图 load + 标签定位 + 避让 + 首帧补间

  // 不硬编码具体哪国被隐藏（视口布局抖动 fragile），只断言区间
  const stats = await page.evaluate(() => ({
    total: document.querySelectorAll('.map-label').length,
    hidden: document.querySelectorAll('.map-label.is-hidden').length,
  }))
  expect(stats.total).toBe(15)
  expect(stats.hidden).toBeGreaterThanOrEqual(1)
  expect(stats.hidden).toBeLessThanOrEqual(13)
  expect(errors).toEqual([])
})
