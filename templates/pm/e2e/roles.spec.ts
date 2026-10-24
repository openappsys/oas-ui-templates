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
  ).toHaveCount(15)

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

  // 切换到该成员：管理入口在（member:manage），但只出现「成员」页签
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-entry')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-nav-members')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-nav-settings')).toHaveCount(0)
  await expect(page.getByTestId('admin-nav-permissions')).toHaveCount(0)
  await expect(page.getByTestId('admin-nav-projects')).toHaveCount(0)
  await page.getByTestId('admin-nav-members').click()
  await page.getByTestId('admin-member-role-member-2').waitFor({ timeout: 10_000 })
  const selfRoleOptions = await page.getByTestId('admin-member-role-member-2').evaluate((el) => {
    const host = el as HTMLElement & { options?: Array<{ value: string }> }
    return (host.options ?? []).map((o) => o.value)
  })
  expect(selfRoleOptions).not.toContain('admin')
  await page.getByTestId('admin-back').click()

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

  // 被项目覆盖使用的角色不能删除
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /角色与权限|Roles/ })
    .click()
  await page.getByTestId(`perm-role-${rid}`).click()
  await page.getByTestId('perm-role-delete').click()
  await expect(page.getByTestId('perm-error')).toContainText(/项目覆盖|project override/i, {
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

  // 工作区 admin 不受项目覆盖：角色与生效预览都锁定
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /项目访问|Project access/ })
    .click()
  await page.getByTestId('proj-role-member').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'member-1'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'member-1' } }),
    )
  })
  await expect(page.getByTestId('proj-role-admin-lock')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('proj-role-role')).toHaveAttribute('disabled', '')
  await expect(page.getByTestId('proj-role-effective')).toContainText(/管理员|Admin/)

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

  // 从项目移除成员时清理其项目角色覆盖（否则留下悬空授权）
  await switchUser(page, 'member-1')
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-projects').click()
  await page.getByTestId('admin-project-members-project-2').click()
  await page.getByTestId('admin-project-members-select').evaluate((el) => {
    const ids = ['member-1', 'member-3', 'member-4', 'member-5']
    ;(el as HTMLElement & { value?: string[] }).value = ids
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: ids } }))
  })
  await page.getByTestId('admin-project-members-save').click()
  await page.getByTestId('admin-nav-permissions').click()
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /项目访问|Project access/ })
    .click()
  await page.getByTestId('proj-role-project').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'project-2'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'project-2' } }),
    )
  })
  await expect(page.getByTestId('proj-role-list')).toHaveCount(0, { timeout: 10_000 })

  // 空成员项目：无成员可选，应用禁用，预览不冒充角色
  await page.getByTestId('proj-role-project').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'project-3'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'project-3' } }),
    )
  })
  await expect(page.getByTestId('proj-role-apply')).toHaveAttribute('disabled', '')
  await expect(page.getByTestId('proj-role-effective')).toContainText('—')
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
  await expect(page.getByTestId('perm-role-scope')).toHaveAttribute('disabled', '')
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

  // 导出当前筛选结果（CSV）
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('audit-export').click()
  expect((await downloadPromise).suggestedFilename()).toBe('pm-audit.csv')

  await auditFilter.fill('绝不存在的记录zz')
  await expect(page.getByTestId('audit-no-match')).toBeVisible()
})

test('RL5 角色详情分配成员：分配、移除回退角色、管理员至少保留一人', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)

  // 复制内置管理员，得到一个 0 成员的自定义角色
  await page.getByTestId('perm-role-admin').click()
  await page.getByTestId('perm-role-duplicate').click()
  const chip = page.locator('.perm-role-chip').filter({ hasText: /副本|copy/ })
  await expect(chip).toBeVisible({ timeout: 10_000 })
  const rid = ((await chip.getAttribute('data-testid')) ?? '').replace('perm-role-', '')
  expect(rid).not.toBe('')

  const setMembers = (ids: string[]) =>
    page.getByTestId('perm-assign-members').evaluate((el, value) => {
      ;(el as HTMLElement & { value?: string[] }).value = value
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value } }))
    }, ids)

  // 分配 member-3
  await page.getByTestId('perm-assign-open').click()
  await expect(page.getByTestId('perm-assign-modal')).toHaveAttribute('visible', /.*/)
  await setMembers(['member-3'])
  await page.getByTestId('perm-assign-save').click()
  await expect(page.getByTestId('perm-assign-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(page.getByTestId('perm-assigned')).toContainText('1')

  await page.getByTestId('admin-nav-members').click()
  await expect
    .poll(
      () =>
        page
          .getByTestId('admin-member-role-member-3')
          .evaluate((el) => (el as HTMLElement & { value?: string }).value),
      { timeout: 10_000 },
    )
    .toBe(rid)

  // 移除（回退为只读）
  await page.getByTestId('admin-nav-permissions').click()
  await page.getByTestId(`perm-role-${rid}`).click()
  await page.getByTestId('perm-assign-open').click()
  await setMembers([])
  await page.getByTestId('perm-assign-fallback').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'viewer'
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'viewer' } }))
  })
  await page.getByTestId('perm-assign-save').click()
  await page.getByTestId('admin-nav-members').click()
  await expect
    .poll(
      () =>
        page
          .getByTestId('admin-member-role-member-3')
          .evaluate((el) => (el as HTMLElement & { value?: string }).value),
      { timeout: 10_000 },
    )
    .toBe('viewer')

  // 管理员不能被全部移除
  await page.getByTestId('admin-nav-permissions').click()
  await page.getByTestId('perm-role-admin').click()
  await page.getByTestId('perm-assign-open').click()
  await setMembers([])
  await page.getByTestId('perm-assign-save').click()
  await expect(page.getByTestId('perm-assign-error')).toContainText(/至少|at least/i, {
    timeout: 10_000,
  })
  await page.getByTestId('perm-assign-cancel').click()

  // 批量分配写审计
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /审计|Audit/ })
    .click()
  await page.getByTestId('audit-filter').locator('input').fill('副本')
  await expect(page.getByTestId('audit-table')).toContainText(/调整成员角色|Changed member role/)
})

