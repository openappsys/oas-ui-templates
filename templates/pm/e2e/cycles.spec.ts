import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

/**
 * 迭代（Cycle）侧栏组 + 筛选 + 详情抽屉。
 * 数据来自 seed v9：project-1 有 3 个演示周期（Sprint 1/2 已结束、Sprint 3 进行中），
 * project-2 没有周期——这正是「分组数据随项目变化」的验收面。
 */

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

/** cycleId 索引游标统计每周期条数（不扫全表；null 不进索引，天然只数已入迭代的） */
const cycleCountsFromIdb = (page: Page): Promise<Record<string, number>> =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    return await new Promise<Record<string, number>>((res, rej) => {
      const idx = db.transaction('issues', 'readonly').objectStore('issues').index('cycleId')
      const out: Record<string, number> = {}
      const rq = idx.openKeyCursor()
      rq.onsuccess = () => {
        const cur = rq.result
        if (!cur) {
          res(out)
          return
        }
        const key = String(cur.key)
        out[key] = (out[key] ?? 0) + 1
        cur.continue()
      }
      rq.onerror = () => rej(rq.error)
    })
  })

/** 迭代组的 data-value → 角标文案（无角标 = 空串） */
const cycleBadges = (page: Page): Promise<Record<string, string>> =>
  page.getByTestId('side-list').evaluate((el) => {
    const out: Record<string, string> = {}
    const items = [
      ...(el.shadowRoot?.querySelectorAll('[part="item"][data-value^="cycle:"]') ?? []),
    ] as HTMLElement[]
    for (const item of items) {
      out[item.dataset.value ?? ''] = item.querySelector('[part="badge"]')?.textContent ?? ''
    }
    return out
  })

const digits = (s: string): number => Number(s.replace(/\D/g, '') || '0')

const setView = (page: Page, v: string) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

/** 周期自然日数（含首尾），与 lib/cycle-charts 的 cycleDays 同口径 */
const localDayCount = (startAt: number, endAt: number): number => {
  const a = new Date(startAt)
  a.setHours(0, 0, 0, 0)
  const b = new Date(endAt)
  b.setHours(0, 0, 0, 0)
  let n = 0
  for (let t = a.getTime(); t <= b.getTime(); ) {
    n += 1
    const d = new Date(t)
    d.setDate(d.getDate() + 1)
    t = d.getTime()
  }
  return n
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

/** 等到列表稳定为「全部属于该周期」的行集合。
 *  迭代直取后各周期的窗口条数可能相同（同为 500），按条数轮询分辨不出换筛选——
 *  用归属内容轮询，避免读到上一次筛选的行 */
async function expectOnlyCycle(page: Page, cycleId: string, timeout = 25_000): Promise<string[]> {
  let seen: string[] = []
  await expect
    .poll(
      async () => {
        const rows = await rowKeys(page)
        seen = rows
        if (rows.length === 0) return false
        const owned = await cycleIdByKey(page, rows)
        return rows.every((k) => owned[k] === cycleId)
      },
      { timeout, intervals: [200, 500, 1000] },
    )
    .toBe(true)
  return seen
}

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
  await expectOnlyCycle(page, current?.id ?? '')

  // 全部迭代：清空该维度，窗口复原
  await sideItem(page, 'cycle:all').click()
  await expect(sideItem(page, 'cycle:all')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => JSON.stringify(await rowKeys(page)), { timeout: 20_000 })
    .toBe(JSON.stringify(before))
})

