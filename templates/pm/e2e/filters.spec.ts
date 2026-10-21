import { expect, test, type Page } from '@playwright/test'

/** 等待 100K seed 完成（与 smoke.spec 同口径） */
async function waitForSeed(page: Page) {
  test.setTimeout(240_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v7')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 侧栏行（按分组 data-value 定位，避开「全部」在状态/优先级组同名） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

const rowStatuses = (page: Page) => page.locator('.issue-row .issue-status').allTextContents()

test('F1 两状态并集：行状态只含这两态，侧栏双高亮，总数文案仍是项目总量', async ({ page }) => {
  await waitForSeed(page)
  const totalBefore = await page.getByTestId('issue-total').textContent()

  await sideItem(page, 'status:todo').click()
  await sideItem(page, 'status:in_progress').click()
  await expect(sideItem(page, 'status:todo')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:in_progress')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'false')

  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && st.every((s) => s === '待办' || s === '进行中')
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  // 计数文案仍是项目全量（筛选不影响 header 计数）
  expect(await page.getByTestId('issue-total').textContent()).toBe(totalBefore)

  // 单态并集成立：再点掉一个，仅剩另一态
  await sideItem(page, 'status:todo').click()
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && st.every((s) => s === '进行中')
      },
      { timeout: 10_000 },
    )
    .toBe(true)
})

test('F2 状态 × 成员 AND：行同时满足两个维度', async ({ page }) => {
  await waitForSeed(page)
  await sideItem(page, 'status:backlog').click()
  await sideItem(page, 'status:in_progress').click()

  // 从侧栏成员组的角标里挑一个「当前窗口内仍有行」的成员，避免挑到空集
  const target = await page.getByTestId('side-list').evaluate((el) => {
    const items = [
      ...(el.shadowRoot?.querySelectorAll('[part="item"][data-value^="member:"]') ?? []),
    ] as HTMLElement[]
    for (const it of items) {
      const badge = it.querySelector('[part="badge"]')?.textContent ?? '0'
      const count = Number(badge.replace(/[^\d]/g, ''))
      const name = (it.querySelector('.label')?.textContent ?? '').trim()
      if (count > 0 && name) return { value: it.dataset.value ?? '', name }
    }
    return null
  })
  expect(target).not.toBeNull()
  const picked = target as { value: string; name: string }

  await sideItem(page, picked.value).click()
  await expect(sideItem(page, picked.value)).toHaveAttribute('aria-pressed', 'true')

  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        const names = await page
          .locator('.issue-row oas-avatar')
          .evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))
        return (
          st.length > 0 &&
          names.length > 0 &&
          st.every((s) => s === '待规划' || s === '进行中') &&
          names.every((n) => n === picked.name)
        )
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 成员组「再点取消」回到只有状态维度
  await sideItem(page, picked.value).click()
  await expect(sideItem(page, picked.value)).toHaveAttribute('aria-pressed', 'false')
})

test('F3 工具条优先级单值入口：与侧栏多选互通', async ({ page }) => {
  await waitForSeed(page)
  const pickPriority = (value: string) =>
    page.evaluate((val) => {
      const el = document.querySelector('[data-testid="filter-priority"]') as
        | (HTMLElement & { value?: string })
        | null
      if (!el) return
      el.value = val
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    }, value)

  await pickPriority('urgent')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'false')

  // 侧栏再点一个 → 变成多选，工具条回落到「已选 2 项」占位项
  await sideItem(page, 'priority:low').click()
  await expect
    .poll(() =>
      page.getByTestId('filter-priority').evaluate((el) => (el as { value?: string }).value ?? ''),
    )
    .toBe('multi')
  expect(
    await page.getByTestId('filter-priority').evaluate((el) => {
      const opts = (el as { options?: Array<{ label: string; value: string }> }).options ?? []
      return opts.find((o) => o.value === 'multi')?.label ?? ''
    }),
  ).toBe('已选 2 项')

  // 工具条选「全部」→ 清空该组
  await pickPriority('all')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:low')).toHaveAttribute('aria-pressed', 'false')
})

test('F4 优先级多选与状态 AND：两个维度同时生效', async ({ page }) => {
  await waitForSeed(page)
  await sideItem(page, 'status:todo').click()
  await sideItem(page, 'priority:urgent').click()
  await sideItem(page, 'priority:high').click()

  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:high')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'false')

  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        const pri = await page
          .locator('.issue-row .issue-priority')
          .evaluateAll((els) => els.map((el) => el.textContent ?? ''))
        return (
          st.length > 0 &&
          st.every((s) => s === '待办') &&
          pri.length > 0 &&
          pri.every((p) => p === 'urgent' || p === 'high')
        )
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 两组「全部」各自独立清空
  await sideItem(page, 'status:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'false')
})
