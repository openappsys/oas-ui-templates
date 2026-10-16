import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))
await page.goto('http://localhost:5878/')
await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v3') === '1', {
  timeout: 30_000,
})
await page.waitForSelector('.issue-row', { timeout: 20_000 })
const setView = (v) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
await setView('timeline')
await page.waitForTimeout(1000)
await setView('issues')
await page.waitForTimeout(2500)
const st = await page.evaluate(() => {
  const vl = document.querySelector('oas-virtual-list')
  const sr = vl?.shadowRoot
  return {
    itemsLen: ((vl ?? {}).items ?? []).length,
    vlH: vl?.getBoundingClientRect().height,
    srChildren: sr
      ? Array.from(sr.children)
          .map((c) => c.tagName + '.' + (c.className || ''))
          .slice(0, 6)
      : null,
    srHTMLHead: sr ? sr.innerHTML.slice(0, 300) : '',
    rowsInSr: sr ? sr.querySelectorAll('.issue-row').length : -1,
    itemCount: sr ? sr.querySelectorAll('[data-index]').length : -1,
  }
})
console.log('DBG=' + JSON.stringify(st, null, 1))
await browser.close()