test('C3 点具体周期行（Sprint 2）：只含该周期 Issue，再点一次同行为取消筛选', async ({ page }) => {
  await waitForSeed(page)
  // 虚拟列表只渲染视口内的行：先记录首屏，再用 IDB 证明首屏混有其他迭代
  const initial = await rowKeys(page)
  const initialOwned = await cycleIdByKey(page, initial)
  expect(initial.length).toBeGreaterThan(0)

  await sideItem(page, 'cycle:cycle-2').click()
  await expect(sideItem(page, 'cycle:cycle-2')).toHaveAttribute('aria-pressed', 'true')
  await expectOnlyCycle(page, 'cycle-2')
  // 过滤前首屏确实混有别的迭代（否则本用例证明不了过滤生效）
  expect(initial.some((k) => initialOwned[k] !== 'cycle-2')).toBe(true)

  // 单选切换语义：再点同一行回到「全部迭代」
  await sideItem(page, 'cycle:cycle-2').click()
  await expect(sideItem(page, 'cycle:all')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => JSON.stringify(await rowKeys(page)), { timeout: 20_000 })
    .toBe(JSON.stringify(initial))
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
  // 未入迭代的哨兵 __none__ 与 null 同义：直接按 value 比较会选中「同一状态」，
  // save 不产生 diff → 活动历史不落，用例在活动断言处失败（首行 issue 随 seed 规模而变）
  const norm = (v: string) => (v === '__none__' ? null : v)
  const target = options.find((o) => norm(o.value) !== from)?.value
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

test('C5 点已结束迭代（Sprint 1）：列表显示该周期的全部工作项（不再空）', async ({ page }) => {
  await waitForSeed(page)
  const initial = await rowKeys(page)
  expect(initial.length).toBeGreaterThan(0)

  await sideItem(page, 'cycle:cycle-1').click()
  await expect(sideItem(page, 'cycle:cycle-1')).toHaveAttribute('aria-pressed', 'true')
  await expectOnlyCycle(page, 'cycle-1')

  // 直取整周期：首屏条数受虚拟列表限制，但总数应远超单个 updatedAt 窗口的尾部（Sprint 1 有数千条）
  const totalText = (await page.getByTestId('issue-total').textContent()) ?? ''
  expect(digits(totalText)).toBeGreaterThan(100)
})

test('C6 侧栏迭代行角标 = 周期工作项总数；全部迭代不显示角标', async ({ page }) => {
  await waitForSeed(page)
  const counts = await cycleCountsFromIdb(page)
  expect(Object.keys(counts).length).toBeGreaterThan(0)

  for (const id of ['cycle-1', 'cycle-2', 'cycle-3']) {
    await expect
      .poll(async () => digits((await cycleBadges(page))[`cycle:${id}`] ?? ''), { timeout: 15_000 })
      .toBe(counts[id] ?? 0)
  }
  const badges = await cycleBadges(page)
  // 「全部迭代」不带角标（跨周期合计没有意义）
  expect(badges['cycle:all']).toBe('')
  // 「当前迭代」是派生行：角标 = 当前周期总数之和（本项目只有 cycle-3 在进行）
  const current = currentCycleOf(await readCycles(page), Date.now())
  expect(current).toBeTruthy()
  expect(digits(badges['cycle:__current__'] ?? '')).toBe(counts[current?.id ?? ''] ?? 0)
})

test('C7 仪表盘：当前迭代燃尽（两序列，点数 = 周期自然日）+ 近 6 期完成量柱图', async ({
  page,
}) => {
  await waitForSeed(page)
  const cycles = await readCycles(page)
  const current = currentCycleOf(cycles, Date.now())
  expect(current).toBeTruthy()
  const days = localDayCount(current?.startAt ?? 0, current?.endAt ?? 0)
  expect(days).toBeGreaterThan(1)

  await setView(page, 'dashboard')
  await expect(page.getByTestId('dashboard')).toBeVisible({ timeout: 10_000 })

  const readBurn = () =>
    page.getByTestId('chart-burndown').evaluate((el) => {
      const raw = el.getAttribute('data')
      return raw
        ? (JSON.parse(raw) as { labels: string[]; series: Array<{ data: number[] }> })
        : null
    })
  await expect
    .poll(
      async () => {
        const data = await readBurn()
        // 周期全部工作项读完才出图：两序列就位且点数与自然日一致
        return data && data.series.length === 2 && data.labels.length === days
      },
      { timeout: 60_000 },
    )
    .toBe(true)
  const burnData = (await readBurn()) as { labels: string[]; series: Array<{ data: number[] }> }
  expect(burnData.series.every((s) => s.data.length === days)).toBe(true)
  // 理想线首尾锚定（total → 0），实际线单调不增。
  // seed v9 起 done 项的 completedAt 落在周期区间内且首日不排完成：
  // 实际线首点 = 周期总量、末端仍有剩余（否则就是「平直线」缺陷回归）
  const actual = burnData.series[0]?.data ?? []
  const ideal = burnData.series[1]?.data ?? []
  expect(ideal[0]).toBeGreaterThan(0)
  expect(actual[0]).toBe(ideal[0])
  expect(ideal[ideal.length - 1]).toBe(0)
  expect(actual[actual.length - 1]).toBeGreaterThan(0)
  expect(actual[actual.length - 1]).toBeLessThan(actual[0])
  for (let i = 1; i < actual.length; i++) {
    expect(actual[i]).toBeLessThanOrEqual(actual[i - 1])
  }

  const readVelocity = () =>
    page.getByTestId('chart-velocity').evaluate((el) => {
      const raw = el.getAttribute('data')
      return raw
        ? (JSON.parse(raw) as { labels: string[]; series: Array<{ data: number[] }> })
        : null
    })
  await expect
    .poll(async () => (await readVelocity())?.series[0]?.data.some((n) => n > 0) ?? false, {
      timeout: 60_000,
    })
    .toBe(true)
  // 近 6 期只到「已结束」的两期（seed 只有 cycle-1 / cycle-2 结束）
  expect((await readVelocity())?.labels.length).toBe(2)
})

/* ── 管理端迭代闭环（复用本文件的数据探针） ── */

/** 本地日历 'YYYY-MM-DD'（与日期选择器同格式） */
function dayStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function fillOInput(page: Page, testid: string, text: string) {
  await page.evaluate(
    ([tid, val]) => {
      const host = document.querySelector(`[data-testid="${tid}"]`)
      const inner =
        (host?.shadowRoot?.querySelector('input, textarea') as HTMLInputElement) ??
        (host as HTMLInputElement | null)
      if (inner) inner.value = val as string
      host?.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: val } }))
    },
    [testid, text],
  )
}