test('RL6 项目权限：project:manage 可进管理区，只看到项目相关页签', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)

  await page.getByTestId('perm-role-new').click()
  await page.getByTestId('perm-role-name').locator('input').fill('项目管理员')
  await page.getByTestId('perm-project:manage').click()
  await page.getByTestId('perm-role-save').click()
  await expect(page.getByTestId('perm-saved')).toBeVisible({ timeout: 10_000 })
  const chip = page.locator('.perm-role-chip').filter({ hasText: '项目管理员' })
  const rid = ((await chip.getAttribute('data-testid')) ?? '').replace('perm-role-', '')
  expect(rid).not.toBe('')

  await page.getByTestId('admin-nav-members').click()
  await page.getByTestId('admin-member-role-member-2').evaluate((el, id) => {
    ;(el as HTMLElement & { value?: string }).value = id
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: id } }))
  }, rid)
  await page.waitForTimeout(600)

  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-entry')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-nav-projects')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-nav-cycles')).toBeVisible()
  await expect(page.getByTestId('admin-nav-permissions')).toBeVisible()
  await expect(page.getByTestId('admin-nav-members')).toHaveCount(0)
  await expect(page.getByTestId('admin-nav-settings')).toHaveCount(0)
  await expect(page.getByTestId('admin-nav-config')).toHaveCount(0)

  // 进入权限页只有「项目访问」，看不到角色/审计
  await page.getByTestId('admin-nav-permissions').click()
  await expect(page.getByTestId('proj-role-project')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('perm-tabs').getByRole('tab')).toHaveCount(1)
  await expect(page.getByTestId('perm-role-admin')).toHaveCount(0)
})

test('RL7 项目角色不提工作区权限；跨项目访问按目标项目判权', async ({ page }) => {
  await waitForSeed(page)
  await openPermissions(page)

  // 项目作用域：工作区管理组不可见、不可勾选
  await page.getByTestId('perm-role-new').click()
  await page.getByTestId('perm-role-name').locator('input').fill('项目删除者')
  await page.getByTestId('perm-role-scope').evaluate((el) => {
    ;(el as HTMLElement & { value?: string }).value = 'project'
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'project' } }))
  })
  await expect(page.getByTestId('perm-workspace:manage')).toHaveCount(0)
  await expect(page.getByTestId('perm-scope-hint')).toBeVisible()
  await page.getByTestId('perm-issue:delete').click()
  await page.getByTestId('perm-role-save').click()
  await expect(page.getByTestId('perm-saved')).toBeVisible({ timeout: 10_000 })
  const chip = page.locator('.perm-role-chip').filter({ hasText: '项目删除者' })
  const rid = ((await chip.getAttribute('data-testid')) ?? '').replace('perm-role-', '')
  expect(rid).not.toBe('')

  // 仅覆盖 project-2
  await page
    .getByTestId('perm-tabs')
    .getByRole('tab', { name: /项目访问|Project access/ })
    .click()
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
  await expect(page.getByTestId('proj-role-list')).toContainText('项目删除者', {
    timeout: 10_000,
  })

  // 在 project-2 视图里搜到 project-1 的 Issue：不得套用 project-2 的删除权限
  await switchUser(page, 'member-2')
  await page
    .getByTestId('side-list')
    .locator('[part="item"][data-value="project:project-2"]')
    .click()
  await page.getByTestId('toolbar-search').locator('input').fill('OAS-1')
  const row = page.locator('.issue-row').first()
  await expect(row).toContainText('OAS-1', { timeout: 10_000 })
  await row.click()
  await expect(page.getByTestId('detail-drawer')).toHaveAttribute('visible', /.*/)
  await expect(page.getByTestId('detail-delete-btn')).toHaveCount(0)
})
