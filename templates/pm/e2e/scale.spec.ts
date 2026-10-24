import { expect, test, type Page } from '@playwright/test'
import { waitForSeed } from './seed'

const memberRows = (page: Page) =>
  page.getByTestId('side-list').evaluate((el) => {
    const rows = [
      ...(el.shadowRoot?.querySelectorAll('[part="item"][data-value^="assignee:"]') ?? []),
    ]
    return rows
      .map((r) => r.getAttribute('data-value') ?? '')
      .filter(
        (v) => v && v !== 'assignee:all' && v !== 'assignee:__none__' && v !== 'assignee:more',
      )
  })

test('SC1 项目成员收窄：project-1 全员、project-2 5 人，切换项目即刷新成员组', async ({ page }) => {
  await waitForSeed(page)
  expect((await memberRows(page)).length).toBe(8)
  await page
    .getByTestId('side-list')
    .locator('[part="item"][data-value="project:project-2"]')
    .click()
  await expect.poll(async () => (await memberRows(page)).length, { timeout: 10_000 }).toBe(5)
  await page
    .getByTestId('side-list')
    .locator('[part="item"][data-value="project:project-1"]')
    .click()
  await expect.poll(async () => (await memberRows(page)).length, { timeout: 10_000 }).toBe(8)
})

test('SC2 目录可搜索 + 项目成员维护：裁到 2 人后项目-2 成员组只剩 2 人', async ({ page }) => {
  await waitForSeed(page)
  // 目录搜索
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-members').click()
  await page.getByTestId('admin-member-search').locator('input').fill('李')
  await expect(page.getByTestId('admin-member-count')).toHaveText('1')

  // 项目成员维护：project-2 只留 member-1 / member-6
  await page.getByTestId('admin-nav-projects').click()
  await page.getByTestId('admin-project-members-project-2').click()
  await page.getByTestId('admin-project-members-select').evaluate((el) => {
    const ids = ['member-1', 'member-6']
    ;(el as HTMLElement & { value?: string[] }).value = ids
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: ids } }))
  })
  await page.getByTestId('admin-project-members-save').click()
  await page.getByTestId('admin-back').click()
  await page
    .getByTestId('side-list')
    .locator('[part="item"][data-value="project:project-2"]')
    .click()
  await expect.poll(async () => (await memberRows(page)).length, { timeout: 10_000 }).toBe(2)
})