async function setOSelect(page: Page, testid: string, v: string) {
  await page.evaluate(
    ([tid, val]) => {
      const el = document.querySelector(`[data-testid="${tid}"]`)
      ;(el as unknown as { value: string }).value = val as string
      el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    },
    [testid, v],
  )
}

/** 日期选择器：value 走 property（'YYYY-MM-DD'），oas-change detail {value} 驱动受控状态 */
async function setODate(page: Page, testid: string, v: string) {
  await page.evaluate(
    ([tid, val]) => {
      const el = document.querySelector(`[data-testid="${tid}"]`)
      ;(el as unknown as { value: string }).value = val as string
      el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    },
    [testid, v],
  )
}

/** 周期内未完成 / 已完成(+取消) 条数：cycleId 索引游标，只遍历该周期 */
const cycleStatusBreakdown = (
  page: Page,
  cycleId: string,
): Promise<{ open: number; closed: number }> =>
  page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    const idx = db.transaction('issues', 'readonly').objectStore('issues').index('cycleId')
    let open = 0
    let closed = 0
    await new Promise<void>((res, rej) => {
      const rq = idx.openCursor(IDBKeyRange.only(id))
      rq.onsuccess = () => {
        const cur = rq.result
        if (!cur) {
          res()
          return
        }
        const status = (cur.value as { status: string }).status
        if (status === 'done' || status === 'cancelled') closed += 1
        else open += 1
        cur.continue()
      }
      rq.onerror = () => rej(rq.error)
    })
    return { open, closed }
  }, cycleId)

