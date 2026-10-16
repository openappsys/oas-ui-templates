import { chromium } from '@playwright/test'
import { expect, test } from '@playwright/test'

test('shots', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v3') === '1', {
    timeout: 45_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'shots/pm-list.png' })

  const setView = (v: string) =>
    page.evaluate((view) => {
      const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & {
        value: string
      }
      el.value = view
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
    }, v)

  await setView('board')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'shots/pm-board.png' })

  await setView('dashboard')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'shots/pm-dash.png' })

  await setView('timeline')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'shots/pm-timeline.png' })

  // 回列表验证切换往返不丢行
  await setView('issues')
  await page.waitForSelector('.issue-row', { timeout: 15_000 })
  await page.waitForTimeout(800)

  // 详情抽屉
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-drawer]') as { opened?: boolean })
              ?.opened ?? false,
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/pm-drawer.png' })

  // 新建弹窗
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.getByTestId('toolbar-new').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'shots/pm-create.png' })

  console.log('shots done')
})
