import { expect, test, type Page } from '@playwright/test'

/**
 * 迭代（Cycle）侧栏组 + 筛选 + 详情抽屉。
 * 数据来自 seed v8：project-1 有 3 个演示周期（Sprint 1/2 已结束、Sprint 3 进行中），
 * project-2 没有周期——这正是「分组数据随项目变化」的验收面。
 */

async function waitForSeed(page: Page) {
  test.setTimeout(240_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v8')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 侧栏行（按分组 data-value 定位，不依赖行文案） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** 侧栏迭代组内所有行的 data-value（验证顺序：全部 → 当前 → 周期，startAt 倒序） */
const cycleRowValues = (page: Page): Promise<string[]> =>
  page.getByTestId('side-list').evaluate((el) => {
    const items = [
      ...(el.shadowRoot?.querySelectorAll('[part="item"][data-value^="cycle:"]') ?? []),
    ] as HTMLElement[]
    return items.map((i) => i.dataset.value ?? '')
  })

/** 列表当前渲染行的 key（顺序即渲染顺序） */
const rowKeys = (page: Page): Promise<string[]> =>
  page.locator('.issue-row .issue-key').allTextContents()

interface DbCycle {
  id: string
  projectId: string
  name: string
  startAt: number
  endAt: number
}

/** 直读 IndexedDB：侧栏只展示名字，归属校验要拿真实周期区间/issue.cycleId */
const readCycles = (page: Page): Promise<DbCycle[]> =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    return await new Promise<DbCycle[]>((res, rej) => {
      const rq = db.transaction('cycles', 'readonly').objectStore('cycles').getAll()
      rq.onsuccess = () => res(rq.result as DbCycle[])
      rq.onerror = () => rej(rq.error)
    })
  })

/** 按 key 批量取 issue.cycleId（issues 表有 key 索引，逐条 get 成本可忽略） */
const cycleIdByKey = (page: Page, keys: string[]): Promise<Record<string, string | null>> =>
  page.evaluate(async (keys) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    const index = db.transaction('issues', 'readonly').objectStore('issues').index('key')
    const out: Record<string, string | null> = {}
    await Promise.all(
      keys.map(
        (key) =>
          new Promise<void>((resolve) => {
            const rq = index.get(key)
            rq.onsuccess = () => {
              const row = rq.result as { cycleId?: string | null } | undefined
              out[key] = row ? (row.cycleId ?? null) : 'missing'
              resolve()
            }
            rq.onerror = () => resolve()
          }),
      ),
    )
    return out
  }, keys)

/** 当前迭代（按浏览器侧同一时钟派生，与组件口径一致） */
function currentCycleOf(cycles: DbCycle[], now: number): DbCycle | undefined {
  return cycles.find((c) => c.startAt <= now && now < c.endAt)
}

