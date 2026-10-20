import { expect, test, type Page } from '@playwright/test'

type Ev = { id: string; date: string; title: string; color?: string; start?: string; end?: string }

/** 视图切换（oas-tabs 宿主 + oas-change 契约事件，与 resource.spec 同协议） */
async function setView(page: Page, v: string) {
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    ;(el as unknown as { value: string }).value = view
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
}

async function waitForSeed(page: Page) {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v6')), {
      timeout: 120_000,
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

/** oas-scheduler 的 events property 读回（宿主注入通道） */
function sched(page: Page) {
  return page
    .getByTestId('schedule-gantt')
    .evaluate((el) => JSON.parse(JSON.stringify((el as unknown as { events?: Ev[] }).events ?? [])))
}

function readIssue(page: Page, id: string) {
  return page.evaluate(async (issueId) => {
    const req = indexedDB.open('oas-pm')
    const db = await new Promise<IDBDatabase>((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('issues', 'readonly')
    return await new Promise<{
      startAt: number | null
      dueAt: number | null
      assigneeId: string | null
    } | null>((res) => {
      const r = tx.objectStore('issues').get(issueId as string)
      r.onsuccess = () => {
        const row = r.result as
          | { startAt: number | null; dueAt: number | null; assigneeId: string | null }
          | undefined
        res(row ? { startAt: row.startAt, dueAt: row.dueAt, assigneeId: row.assigneeId } : null)
      }
      r.onerror = () => res(null as never)
    })
  }, id)
}

/** 契约重放：events property setter（组件 setter 更新内部模型并派发 oas-events-change，同 R4 机理） */
const replay = (page: Page, id: string, patch: Partial<Ev>) =>
  page.evaluate(
    ({ id, patch }) => {
      const el = document.querySelector('[data-testid=schedule-gantt]') as unknown as {
        events?: Ev[]
      }
      el.events = (el.events ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e))
    },
    { id, patch },
  )

test('S1 映射渲染：events.date 与 dueAt 的 getUTC* 派生一致；桶展示块与月历前缀', async ({
  page,
}) => {
  await waitForSeed(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-view')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  // 逐事件对拍 DB：date === utcDay(dueAt)；allday 无 start、am/pm start 桶基点 +30min 偏移
  const audit = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid=schedule-gantt]') as unknown as {
      events?: Ev[]
    }
    const evs = el.events ?? []
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open('oas-pm')
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('issues', 'readonly')
    const get = (id: string) =>
      new Promise<{ dueAt: number | null } | undefined>((res) => {
        const r = tx.objectStore('issues').get(id)
        r.onsuccess = () => res(r.result as { dueAt: number | null } | undefined)
        r.onerror = () => res(undefined)
      })
    const pad = (n: number) => String(n).padStart(2, '0')
    let checked = 0
    let dateOk = 0
    let bucketOk = 0
    let amSeen = 0
    let pmSeen = 0
    let alldaySeen = 0
    for (const e of evs.slice(0, 60)) {
      const row = await get(e.id)
      if (!row || row.dueAt == null) continue
      checked++
      const d = new Date(row.dueAt)
      const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
      if (iso === e.date) dateOk++
      const h = d.getUTCHours()
      if (h === 0) {
        alldaySeen++
        if (e.start === undefined) bucketOk++
      } else if (h < 12) {
        amSeen++
        if (/^(09|1[0-2]):(00|30)$/.test(e.start ?? '')) bucketOk++
      } else {
        pmSeen++
        if (/^1[4-9]:(00|30)$/.test(e.start ?? '')) bucketOk++
      }
    }
    return { total: evs.length, checked, dateOk, bucketOk, amSeen, pmSeen, alldaySeen }
  })
  expect(audit.checked).toBeGreaterThan(0)
  expect(audit.dateOk).toBe(audit.checked)
  expect(audit.bucketOk).toBe(audit.checked)
  expect(audit.amSeen).toBeGreaterThan(0)
  expect(audit.pmSeen).toBeGreaterThan(0)
  expect(audit.alldaySeen).toBeGreaterThan(0)

  // 月历 chip：标题带 key 与「上午/下午」前缀（Playwright locator 穿 shadow）；
  // 月末边界时当日事件可能全在下月 → 兜底点一次下月导航
  const gantt = page.getByTestId('schedule-gantt')
  await page.waitForTimeout(600)
  if ((await gantt.locator('.chip').count()) === 0) {
    await gantt.locator('[part="next"]').click()
    await page.waitForTimeout(400)
  }
  await expect
    .poll(() => gantt.locator('.chip', { hasText: '上午 ' }).count(), { timeout: 10_000 })
    .toBeGreaterThan(0)
  await expect
    .poll(() => gantt.locator('.chip', { hasText: '下午 ' }).count(), { timeout: 10_000 })
    .toBeGreaterThan(0)
})

