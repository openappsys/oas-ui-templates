import { expect, test, type Page } from '@playwright/test'
import { bearer, loginToken } from './api-auth'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  test.setTimeout(240_000)
  // 播种规模：e2e 默认 5K（产品默认仍 10 万）。每个用例都是新上下文、都要重播种子，
  // 10 万条实测 44–134s（随负载波动），会撞穿用例预算 → 轮换式 seed 超时
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)

  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v9')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

async function setOSelect(page: Page, testid: string, value: string) {
  await page.evaluate(
    ([tid, val]) => {
      const el = document.querySelector(`[data-testid="${tid}"]`) as
        | (HTMLElement & { value?: string })
        | null
      if (!el) return
      el.value = String(val)
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    },
    [testid, value],
  )
}

/** 抽屉是否已开（oas-drawer 暴露 opened getter） */
const drawerOpened = (page: Page, testid: string) =>
  page.evaluate(
    (tid) =>
      (document.querySelector(`[data-testid="${tid}"]`) as { opened?: boolean })?.opened ?? false,
    testid,
  )

async function openFirstRow(page: Page) {
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  await expect.poll(() => drawerOpened(page, 'detail-drawer'), { timeout: 15_000 }).toBe(true)
  await expect(page.getByTestId('detail-status')).toBeAttached({ timeout: 15_000 })
}

/** 造两条未读：李娜评论 @张伟（mention）+ 把李娜负责的 Issue 改派给张伟（assigned）。
 *  调用前列表需已过滤到「负责人=张伟」（第一条评论落在张伟负责的 Issue 上） */
async function composeUnread(page: Page) {
  await openFirstRow(page)
  await page.getByTestId('comment-input').fill('@张伟 请确认排期')
  await page.getByTestId('comment-send').click()
  await expect(page.getByTestId('comment-item').last()).toContainText('@张伟', { timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect.poll(() => drawerOpened(page, 'detail-drawer'), { timeout: 10_000 }).toBe(false)

  // 换到李娜负责的 Issue：改派给张伟 → assigned 通知
  await sideItem(page, 'member:member-1').click()
  await sideItem(page, 'member:member-2').click()
  await page.waitForTimeout(1200)
  const assignedKey = (await page.locator('.issue-row .issue-key').first().textContent()) ?? ''
  const assignedTitle = (await page.locator('.issue-row .issue-title').first().textContent()) ?? ''
  expect(assignedKey).not.toBe('')
  await openFirstRow(page)
  await setOSelect(page, 'detail-assignee', 'member-1')
  await page.waitForTimeout(1200)
  await page.keyboard.press('Escape')
  await expect.poll(() => drawerOpened(page, 'detail-drawer'), { timeout: 10_000 }).toBe(false)
  return { assignedKey, assignedTitle }
}

test('N1 通知中心：未读角标 → 面板 → 点击标已读并开抽屉 → 全部已读', async ({ page }) => {
  test.setTimeout(240_000)
  await waitForSeed(page)

  // 张伟视角先锁定一个「负责人=张伟」的 Issue，再切到李娜评论提及
  await switchUser(page, 'member-2')
  await sideItem(page, 'member:member-1').click()
  await page.waitForTimeout(1000)
  const { assignedKey, assignedTitle } = await composeUnread(page)

  // 切回张伟：两条未读 → 角标出现且计数为 2
  await switchUser(page, 'member-1')
  const badge = page.getByTestId('notify-badge')
  await expect(badge).toBeVisible({ timeout: 20_000 })
  await expect(badge).toHaveText('2')

  // 打开面板：两条通知，assigned 在前（后写入）
  await page.getByTestId('toolbar-notify').click()
  await expect(page.getByTestId('notify-drawer')).toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })
  await expect(page.getByTestId('notify-item')).toHaveCount(2, { timeout: 10_000 })
  const assignedItem = page.getByTestId('notify-item').filter({ hasText: assignedKey }).first()
  await expect(assignedItem).toHaveAttribute('data-read', 'false')
  await expect(assignedItem.getByTestId('notify-unread-dot')).toBeVisible()

  // 点击通知：面板关闭 + 对应 Issue 抽屉打开 + 未读数减一
  await assignedItem.click()
  await expect(page.getByTestId('notify-drawer')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })
  await expect.poll(() => drawerOpened(page, 'detail-drawer'), { timeout: 10_000 }).toBe(true)
  await expect(page.locator('.detail-title')).toContainText(assignedTitle, { timeout: 10_000 })
  await expect(badge).toHaveText('1')
  await page.keyboard.press('Escape')
  await expect.poll(() => drawerOpened(page, 'detail-drawer'), { timeout: 10_000 }).toBe(false)

  // 全部已读：角标消失，条目转为已读态
  await page.getByTestId('toolbar-notify').click()
  await expect(page.getByTestId('notify-drawer')).toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })
  await page.getByTestId('notify-read-all').click()
  await expect(page.getByTestId('notify-badge')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByTestId('notify-unread-dot')).toHaveCount(0)
  const items = page.getByTestId('notify-item')
  await expect(items).toHaveCount(2)
  for (const item of await items.all()) {
    await expect(item).toHaveAttribute('data-read', 'true')
  }
  // 已全部读完：按钮置灰（oas-button 的 disabled 落在 shadow 内部按钮上）
  await expect
    .poll(() =>
      page
        .getByTestId('notify-read-all')
        .evaluate(
          (el) =>
            (el.shadowRoot?.querySelector('button') as HTMLButtonElement | null)?.disabled ?? false,
        ),
    )
    .toBe(true)
})

