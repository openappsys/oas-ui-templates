import { expect, test, type Locator, type Page } from '@playwright/test'
import { bearer, loginToken } from './api-auth'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

/** 预算沿用 10 万口径：与既有 spec 同一口径 */
async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  test.setTimeout(240_000)
  // 播种规模：e2e 默认 5K（产品默认仍 10 万）。每个用例都是新上下文、都要重播种子，
  // 10 万条实测 44–134s（随负载波动），会撞穿用例预算 → 轮换式 seed 超时
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)

  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** oas-input 填值（弹窗在 light DOM，document.querySelector 可达） */
async function fillOInput(page: Page, testid: string, text: string) {
  await page.evaluate(
    ([tid, val]) => {
      const host = document.querySelector(`[data-testid="${tid}"]`)
      const inner =
        (host?.shadowRoot?.querySelector('input, textarea') as HTMLInputElement) ??
        (host as HTMLInputElement)
      inner.value = val as string
      host?.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: val } }))
    },
    [testid, text],
  )
}

/** 新建工作项并返回表格行（新建行 updatedAt 最新 → 落在窗口头部） */
async function createIssue(page: Page, title: string): Promise<Locator> {
  await page.getByTestId('toolbar-new').click()
  await expect(page.getByTestId('modal-create')).toHaveAttribute('visible', /.*/)
  await fillOInput(page, 'create-title', title)
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('modal-create')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })
  const row = page.locator('.issue-row', { hasText: title }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  return row
}

const rowOf = (page: Page, title: string) => page.locator('.issue-row', { hasText: title }).first()

async function openDrawer(page: Page, title: string) {
  await rowOf(page, title).evaluate((el) => {
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

/** 抽屉内删除：popconfirm 契约事件 reason='ok'（同 smoke M9） */
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

const trashRow = (page: Page, title: string) =>
  page.getByTestId('admin-table-trash').locator('tbody tr', { hasText: title })

/** popconfirm 确认（契约事件 reason='ok'） */
async function confirmPop(btn: Locator) {
  await btn.evaluate((el) => {
    el.closest('oas-popconfirm')?.dispatchEvent(
      new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
    )
  })
}

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

test('T1 删除 → 撤销条 → 撤销后行回到列表', async ({ page }) => {
  await waitForSeed(page)
  const title = `回收站撤销-${Date.now()}`
  await createIssue(page, title)
  await openDrawer(page, title)
  await deleteViaDrawer(page)

  // 软删除：行立刻从列表消失，顶部出现撤销条
  await expect(rowOf(page, title)).toHaveCount(0, { timeout: 15_000 })
  const bar = page.getByTestId('undo-bar')
  await expect(bar).toBeVisible({ timeout: 5000 })
  await expect(bar).toContainText('已删除')
  await expect(page.getByTestId('undo-action')).toBeVisible()

  await page.getByTestId('undo-action').click()
  await expect(bar).toHaveCount(0, { timeout: 5000 })
  await expect(rowOf(page, title)).toBeVisible({ timeout: 15_000 })

  // 撤销条 6 秒后自动收起（超时后仍可从回收站恢复）
  await openDrawer(page, title)
  await deleteViaDrawer(page)
  await expect(bar).toBeVisible({ timeout: 5000 })
  await expect(bar).toHaveCount(0, { timeout: 12_000 })

  // 收尾：从回收站恢复，避免污染后续用例的列表
  await openAdminTrash(page)
  await trashRow(page, title)
    .getByTestId(/^admin-trash-restore-/)
    .click()
  await expect(page.getByTestId('admin-trash-notice')).toBeVisible({ timeout: 10_000 })
})

test('T2 回收站：恢复行 → 回到列表', async ({ page }) => {
  await waitForSeed(page)
  const title = `回收站恢复-${Date.now()}`
  await createIssue(page, title)
  await openDrawer(page, title)
  await deleteViaDrawer(page)

  await openAdminTrash(page)
  const row = trashRow(page, title)
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText('OAS-')
  // 删除时间列非空（本地化时间串），标题与项目列齐全
  await expect(row).toContainText('OAS 平台')

  await row.getByTestId(/^admin-trash-restore-/).click()
  await expect(page.getByTestId('admin-trash-notice')).toContainText('已恢复', { timeout: 10_000 })
  await expect(trashRow(page, title)).toHaveCount(0, { timeout: 10_000 })

  await page.getByTestId('admin-back').click()
  await expect(rowOf(page, title)).toBeVisible({ timeout: 15_000 })
})

test('T3 回收站：永久删除 → 物理移除（列表与回收站都不再有）', async ({ page }) => {
  await waitForSeed(page)
  const title = `回收站清除-${Date.now()}`
  await createIssue(page, title)
  await openDrawer(page, title)
  await deleteViaDrawer(page)
  await expect(page.getByTestId('undo-bar')).toBeVisible({ timeout: 5000 })

  await openAdminTrash(page)
  const row = trashRow(page, title)
  await expect(row).toBeVisible({ timeout: 15_000 })
  await confirmPop(row.getByTestId(/^admin-trash-purge-/))
  await expect(page.getByTestId('admin-trash-notice')).toContainText('已永久删除', {
    timeout: 10_000,
  })
  await expect(trashRow(page, title)).toHaveCount(0, { timeout: 10_000 })

  await page.getByTestId('admin-back').click()
  await expect(rowOf(page, title)).toHaveCount(0, { timeout: 10_000 })
})

test('T4 权限：非 admin 无管理入口，回收站行操作服务端 403', async ({ page, request }) => {
  await waitForSeed(page)
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-entry')).toHaveCount(0)
  await expect(page.getByTestId('admin-config-trash')).toHaveCount(0)

  // 取一条真实存在的 issue id（mock 种子）做服务端门禁探针
  const adminToken = await loginToken(request, 'admin')
  const listed = await request.get('/api/issues?projectId=__all__&limit=1', {
    headers: bearer(adminToken),
  })
  expect(listed.ok()).toBe(true)
  const probeId = ((await listed.json()) as { items: Array<{ id: string }> }).items[0].id

  // 恢复/永久删除仅 admin：服务端在路由前拒绝（前端隐藏只是第一道门）
  const memberToken = await loginToken(request, 'member')
  const restore = await request.post(`/api/issues/${probeId}/restore`, {
    headers: bearer(memberToken),
  })
  expect(restore.status()).toBe(403)
  const purge = await request.delete(`/api/issues/${probeId}/purge`, {
    headers: bearer(memberToken),
  })
  expect(purge.status()).toBe(403)

  // admin 令牌可通行（端点真实存在，不是 404）
  const adminRestore = await request.post(`/api/issues/${probeId}/restore`, {
    headers: bearer(adminToken),
  })
  expect(adminRestore.status()).toBe(200)

  await switchUser(page, 'member-1')
})