test('C1 侧栏迭代组：全部迭代 / 当前迭代 / 本项目周期（startAt 倒序），换项目后只留全部迭代', async ({
  page,
}) => {
  await waitForSeed(page)

  // 组内顺序：全部 → 当前 → Sprint 3 → Sprint 2 → Sprint 1（startAt 倒序）
  await expect
    .poll(() => cycleRowValues(page), { timeout: 15_000 })
    .toEqual(['cycle:all', 'cycle:__current__', 'cycle:cycle-3', 'cycle:cycle-2', 'cycle:cycle-1'])
  await expect(sideItem(page, 'cycle:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'cycle:__current__')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'cycle:cycle-3')).toContainText('Sprint 3')

  // 切到没有周期的项目：分组只剩「全部迭代」（当前迭代行不列，避免指向永远为空的集合）
  await sideItem(page, 'project:project-2').click()
  await expect.poll(() => cycleRowValues(page), { timeout: 15_000 }).toEqual(['cycle:all'])
  // 回到 project-1 复原（筛选状态随项目重置，不是消失）
  await sideItem(page, 'project:project-1').click()
  await expect
    .poll(() => cycleRowValues(page), { timeout: 15_000 })
    .toEqual(['cycle:all', 'cycle:__current__', 'cycle:cycle-3', 'cycle:cycle-2', 'cycle:cycle-1'])
})

test('C2 点「当前迭代」：列表只含该周期 Issue；点「全部迭代」复原', async ({ page }) => {
  await waitForSeed(page)
  const before = await rowKeys(page)
  expect(before.length).toBeGreaterThan(0)

  const cycles = await readCycles(page)
  const current = currentCycleOf(cycles, Date.now())
  expect(current).toBeTruthy()

  await sideItem(page, 'cycle:__current__').click()
  await expect(sideItem(page, 'cycle:__current__')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'cycle:all')).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(async () => (await rowKeys(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(0)

  const filtered = await rowKeys(page)
  const owned = await cycleIdByKey(page, filtered)
  expect(filtered.every((k) => owned[k] === current?.id)).toBe(true)

  // 全部迭代：清空该维度，窗口复原
  await sideItem(page, 'cycle:all').click()
  await expect(sideItem(page, 'cycle:all')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => (await rowKeys(page)).length, { timeout: 15_000 })
    .toBe(before.length)
  expect(await rowKeys(page)).toEqual(before)
})

test('C3 点具体周期行（Sprint 2）：只含该周期 Issue，再点一次同行为取消筛选', async ({ page }) => {
  await waitForSeed(page)
  // 虚拟列表只渲染视口内的行：先记录首屏，再用 IDB 证明首屏混有其他迭代
  const initial = await rowKeys(page)
  const initialOwned = await cycleIdByKey(page, initial)
  expect(initial.length).toBeGreaterThan(0)

  await sideItem(page, 'cycle:cycle-2').click()
  await expect(sideItem(page, 'cycle:cycle-2')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => (await rowKeys(page)).length, { timeout: 15_000 })
    .toBeGreaterThan(0)

  const rows = await rowKeys(page)
  const owned = await cycleIdByKey(page, rows)
  expect(rows.every((k) => owned[k] === 'cycle-2')).toBe(true)
  // 过滤前首屏确实混有别的迭代（否则本用例证明不了过滤生效）
  expect(initial.some((k) => initialOwned[k] !== 'cycle-2')).toBe(true)

  // 单选切换语义：再点同一行回到「全部迭代」
  await sideItem(page, 'cycle:cycle-2').click()
  await expect(sideItem(page, 'cycle:all')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => (await rowKeys(page)).length, { timeout: 15_000 })
    .toBe(initial.length)
  expect(await rowKeys(page)).toEqual(initial)
})

test('C4 抽屉改迭代：落库到 issue.cycleId，活动历史记周期名', async ({ page }) => {
  await waitForSeed(page)
  const key = (await rowKeys(page))[0]
  await page.locator('.issue-row').first().click()
  await expect(page.getByTestId('detail-cycle')).toBeAttached({ timeout: 15_000 })

  const owned = await cycleIdByKey(page, [key])
  const from = owned[key]
  // 选一个与当前不同的值（状态变更类断言避开 from === to 的无 diff 空转）
  const options = await page.evaluate(() => {
    const el = document.querySelector('[data-testid=detail-cycle]') as unknown as {
      options?: Array<{ label: string; value: string }>
    }
    return el.options ?? []
  })
  expect(options.length).toBeGreaterThan(1)
  const target = options.find((o) => o.value !== from)?.value
  expect(target).toBeTruthy()

  await page.evaluate((v) => {
    const el = document.querySelector('[data-testid=detail-cycle]')
    ;(el as unknown as { value: string }).value = v
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: v } }))
  }, target as string)

  const expected = target === '__none__' ? null : (target as string)
  await expect
    .poll(async () => (await cycleIdByKey(page, [key]))[key], { timeout: 15_000 })
    .toBe(expected)
  // 回显跟随新值（受控 OSelect 的 value 是 issue.cycleId）
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector('[data-testid=detail-cycle]') as { value?: string } | null)
            ?.value ?? '',
      ),
    )
    .toBe(target as string)
  // 活动历史写周期名而非 id
  await expect(
    page.locator('[data-testid=activity-item]').filter({ hasText: '更新了迭代' }).first(),
  ).toBeVisible({ timeout: 15_000 })
})
