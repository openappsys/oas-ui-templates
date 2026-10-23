import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

async function setView(page: Page, v: string) {
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    ;(el as unknown as { value: string }).value = view
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
}

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

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  // 预算沿用 10 万口径（M1 仍跑 10 万，其余 5K）：轮询与用例预算统一留足
  test.setTimeout(240_000)
  // 播种规模：e2e 默认 5K（产品默认仍 10 万）。每个用例都是新上下文、都要重播种子，
  // 10 万条实测 44–134s（随负载波动），会撞穿用例预算 → 轮换式 seed 超时
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)

  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v10')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

async function openFirstRow(page: Page) {
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => {
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
  await expect(page.getByTestId('detail-status')).toBeAttached({ timeout: 15_000 })
}

async function issueStatus(page: Page, id: string): Promise<string> {
  return page.evaluate(async (issueId) => {
    const req = indexedDB.open('oas-pm')
    const db = await new Promise<IDBDatabase>((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('issues', 'readonly')
    return await new Promise<string>((res) => {
      const r = tx.objectStore('issues').get(issueId as string)
      r.onsuccess = () => res((r.result as { status?: string } | undefined)?.status ?? '')
      r.onerror = () => res('')
    })
  }, id)
}

type BoardCards = Array<{ id: string; column: string; assigneeId: string }>

function boardCards(page: Page) {
  return page.evaluate(
    () => (document.querySelector('oas-kanban') as unknown as { cards?: BoardCards }).cards ?? [],
  )
}

async function cardCursor(page: Page, id: string): Promise<string> {
  return page.evaluate((cid) => {
    const kb = document
      .querySelector('oas-kanban')
      ?.shadowRoot?.querySelector(`.card[data-id="${cid}"] .kb-card`)
    return kb ? (kb as HTMLElement).style.cursor : ''
  }, id)
}

test('P1 viewer 只读：无新建/多选/详情编辑/评论/删除，看板不持久化', async ({ page }) => {
  test.setTimeout(120_000)
  await waitForSeed(page)
  await switchUser(page, 'member-4')

  await expect(page.getByTestId('toolbar-new')).toHaveCount(0)
  await page.keyboard.press('c')
  await page.waitForTimeout(300)
  await expect(page.getByTestId('modal-create')).not.toHaveAttribute('visible', /.*/)
  await expect(page.locator('.issue-row .row-check')).toHaveCount(0)

  await openFirstRow(page)
  await expect(page.getByTestId('detail-status')).toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-priority')).toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-assignee')).toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-desc')).toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-delete-btn')).toHaveCount(0)
  await expect(page.getByTestId('comment-input')).toHaveCount(0)
  await expect(page.getByTestId('label-quick')).toHaveCount(0)
  await expect(page.getByTestId('sub-add-input')).toHaveCount(0)
  await expect(page.getByTestId('relation-add-type')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })

  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeAttached({ timeout: 10_000 })
  await expect
    .poll(async () => (await boardCards(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(0)
  const cursors = await page.evaluate(() =>
    [...(document.querySelector('oas-kanban')?.shadowRoot?.querySelectorAll('.kb-card') ?? [])].map(
      (el) => (el as HTMLElement).style.cursor,
    ),
  )
  expect(cursors.length).toBeGreaterThan(0)
  expect(cursors.every((c) => c === 'default')).toBe(true)

  const attempted = await page.evaluate(() => {
    const k = document.querySelector('oas-kanban') as HTMLElement & { cards?: BoardCards }
    const card = (k.cards ?? []).find((x) => x.column !== 'done')
    if (!card) return null
    k.dispatchEvent(
      new CustomEvent('oas-change', {
        bubbles: true,
        detail: { id: card.id, from: card.column, to: 'done', index: 0 },
      }),
    )
    return { id: card.id, from: card.column }
  })
  expect(attempted).toBeTruthy()
  await page.waitForTimeout(1000)
  expect(await issueStatus(page, attempted!.id)).toBe(attempted!.from)

  await switchUser(page, 'member-1')
})

test('P2 member 半权：可建可评，仅自己负责的 Issue 可编辑', async ({ page }) => {
  test.setTimeout(120_000)
  await waitForSeed(page)

  await sideRow(page, '我的（张伟）').click()
  const adminKey = await page.locator('.issue-row .issue-key').first().textContent()
  expect(adminKey).toBeTruthy()
  await openFirstRow(page)
  await page.getByTestId('comment-input').fill('P2 管理员评论')
  await page.getByTestId('comment-send').click()
  await expect(page.getByTestId('comment-item').first()).toContainText('P2 管理员评论', {
    timeout: 10_000,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })

  await switchUser(page, 'member-2')
  await sideRow(page, '全部 Issues').click()

  await expect(page.getByTestId('toolbar-new')).toBeVisible()
  await page.getByTestId('toolbar-new').click()
  await expect(page.getByTestId('modal-create')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await fillOInput(page, 'create-title', 'P2 member 新建')
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('modal-create')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(page.locator('.issue-row').first()).toContainText('P2 member 新建', {
    timeout: 10_000,
  })
  await expect(page.locator('.issue-row .row-check')).toHaveCount(0)

  const createdKey = await page.locator('.issue-row .issue-key').first().textContent()
  await sideRow(page, '我的（李娜）').click()
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => (await page.locator('.issue-row .issue-key').first().textContent()) ?? '')
    .not.toBe(createdKey ?? '')
  await openFirstRow(page)
  await expect(page.getByTestId('detail-status')).not.toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-priority')).not.toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('comment-input')).toBeVisible()
  await page.getByTestId('comment-input').fill('P2 成员评论')
  await page.getByTestId('comment-send').click()
  const ownComment = page.getByTestId('comment-item').filter({ hasText: 'P2 成员评论' }).first()
  await expect(ownComment).toBeVisible({ timeout: 10_000 })
  await expect(ownComment.getByTestId('comment-edit-btn')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })

  await sideRow(page, '全部 Issues').click()
  await fillOInput(page, 'toolbar-search', adminKey ?? '')
  await expect(page.locator('.issue-row').first()).toContainText(adminKey ?? '', {
    timeout: 10_000,
  })
  await openFirstRow(page)
  await expect(page.getByTestId('detail-status')).toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-delete-btn')).toHaveCount(0)
  await expect(page.getByTestId('comment-input')).toBeVisible()
  const adminComment = page.getByTestId('comment-item').filter({ hasText: 'P2 管理员评论' }).first()
  await expect(adminComment).toBeVisible({ timeout: 10_000 })
  await expect(adminComment.getByTestId('comment-edit-btn')).toHaveCount(0)
  await expect(adminComment.getByTestId('comment-del')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })
  await fillOInput(page, 'toolbar-search', '')

  await switchUser(page, 'member-1')
})

