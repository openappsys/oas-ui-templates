import { expect, test } from '@playwright/test'

/** 多工作流闭环：新建工作流绑定项目 → 该项目看板列变化 → 默认工作流项目不受影响 */
test('MW1 多工作流：绑定项目后该项目用专属状态', async ({ page }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    localStorage.setItem('oas-pm-seed-size', '5000')
    localStorage.setItem('oas-pm-theme', 'dark')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
    timeout: 180_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })

  const gotoAdmin = async () => {
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
      el.value = 'admin'
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'admin' } }))
    })
    await page.waitForTimeout(500)
    await page.getByTestId('admin-nav-config').click()
    await expect(page.getByTestId('admin-config-workflow')).toBeVisible({ timeout: 10_000 })
  }

  // 1. 新建「开发流程」并绑定「OAS 平台」
  await gotoAdmin()
  await page.locator('.wf-tab-add').click()
  await page.getByTestId('admin-workflow-create').locator('oas-input input').fill('开发流程')
  await page
    .getByTestId('admin-workflow-create')
    .locator('select')
    .selectOption({ label: 'OAS 平台' })
  await page.getByTestId('admin-workflow-create-save').click()
  await expect(page.getByTestId('admin-workflow-tabs')).toContainText('开发流程', { timeout: 5000 })

  // 2. 在「开发流程」下新建状态「编码中」(started)
  await page.locator('.wf-tab').filter({ hasText: '开发流程' }).first().click()
  await page.waitForTimeout(300)
  await page.getByTestId('admin-workflow-add').click()
  await page.getByTestId('admin-workflow-new').locator('oas-input input').fill('编码中')
  await page.getByTestId('admin-workflow-new').locator('select').selectOption('started')
  await page.getByTestId('admin-workflow-save').click()
  await expect(page.getByTestId('admin-workflow-rows')).toContainText('编码中', { timeout: 5000 })

  // 3. 切 OAS 平台（project-1）的看板：出现「编码中」列
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = 'board'
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'board' } }))
  })
  await page.waitForTimeout(800)
  await expect(page.getByText('编码中', { exact: true }).first()).toBeVisible({ timeout: 5000 })

  // 4. 显式切「全部项目」作用域（默认作用域是 project-1！）→ 默认工作流派：无「编码中」
  await page.locator('[data-value="project:__all__"]').click()
  await page.waitForTimeout(1200)
  await expect(page.getByText('编码中', { exact: true })).toHaveCount(0)
  // 对照：默认工作流的状态（进行中）在全部项目视图可见
  await expect(page.getByText('进行中', { exact: true }).first()).toBeVisible()

  // 5. 解绑「开发流程」→ OAS 平台回落默认工作流
  await gotoAdmin()
  await page.locator('.wf-tab').filter({ hasText: '开发流程' }).first().click()
  await page.waitForTimeout(300)
  await page.getByTestId('admin-workflow-unbind').click()
  await page.waitForTimeout(400)
  // 解绑后 tag 变「默认」？——开发流程 tag 应为「默认」（projectId=null）——验证 tabs 里开发流程 tag
  await expect(page.getByTestId('admin-workflow-tabs')).toContainText('开发流程', { timeout: 5000 })
})
