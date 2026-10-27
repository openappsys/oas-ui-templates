import { expect, test } from '@playwright/test'

// 验证 PROD 构建注入 GA（gtag 脚本 + dataLayer），dev 不注入
test('GA4 注入：PROD 产物有 gtag，dataLayer 初始化', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2500)
  const st = await page.evaluate(() => ({
    gtagScript: !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
    dataLayer: Array.isArray(window.dataLayer),
    configHit: (window.dataLayer ?? []).some(
      (entry) => Array.isArray(entry as unknown[]) && (entry as unknown[])[0] === 'config',
    ),
  }))
  console.log('GA=' + JSON.stringify(st))
  expect(st.gtagScript).toBe(true)
  expect(st.dataLayer).toBe(true)
  expect(st.configHit).toBe(true)
})