test('P3 admin 全权：viewer/member 被禁的操作点全部可用', async ({ page }) => {
  test.setTimeout(120_000)
  await waitForSeed(page)

  await expect(page.getByTestId('toolbar-new')).toBeVisible()
  await expect(page.getByTestId('save-view-btn')).toBeVisible()
  await expect(page.locator('.issue-row .row-check').first()).toBeVisible({ timeout: 10_000 })

  await openFirstRow(page)
  await expect(page.getByTestId('detail-status')).not.toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-desc')).not.toHaveAttribute('disabled', /.*/)
  await expect(page.getByTestId('detail-delete-btn')).toBeVisible()
  await expect(page.getByTestId('comment-input')).toBeVisible()
  await expect(page.getByTestId('label-quick')).toBeVisible()
  await expect(page.getByTestId('sub-add-input')).toBeVisible()
  await expect(page.getByTestId('relation-add-type')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })

  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeAttached({ timeout: 10_000 })
  await expect
    .poll(async () => (await boardCards(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(0)
  const cursors = await page.evaluate(() =>
    [...(document.querySelector('oas-kanban')?.shadowRoot?.querySelectorAll('.kb-card') ?? [])].map(
      (el) => (el as HTMLElement).style.cursor,
    ),
  )
  expect(cursors.length).toBeGreaterThan(0)
  expect(cursors.every((c) => c === 'pointer')).toBe(true)
})

test('P5 看板门禁：member 拖自己的卡持久化，他人的卡不持久化', async ({ page }) => {
  test.setTimeout(120_000)
  await waitForSeed(page)
  await switchUser(page, 'member-2')
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeAttached({ timeout: 10_000 })
  await expect
    .poll(async () => (await boardCards(page)).length, { timeout: 10_000 })
    .toBeGreaterThan(10)

  const own = await page.evaluate(() => {
    const k = document.querySelector('oas-kanban') as HTMLElement & { cards?: BoardCards }
    const card = (k.cards ?? []).find((x) => x.assigneeId === 'member-2' && x.column !== 'done')
    if (!card) return null
    k.dispatchEvent(
      new CustomEvent('oas-change', {
        bubbles: true,
        detail: { id: card.id, from: card.column, to: 'done', index: 0 },
      }),
    )
    return { id: card.id, from: card.column }
  })
  expect(own).toBeTruthy()
  await expect.poll(async () => issueStatus(page, own!.id), { timeout: 10_000 }).toBe('done')
  await expect
    .poll(
      async () =>
        (await boardCards(page)).find((c) => c.id === own!.id && c.column === 'done')?.id ?? '',
      { timeout: 10_000 },
    )
    .toBe(own!.id)
  expect(await cardCursor(page, own!.id)).toBe('pointer')

  const other = await page.evaluate(() => {
    const k = document.querySelector('oas-kanban') as HTMLElement & { cards?: BoardCards }
    const card = (k.cards ?? []).find((x) => x.assigneeId === 'member-1' && x.column !== 'done')
    if (!card) return null
    k.dispatchEvent(
      new CustomEvent('oas-change', {
        bubbles: true,
        detail: { id: card.id, from: card.column, to: 'done', index: 0 },
      }),
    )
    return { id: card.id, from: card.column }
  })
  expect(other).toBeTruthy()
  await page.waitForTimeout(1000)
  expect(await issueStatus(page, other!.id)).toBe(other!.from)
  expect(await cardCursor(page, other!.id)).toBe('default')

  await switchUser(page, 'member-1')
})
