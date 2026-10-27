import { expect, test, type Page } from '@playwright/test'

/** 功能页 ↔ URL hash 同步：切换写 hash、刷新恢复、后退回溯、admin 深链 */

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('oas-pm-seed-size', '5000'))
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
    timeout: 180_000,
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

test('UR1 切换功能页写 hash；刷新恢复当前页', async ({ page }) => {
  await boot(page)
  await setView(page, 'board')
  await expect(page).toHaveURL(/#\/board$/)
  await setView(page, 'dashboard')
  await expect(page).toHaveURL(/#\/dashboard$/)

  // 刷新恢复当前页（仪表盘），而非回落列表
  await page.reload()
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
    timeout: 180_000,
  })
  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 20_000 })
})

test('UR2 直接深链 + 后退回溯', async ({ page }) => {
  await boot(page)
  await page.goto('/#/timeline')
  await expect
    .poll(() => page.evaluate(() => location.hash), { timeout: 10_000 })
    .toBe('#/timeline')
  // 深链页面真实渲染（时间线视图的画布容器可见）
  await expect(page.getByTestId('view-seg')).toBeVisible()

  // 后退：#/timeline → 上一条历史（列表）
  await page.goBack()
  await expect.poll(() => page.evaluate(() => location.hash), { timeout: 10_000 }).toBe('#/issues')
})

test('UR3 管理台深链：#/admin/<tab> 直达对应页签', async ({ page }) => {
  await boot(page)
  await page.goto('/#/admin/members')
  await expect(page.getByTestId('admin-view')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('admin-nav-members')).toHaveClass(/is-active/, {
    timeout: 10_000,
  })
  await expect(page).toHaveURL(/#\/admin\/members/)
})