test('C8 管理端关闭当前迭代并移到下一周期：未完成项改挂、两边计数与侧栏角标更新', async ({
  page,
}) => {
  await waitForSeed(page)
  const current = currentCycleOf(await readCycles(page), Date.now())
  expect(current).toBeTruthy()
  const cycleId = current?.id ?? ''
  const before = await cycleStatusBreakdown(page, cycleId)
  expect(before.open).toBeGreaterThan(0)
  expect(before.closed).toBeGreaterThan(0)

  // 建「下一周期」：明天起 14 天（startAt > 当前周期 startAt → 才会被判为 next）
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-cycles').click()
  await expect(page.getByTestId('admin-tab-cycles')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('admin-cycle-new').click()
  await expect(page.getByTestId('admin-cycle-modal')).toHaveAttribute('visible', /.*/)
  await fillOInput(page, 'admin-cycle-name', 'Sprint 4')
  await setOSelect(page, 'admin-cycle-project', 'project-1')
  await setODate(page, 'admin-cycle-start', dayStr(1))
  await setODate(page, 'admin-cycle-end', dayStr(14))
  await page.getByTestId('admin-cycle-save').click()
  await expect(page.getByTestId('admin-cycle-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })

  const table = page.getByTestId('admin-table-cycles')
  const nextRow = table.locator('tbody tr', { hasText: 'Sprint 4' })
  await expect(nextRow).toBeVisible({ timeout: 15_000 })
  await expect(nextRow).toContainText('未开始')

  // 关闭当前迭代：默认「移到下一周期」（弹窗里能看到下一周期名）
  await table
    .locator('tbody tr', { hasText: current?.name ?? '' })
    .getByTestId(/^admin-cycle-close-/)
    .click()
  await expect(page.getByTestId('admin-cycle-close-modal')).toHaveAttribute('visible', /.*/)
  await expect(page.getByTestId('admin-cycle-no-next')).toHaveCount(0)
  await expect(page.getByTestId('admin-cycle-close-modal')).toContainText('Sprint 4')
  await page.getByTestId('admin-cycle-close-confirm').click()
  await expect(page.getByTestId('admin-cycle-close-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 20_000,
  })
  await expect(page.getByTestId('admin-cycle-notice')).toBeVisible()

  // 归属：原周期只剩 done/cancelled，未完成项整体迁入 Sprint 4
  const after = await readCycles(page)
  const next = after.find((c) => c.name === 'Sprint 4')
  expect(next).toBeTruthy()
  await expect
    .poll(async () => (await cycleStatusBreakdown(page, cycleId)).open, { timeout: 20_000 })
    .toBe(0)
  expect((await cycleStatusBreakdown(page, cycleId)).closed).toBe(before.closed)
  await expect
    .poll(async () => (await cycleStatusBreakdown(page, next?.id ?? '')).open, { timeout: 20_000 })
    .toBe(before.open)

  // 关掉的周期在表里变成「已结束」
  await expect(table.locator('tbody tr', { hasText: current?.name ?? '' })).toContainText('已结束')

  // 侧栏角标跟随：原周期角标 = 剩余 done/cancelled，Sprint 4 = 迁入的未完成数；
  // 关闭后没有进行中的周期 → 「当前迭代」角标归零
  await page.getByTestId('admin-back').click()
  await expect(page.getByTestId('side-panel')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => digits((await cycleBadges(page))[`cycle:${cycleId}`] ?? ''), {
      timeout: 20_000,
    })
    .toBe(before.closed)
  await expect
    .poll(async () => digits((await cycleBadges(page))[`cycle:${next?.id ?? ''}`] ?? ''), {
      timeout: 20_000,
    })
    .toBe(before.open)
  await expect
    .poll(async () => digits((await cycleBadges(page))['cycle:__current__'] ?? ''), {
      timeout: 20_000,
    })
    .toBe(0)
})
