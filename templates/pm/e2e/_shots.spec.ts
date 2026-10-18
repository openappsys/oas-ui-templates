import { expect, test, type Page } from '@playwright/test'

async function openApp(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v5') === '1', {
    timeout: 45_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
}

const setView = (page: Page, v: string) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & {
      value: string
    }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

async function openFirstDrawer(page: Page) {
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
}

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

async function captureViews(page: Page, suffix: string) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-list${suffix}.png` })

  await setView(page, 'board')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-board${suffix}.png` })

  await setView(page, 'dashboard')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `shots/pm-dash${suffix}.png` })

  await setView(page, 'timeline')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `shots/pm-timeline${suffix}.png` })

  // 回列表验证切换往返不丢行
  await setView(page, 'issues')
  await page.waitForSelector('.issue-row', { timeout: 15_000 })
  await page.waitForTimeout(800)
}

async function captureDrawerAndCreate(page: Page, suffix: string) {
  await openFirstDrawer(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/pm-drawer${suffix}.png` })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.getByTestId('toolbar-new').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-create${suffix}.png` })
}

async function expectDarkTheme(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? ''))
    .toBe('dark')
}

async function captureReadonlyDrawer(page: Page, suffix: string) {
  await switchUser(page, 'member-4')
  await expect(page.locator('.issue-row .row-check')).toHaveCount(0)
  await openFirstDrawer(page)
  await expect(page.getByTestId('detail-status')).toHaveAttribute('disabled', /.*/, {
    timeout: 15_000,
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/pm-drawer-readonly${suffix}.png` })
}

test('shots', async ({ page }) => {
  test.setTimeout(180_000)
  await openApp(page)
  await captureViews(page, '')
  await captureDrawerAndCreate(page, '')

  console.log('shots done')
})

test('shots dark', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureViews(page, '-dark')
  await captureDrawerAndCreate(page, '-dark')

  console.log('shots dark done')
})

test('shots readonly drawer', async ({ page }) => {
  test.setTimeout(150_000)
  await openApp(page)
  await captureReadonlyDrawer(page, '')
})

test('shots readonly drawer dark', async ({ page }) => {
  test.setTimeout(150_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureReadonlyDrawer(page, '-dark')
})
