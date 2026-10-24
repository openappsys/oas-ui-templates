import { expect, test, type Page } from '@playwright/test'
import { openUserMenu, userMenuItem } from './menus'

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

async function openPermissions(page: Page) {
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-permissions').click()
  await expect(page.getByTestId('admin-custom-roles')).toBeVisible({ timeout: 10_000 })
}

async function switchUser(page: Page, id: string) {
  await openUserMenu(page)
  await userMenuItem(page, /切换身份|Switch user/).click()
  await page.getByTestId(`pick-user-${id}`).click()
  await expect
    .poll(async () => (await page.getByTestId('tb-user').textContent())?.trim(), {
      timeout: 10_000,
    })
    .not.toBe('')
}

test('RL1 自定义角色：新建 + 勾权限 + 分配给成员后按权限生效', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)

  // 内置矩阵仍是 14 行只读
  await expect(page.getByTestId('admin-permissions-matrix').locator('tbody tr')).toHaveCount(14)

  await page.getByTestId('perm-role-new').click()
  await page.getByTestId('perm-role-name').locator('input').fill('项目负责人')
  // 只给「管理项目」：可进管理，不能新建 Issue
  await page.getByTestId('perm-project:manage').click()
  await page.getByTestId('perm-role-save').click()
  await expect(page.getByTestId('perm-saved')).toBeVisible({ timeout: 10_000 })

  const chip = page.locator('.perm-role-chip').filter({ hasText: '项目负责人' })
  await expect(chip).toBeVisible()
  const testid = await chip.getAttribute('data-testid')
  const roleId = (testid ?? '').replace('perm-role-', '')
  expect(roleId).not.toBe('')

  // 分配给 member-2（李娜）
  await page.getByTestId('admin-nav-members').click()
  const sel = page.getByTestId('admin-member-role-member-2')
  await sel.waitFor({ timeout: 10_000 })
  await sel.evaluate((el, rid) => {
    ;(el as HTMLElement & { value?: string }).value = rid
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: rid } }))
  }, roleId)
  await page.waitForTimeout(600)

  // 切换到该成员：管理入口在（project:manage），新建 Issue 不在（无 issue:create）
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-entry')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)

  // 刷新后角色仍生效
  await page.reload()
  await page.getByTestId('pm-toolbar').waitFor({ timeout: 60_000 })
  await expect(page.getByTestId('admin-entry')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)
})

test('RL2 角色守卫：被成员占用的自定义角色不能删除', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)
  await page.getByTestId('perm-role-new').click()
  await page.getByTestId('perm-role-name').locator('input').fill('临时角色')
  await page.getByTestId('perm-role-save').click()
  await expect(page.getByTestId('perm-saved')).toBeVisible({ timeout: 10_000 })

  const chip = page.locator('.perm-role-chip').filter({ hasText: '临时角色' })
  const testid = await chip.getAttribute('data-testid')
  const roleId = (testid ?? '').replace('perm-role-', '')

  await page.getByTestId('admin-nav-members').click()
  await page.getByTestId('admin-member-role-member-3').evaluate((el, rid) => {
    ;(el as HTMLElement & { value?: string }).value = rid
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: rid } }))
  }, roleId)
  await page.waitForTimeout(600)

  await openPermissions(page)
  await chip.click()
  await page.getByTestId('perm-role-delete').click()
  await expect(page.getByTestId('perm-error')).toContainText(/使用|assigned/i, {
    timeout: 10_000,
  })
})