test('S2 契约重放写回（12:30 落下午 + startAt 钳制）；viewer 拒绝落库且回弹', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  // admin（默认 member-1）：选 seed 紧凑样本（startAt = dueAt - 1d，恒 ≤ dueAt）。
  // 前移「次日」时 newDueAt > startAt 恒成立、钳制不可能触发——回移两天才让 newDueAt < startAt 收敛
  const target = await page.evaluate(async () => {
    const el = document.querySelector('[data-testid=schedule-gantt]') as unknown as {
      events?: Ev[]
    }
    const evs = el.events ?? []
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open('oas-pm')
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('issues', 'readonly')
    return await new Promise<{ id: string; dueAt: number; startAt: number } | null>((resolve) => {
      let pending = evs.length
      let found: { id: string; dueAt: number; startAt: number } | null = null
      for (const e of evs) {
        const g = tx.objectStore('issues').get(e.id)
        g.onsuccess = () => {
          const row = g.result as
            | { id: string; dueAt: number | null; startAt: number | null }
            | undefined
          if (
            !found &&
            row &&
            row.dueAt !== null &&
            row.startAt !== null &&
            row.dueAt - row.startAt === 86400000
          ) {
            found = { id: row.id, dueAt: row.dueAt, startAt: row.startAt }
          }
          if (--pending === 0) resolve(found)
        }
        g.onerror = () => {
          if (--pending === 0) resolve(found)
        }
      }
    })
  })
  expect(target).toBeTruthy()
  const twoBack = new Date(target!.dueAt - 2 * 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const targetDate = `${twoBack.getUTCFullYear()}-${pad(twoBack.getUTCMonth() + 1)}-${pad(twoBack.getUTCDate())}`
  const expectedDue = Date.UTC(
    twoBack.getUTCFullYear(),
    twoBack.getUTCMonth(),
    twoBack.getUTCDate(),
    14,
  )
  await replay(page, target!.id, { date: targetDate, start: '12:30' })
  await expect
    .poll(async () => readIssue(page, target!.id), { timeout: 15_000 })
    .toMatchObject({ dueAt: expectedDue, startAt: expectedDue })

  // viewer（member-4）：改他人事件 → 不落库（can('issue:edit') 拒绝）且组件内部模型回弹
  await switchUser(page, 'member-4')
  const derived = await sched(page)
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)
  const viewerEv = derived.find((e) => e.id !== target!.id) ?? null
  expect(viewerEv).toBeTruthy()
  const before = await readIssue(page, viewerEv!.id)
  const beforeEvent = derived.find((e) => e.id === viewerEv!.id) ?? null
  await replay(page, viewerEv!.id, { date: '2027-06-15', start: '09:30' })
  await page.waitForTimeout(1200)
  const after = await readIssue(page, viewerEv!.id)
  expect(after?.startAt).toBe(before?.startAt)
  expect(after?.dueAt).toBe(before?.dueAt)
  expect(after?.assigneeId).toBe(before?.assigneeId)
  await expect
    .poll(async () => (await sched(page)).find((e) => e.id === viewerEv!.id) ?? null, {
      timeout: 15_000,
    })
    .toEqual(beforeEvent)

  await switchUser(page, 'member-1')
})

test('S3 resize 只改 end：不落库且 events 回弹', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)
  const ev = (await sched(page))[0]!
  const before = await readIssue(page, ev.id)
  const beforeEvent = ev
  await replay(page, ev.id, { end: '16:45' })
  await page.waitForTimeout(1200)
  expect(await readIssue(page, ev.id)).toEqual(before)
  await expect
    .poll(async () => (await sched(page)).find((e) => e.id === ev.id) ?? null, { timeout: 15_000 })
    .toEqual(beforeEvent)
})

