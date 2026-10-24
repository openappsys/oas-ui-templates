import { expect, test, type Page } from '@playwright/test'
import { openUserMenu, userMenuItem } from './menus'

/** 种子完成信号：5K（e2e 默认）+ SEED_VER 标记 + 首屏行 */
async function waitForSeed(page: Page) {
  test.setTimeout(120_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-seed-size', '5000'))
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), {
      timeout: 120_000,
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

async function openProfile(page: Page) {
  await openUserMenu(page)
  await userMenuItem(page, /个人资料|Profile/).click()
  await expect(page.getByTestId('profile-drawer')).toHaveAttribute('visible', '', {
    timeout: 10_000,
  })
}

test('PR1 个人资料：在账号菜单打开，改姓名/职位后顶栏更新并持久化', async ({ page }) => {
  await waitForSeed(page)
  await openProfile(page)

  // 邮箱只读；角色只读展示
  await expect(page.getByTestId('profile-email').locator('input')).toBeDisabled()
  await expect(page.getByTestId('profile-role')).toContainText(/管理员|Admin/)

  await page.getByTestId('profile-name').locator('input').fill('张伟（资料）')
  await page.getByTestId('profile-title').locator('input').fill('前端工程师')
  await page.getByTestId('profile-color-2').click()
  await page.getByTestId('profile-save').click()

  await expect(page.getByTestId('profile-drawer')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })
  await expect
    .poll(async () => (await page.getByTestId('tb-user').textContent())?.trim(), {
      timeout: 10_000,
    })
    .toBe('张伟（资料）')

  // 刷新后仍保留
  await page.reload()
  await page.getByTestId('pm-toolbar').waitFor({ timeout: 60_000 })
  await expect
    .poll(async () => (await page.getByTestId('tb-user').textContent())?.trim(), {
      timeout: 20_000,
    })
    .toBe('张伟（资料）')
  // 资料字段也保留
  await openProfile(page)
  await expect(page.getByTestId('profile-title').locator('input')).toHaveValue('前端工程师')
})

test('PR2 个人资料：我的 Issues 直达我的视图', async ({ page }) => {
  await waitForSeed(page)
  await openProfile(page)
  await page.getByTestId('profile-my-issues').click()
  await expect
    .poll(
      () =>
        page
          .getByTestId('side-list')
          .locator('[part="item"][data-value="view:my"]')
          .getAttribute('aria-pressed'),
      { timeout: 10_000 },
    )
    .toBe('true')
  await expect(page.getByTestId('profile-drawer')).not.toHaveAttribute('visible', /.*/)
})
