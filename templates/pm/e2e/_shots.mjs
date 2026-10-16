import { chromium } from '@playwright/test'

// 构建产物截图：vite preview 由外部起好
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5878/')
// 等 seed（构建产物同样跑 seed）
await page.waitForSelector('.issue-row', { timeout: 30_000 })
await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v3') === '1', {
  timeout: 30_000,
})
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/pm-list.png' })

// 看板
await page.evaluate(() => {
  const el = document.querySelector('[data-testid=view-seg]')
  el.value = 'board'
  el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'board' } }))
})
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/pm-board.png' })

// 仪表盘
await page.evaluate(() => {
  const el = document.querySelector('[data-testid=view-seg]')
  el.value = 'dashboard'
  el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'dashboard' } }))
})
await page.waitForTimeout(2000)
await page.screenshot({ path: 'shots/pm-dash.png' })

// 时间线
await page.evaluate(() => {
  const el = document.querySelector('[data-testid=view-seg]')
  el.value = 'timeline'
  el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'timeline' } }))
})
await page.waitForTimeout(2000)
await page.screenshot({ path: 'shots/pm-timeline.png' })

// 列表 + 详情抽屉
await page.evaluate(() => {
  const el = document.querySelector('[data-testid=view-seg]')
  el.value = 'issues'
  el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'issues' } }))
})
await page.waitForTimeout(1000)
await page
  .locator('.issue-row')
  .first()
  .evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/pm-drawer.png' })

// 新建弹窗
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
await page.getByTestId('toolbar-new').click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/pm-create.png' })

await browser.close()
console.log('shots done')
