import { test } from '@playwright/test'

// 截图产物落 shots/（已 gitignore），仅人工核对视觉，不参与断言。
// 命名前缀 screen- 与 pm 模板 _shots.spec.ts 的 pm- 前缀模式一致。

test('screen 截图（1920×1080）', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/screen.html')
  await page.waitForTimeout(2000) // 等地图 + 动画稳定
  await page.screenshot({ path: 'shots/screen.png' })
})
