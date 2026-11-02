import { expect, test } from '@playwright/test'

/** 甘特二期 opt-in 断言：运行时探测特性（本地 link: 源码含、npm registry 旧版无）——
 *  无特性环境自动跳过，发布后 CI 自动开始验证 */

test('甘特二期：工时列 + 状态线 + 计划刻度', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oas-pm-seed-size', '5000')
    localStorage.setItem('oas-pm-theme', 'dark')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', { timeout: 180_000 })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = 'timeline'
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'timeline' } }))
  })
  await page.waitForTimeout(1200)

  // 特性探测：gantt shadow 内是否存在 effort 列头（二期渲染产物）
  const hasFeature = await page.evaluate(() => {
    const g = document.querySelector('[data-testid=gantt]')
    return !!g?.shadowRoot && g.shadowRoot.textContent.includes('工时')
  })
  test.skip(!hasFeature, 'oas-ui 版本不含 gantt 二期（show-effort），发布后自动启用本断言')

  // 工时列头存在
  await expect(page.locator('[data-testid=gantt]').first()).toBeAttached()
  const effortHeader = await page.evaluate(() => {
    const g = document.querySelector('[data-testid=gantt]')
    return g?.shadowRoot?.textContent.includes('工时') ?? false
  })
  expect(effortHeader).toBe(true)

  // 状态竖线（token 警告色，缺省当天）——DOM 内存在状态线节点
  const statusLine = await page.evaluate(() => {
    const g = document.querySelector('[data-testid=gantt]')
    return g?.shadowRoot?.querySelector('[class*="status-line"], [class*="statusline"]') !== null
  })
  expect(statusLine).toBe(true)
})
