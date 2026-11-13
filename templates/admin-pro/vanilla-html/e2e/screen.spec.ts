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
