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
  await expect(
    page.getByTestId('admin-permissions-matrix').locator('tbody tr:not(.group-header)'),
  ).toHaveCount(14)

  await page.getByTestId('perm-role-new').click()
  await page.getByTestId('perm-role-name').locator('input').fill('项目负责人')
  // 只给「管理项目」：可进管理，不能新建 Issue
  await page.getByTestId('perm-member:manage').click()
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

test('RL3 项目级角色：项目内覆盖生效、项目外继承工作区，变更写审计', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)

  // 建项目作用域角色：只给「新建 Issue」
  await page.getByTestId('perm-role-new').click()
  await page.getByTestId('perm-role-name').locator('input').fill('项目创建者')
  await page.getByTestId('perm-role-scope').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'project'
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'project' } }))
  })
  await page.getByTestId('perm-issue:create').click()
  await page.getByTestId('perm-role-save').click()
  await expect(page.getByTestId('perm-saved')).toBeVisible({ timeout: 10_000 })
  const chip = page.locator('.perm-role-chip').filter({ hasText: '项目创建者' })
  const rid = ((await chip.getAttribute('data-testid')) ?? '').replace('perm-role-', '')
  expect(rid).not.toBe('')

  // 李娜工作区角色降为只读
  await page.getByTestId('admin-nav-members').click()
  const ws = page.getByTestId('admin-member-role-member-2')
  await ws.waitFor({ timeout: 10_000 })
  await ws.evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'viewer'
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'viewer' } }))
  })

  // 项目-2 覆盖为「项目创建者」
  await openPermissions(page)
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /项目访问|Project access/ })
    .click()
  await page.getByTestId('proj-role-project').waitFor({ timeout: 10_000 })
  await page.getByTestId('proj-role-project').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'project-2'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'project-2' } }),
    )
  })
  await page.getByTestId('proj-role-member').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'member-2'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'member-2' } }),
    )
  })
  await page.getByTestId('proj-role-role').evaluate((el, id) => {
    ;(el as HTMLElement & { value?: string }).value = id
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: id } }))
  }, rid)
  await page.getByTestId('proj-role-apply').click()
  await expect(page.getByTestId('proj-role-list')).toContainText('项目创建者', {
    timeout: 10_000,
  })

  // 审计：建角色 + 调成员角色 + 项目覆盖都留痕
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /审计|Audit/ })
    .click()
  const audit = page.getByTestId('admin-audit')
  await expect(audit).toContainText(/新建角色|Created role/)
  await expect(audit).toContainText(/调整成员角色|Changed member role/)
  await expect(audit).toContainText(/设置项目角色|Set project role/)

  // 切到李娜：项目-2 有新建 Issue（项目角色），项目-1 没有（工作区只读）
  await switchUser(page, 'member-2')
  await page
    .getByTestId('side-list')
    .locator('[part="item"][data-value="project:project-2"]')
    .click()
  await expect(page.getByTestId('toolbar-new')).toBeVisible({ timeout: 10_000 })
  await page
    .getByTestId('side-list')
    .locator('[part="item"][data-value="project:project-1"]')
    .click()
  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)
})

test('RL4 权限页可用性：复制内置角色、组全选/取消、角色搜索、审计筛选', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)

  // 从内置角色复制（最常用的定制路径）
  await page.getByTestId('perm-role-admin').click()
  await page.getByTestId('perm-role-duplicate').click()
  const copyChip = page.locator('.perm-role-chip').filter({ hasText: /副本|copy/ })
  await expect(copyChip).toBeVisible({ timeout: 10_000 })

  // 角色搜索：只留匹配项，未命中给空态
  const roleSearch = page.getByTestId('perm-role-search').locator('input')
  await roleSearch.fill('副本')
  await expect(page.getByTestId('perm-role-viewer')).toHaveCount(0)
  await expect(copyChip).toBeVisible()
  await roleSearch.fill('绝不存在的角色zz')
  await expect(page.getByTestId('perm-role-empty')).toBeVisible()
  await roleSearch.fill('')

  // 组全选 → 未保存提示；取消 → 恢复且保存禁用
  await copyChip.click()
  await page.getByTestId('perm-group-all-permGroupIssue').click()
  await expect(page.getByTestId('perm-unsaved')).toBeVisible()
  await page.getByTestId('perm-role-cancel').click()
  await expect(page.getByTestId('perm-unsaved')).toHaveCount(0)
  await expect(page.getByTestId('perm-role-save')).toHaveAttribute('disabled', '')

  // 审计筛选：命中复制记录；无命中给空态
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /审计|Audit/ })
    .click()
  const auditFilter = page.getByTestId('audit-filter').locator('input')
  await auditFilter.fill('副本')
  await expect(page.getByTestId('audit-table')).toContainText(/副本|copy/)
  await auditFilter.fill('绝不存在的记录zz')
  await expect(page.getByTestId('audit-no-match')).toBeVisible()
})