test('S4 抽屉日期编辑器：切档落库/清空置 null；viewer 控件禁用且不落库', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)
  const evs = await sched(page)
  const timed = evs.find((e) => e.start !== undefined) ?? evs[0]!

  // event-click → 详情抽屉打开且回显当前档位
  await page.evaluate((ev) => {
    document.querySelector('[data-testid=schedule-gantt]')?.dispatchEvent(
      new CustomEvent('oas-event-click', {
        bubbles: true,
        composed: true,
        detail: { id: ev.id, event: ev },
      }),
    )
  }, timed)
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
  const before = await readIssue(page, timed.id)
  expect(before?.dueAt).not.toBeNull()
  const bd = new Date(before!.dueAt!)
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${bd.getUTCFullYear()}-${pad(bd.getUTCMonth() + 1)}-${pad(bd.getUTCDate())}`
  await expect(page.getByTestId('detail-due-date')).toHaveAttribute('value', iso, {
    timeout: 10_000,
  })

  // segmented 切档 → dueAt 收敛当日桶起点（当前档相同时也切换到另一档，保证真实变更被断言）
  const h = bd.getUTCHours()
  const curBucket = h === 0 ? 'allday' : h < 12 ? 'am' : 'pm'
  const nextBucket = curBucket === 'am' ? 'pm' : 'am'
  const expected = Date.UTC(
    bd.getUTCFullYear(),
    bd.getUTCMonth(),
    bd.getUTCDate(),
    nextBucket === 'am' ? 9 : 14,
  )
  await page.evaluate((b) => {
    document
      .querySelector('[data-testid=detail-due-bucket]')
      ?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: b } }))
  }, nextBucket)
  await expect
    .poll(async () => (await readIssue(page, timed.id))?.dueAt, { timeout: 15_000 })
    .toBe(expected)

  // ODatePicker 清空 → dueAt null
  await page.evaluate(() => {
    document
      .querySelector('[data-testid=detail-due-date]')
      ?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: '' } }))
  })
  await expect
    .poll(async () => (await readIssue(page, timed.id))?.dueAt, { timeout: 15_000 })
    .toBeNull()
  await page.keyboard.press('Escape')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector('[data-testid=detail-drawer]') as { opened?: boolean })?.opened ??
          false,
      ),
    )
    .toBe(false)

  // viewer：控件 disabled，契约重放不落库
  await switchUser(page, 'member-4')
  const evs2 = await sched(page)
  const other = evs2.find((e) => e.id !== timed.id && e.start !== undefined) ?? evs2[0]!
  await page.evaluate((ev) => {
    document.querySelector('[data-testid=schedule-gantt]')?.dispatchEvent(
      new CustomEvent('oas-event-click', {
        bubbles: true,
        composed: true,
        detail: { id: ev.id, event: ev },
      }),
    )
  }, other)
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
  await expect(page.getByTestId('detail-due-date')).toHaveAttribute('disabled', /.*/, {
    timeout: 10_000,
  })
  await expect(page.getByTestId('detail-due-bucket')).toHaveAttribute('disabled', /.*/)
  const vBefore = await readIssue(page, other.id)
  await page.evaluate(() => {
    document
      .querySelector('[data-testid=detail-due-bucket]')
      ?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'pm' } }))
  })
  await page.waitForTimeout(1000)
  expect(await readIssue(page, other.id)).toEqual(vBefore)
})

test('S5 回声守卫：同数据渲染周期不再触发 events 注入回声', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  // 挂临时计数器；IDB 轻触一个 issue（updatedAt +1ms）驱动 liveQuery 重发 →
  // 同内容 events 重建（新数组身份）→ 注入必须被签名守卫跳过（否则 oas-events-change +1）
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=schedule-gantt]')
    ;(window as unknown as { __schedEcho: number }).__schedEcho = 0
    el?.addEventListener('oas-events-change', () => {
      ;(window as unknown as { __schedEcho: number }).__schedEcho++
    })
  })
  const c0 = await page.evaluate(() => (window as unknown as { __schedEcho: number }).__schedEcho)
  await page.evaluate(async () => {
    const el = document.querySelector('[data-testid=schedule-gantt]') as unknown as {
      events?: Ev[]
    }
    const id = (el.events ?? [])[0]?.id
    if (!id) return
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open('oas-pm')
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('issues', 'readwrite')
    await new Promise<void>((res) => {
      const g = tx.objectStore('issues').get(id)
      g.onsuccess = () => {
        const row = g.result as Record<string, unknown>
        row.updatedAt = (row.updatedAt as number) + 1
        const p = tx.objectStore('issues').put(row)
        p.onsuccess = () => res()
        p.onerror = () => res()
      }
      g.onerror = () => res()
    })
  })
  await page.waitForTimeout(1500)
  const c1 = await page.evaluate(() => (window as unknown as { __schedEcho: number }).__schedEcho)
  await page.waitForTimeout(1500)
  const c2 = await page.evaluate(() => (window as unknown as { __schedEcho: number }).__schedEcho)
  expect(c1).toBe(c0)
  expect(c2).toBe(c1)
})

test('S6 视图裁剪：resource 两入口隐藏；agenda 可达且列表渲染', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await expect.poll(async () => (await sched(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  // shadow stylesheet 裁剪：按钮仍在 DOM 但 display:none（::part 后代选择器不可用，探针已证）
  const vis = await page.evaluate(() => {
    const el = document.querySelector('[data-testid=schedule-gantt]')
    const disp = (v: string) => {
      const b = el?.shadowRoot?.querySelector<HTMLElement>(`button[data-view='${v}']`)
      return b ? getComputedStyle(b).display : 'missing'
    }
    return { res: disp('resource'), resWeek: disp('resource-week'), agenda: disp('agenda') }
  })
  expect(vis.res).toBe('none')
  expect(vis.resWeek).toBe('none')
  expect(vis.agenda).not.toBe('none')

  // agenda 点击 → view attribute 变化 + 28 天清单渲染（seed 演示组在窗口内必有行）
  const gantt = page.getByTestId('schedule-gantt')
  await gantt.locator("button[data-view='agenda']").click()
  await expect(gantt).toHaveAttribute('view', 'agenda')
  await expect
    .poll(() => gantt.locator('[part="agenda"] .ag-row').count(), { timeout: 10_000 })
    .toBeGreaterThan(0)
})
