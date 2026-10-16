import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))
await page.goto('http://localhost:5878/')
await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v3') === '1', {
  timeout: 30_000,
})
await page.waitForSelector('.issue-row', { timeout: 20_000 })
console.log('A rows =', await page.locator('.issue-row').count())

const setView = (v) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

await setView('board')
await page.waitForTimeout(1200)
console.log(
  'B board cards =',
  await page.evaluate(() => (document.querySelector('oas-kanban')?.cards ?? []).length),
)
await setView('issues')
await page.waitForTimeout(2000)
const st = await page.evaluate(() => {
  const vl = document.querySelector('oas-virtual-list')
  return {
    vlExists: !!vl,
    itemsLen: ((vl ?? {}).items ?? []).length,
    vlHeight: vl ? vl.getBoundingClientRect().height : -1,
    vlDisplay: vl ? getComputedStyle(vl).display : '',
    rows: document.querySelectorAll('.issue-row').length,
    contentHTML: (document.querySelector('.content')?.innerHTML ?? '').slice(0, 150),
  }
})
console.log('C back-to-issues =', JSON.stringify(st))
await browser.close()
