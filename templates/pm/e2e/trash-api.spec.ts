import { expect, test, type Locator, type Page } from '@playwright/test'
import { bearer, loginToken } from './api-auth'

// API 模式回收站：REST 客户端 + mock 后端走真实 HTTP。
// Dexie 侧的同一套流程见 trash.spec.ts；这里补「软删除端点 + 撤销/恢复/永久删除」的端到端串联
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('oas-pm-api-init')) {
      localStorage.setItem('oas-pm-data', 'api')
      localStorage.setItem('oas-pm-theme', 'light')
      sessionStorage.setItem('oas-pm-api-init', '1')
    }
  })
})

const rowOfKey = (page: Page, key: string) => page.locator('.issue-row', { hasText: key }).first()

async function openFirstDrawer(page: Page): Promise<string> {
  const key = (await page.locator('.issue-row .issue-key').first().textContent())?.trim() ?? ''
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
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
  return key
}

async function deleteViaDrawer(page: Page) {
  await expect(page.getByTestId('detail-delete')).toBeAttached({ timeout: 10_000 })
  await page.evaluate(() => {
    document
      .querySelector('[data-testid=detail-delete]')
      ?.dispatchEvent(
        new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
      )
  })
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 10_000 })
}

async function openAdminTrash(page: Page) {
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('admin-nav-config').click()
  await expect(page.getByTestId('admin-config-trash')).toBeVisible({ timeout: 10_000 })
}

const trashRow = (page: Page, key: string) =>
  page.getByTestId('admin-table-trash').locator('tbody tr', { hasText: key })

async function confirmPop(btn: Locator) {
  await btn.evaluate((el) => {
    el.closest('oas-popconfirm')?.dispatchEvent(
      new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
    )
  })
}

test('TR1 API 模式：删除 → 撤销 → 回收站恢复 → 永久删除', async ({ page, request }) => {
  test.setTimeout(120_000)
  const token = await loginToken(request, 'admin')
  await page.addInitScript((value) => localStorage.setItem('oas-pm-token', value), token)
  // 复用 dev server 时 store 会跨跑污染：先复位确定性种子
  const reset = await request.post('/api/admin/reset', { headers: bearer(token) })
  expect(reset.ok()).toBe(true)

  await page.goto('/')
  await expect(page.getByTestId('data-source-badge')).toHaveText('API', { timeout: 20_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 20_000 })

  // ① 删除 → 撤销条 → 撤销：行回到列表
  const first = await openFirstDrawer(page)
  expect(first).toContain('OAS-')
  await deleteViaDrawer(page)
  await expect(rowOfKey(page, first)).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('undo-bar')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('undo-action').click()
  await expect(page.getByTestId('undo-bar')).toHaveCount(0, { timeout: 5000 })
  await expect(rowOfKey(page, first)).toBeVisible({ timeout: 15_000 })

  // ② 删除 → 回收站 → 恢复
  await openFirstDrawer(page)
  await deleteViaDrawer(page)
  await openAdminTrash(page)
  await expect(trashRow(page, first)).toBeVisible({ timeout: 15_000 })
  await trashRow(page, first)
    .getByTestId(/^admin-trash-restore-/)
    .click()
  await expect(page.getByTestId('admin-trash-notice')).toContainText('已恢复', { timeout: 10_000 })
  await expect(trashRow(page, first)).toHaveCount(0, { timeout: 10_000 })
  await page.getByTestId('admin-back').click()
  await expect(rowOfKey(page, first)).toBeVisible({ timeout: 15_000 })

  // ③ 删除 → 回收站 → 永久删除
  const second = await openFirstDrawer(page)
  await deleteViaDrawer(page)
  await expect(page.getByTestId('undo-bar')).toBeVisible({ timeout: 5000 })
  await openAdminTrash(page)
  await expect(trashRow(page, second)).toBeVisible({ timeout: 15_000 })
  await confirmPop(trashRow(page, second).getByTestId(/^admin-trash-purge-/))
  await expect(page.getByTestId('admin-trash-notice')).toContainText('已永久删除', {
    timeout: 10_000,
  })
  await expect(trashRow(page, second)).toHaveCount(0, { timeout: 10_000 })

  // 服务端确认：该行 GET 404（物理删除），回收站列表为空
  const trash = await request.get('/api/issues?deleted=1', { headers: bearer(token) })
  expect(trash.ok()).toBe(true)
  expect(((await trash.json()) as { items: unknown[] }).items).toHaveLength(0)
})