test('N2 API：通知按 Bearer 身份隔离，已读端点只作用于本人', async ({ request }) => {
  const admin = await loginToken(request, 'admin')
  await request.post('/api/admin/reset', { headers: bearer(admin) })
  const member = await loginToken(request, 'member')

  const list = await request.get('/api/issues', {
    headers: bearer(member),
    params: { projectId: 'project-1', limit: '1' },
  })
  const issue = (await list.json()) as { items: Array<{ id: string }> }
  const issueId = issue.items[0]?.id
  expect(issueId).toBeTruthy()

  // 李娜评论 @张伟 → 只有张伟收到 mention
  const add = await request.post('/api/comments', {
    headers: bearer(member),
    data: { issueId, authorId: 'member-2', body: '@张伟 请确认' },
  })
  expect(add.status()).toBe(201)

  const mine = (await (
    await request.get('/api/notifications', { headers: bearer(admin) })
  ).json()) as { items: Array<{ id: string; type: string; readAt: number | null }> }
  expect(mine.items.length).toBeGreaterThan(0)
  expect(mine.items[0].type).toBe('mention')
  const other = (await (
    await request.get('/api/notifications', { headers: bearer(member) })
  ).json()) as { items: unknown[] }
  expect(other.items).toEqual([])

  const id = mine.items[0].id
  expect(
    (await request.post(`/api/notifications/${id}/read`, { headers: bearer(admin) })).ok(),
  ).toBe(true)
  const after = (await (
    await request.get('/api/notifications', { headers: bearer(admin) })
  ).json()) as { items: Array<{ readAt: number | null }> }
  expect(after.items[0].readAt).not.toBeNull()

  // 别人的通知 id：404（不确认其他成员收件箱存在性）
  expect(
    (await request.post(`/api/notifications/${id}/read`, { headers: bearer(member) })).status(),
  ).toBe(404)
  expect((await request.post('/api/notifications/read-all', { headers: bearer(admin) })).ok()).toBe(
    true,
  )
  const allRead = (await (
    await request.get('/api/notifications', { headers: bearer(admin) })
  ).json()) as { items: Array<{ readAt: number | null }> }
  expect(allRead.items.every((n) => n.readAt !== null)).toBe(true)
})
