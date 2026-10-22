import { expect, test, type Page } from '@playwright/test'

async function openApp(page: Page) {
  await page.goto('/')
  // 高负载下 100K 播种可能超 100s：与主用例预算保持同一口径
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v9') === '1', {
    timeout: 180_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
}

const setView = (page: Page, v: string) =>
  page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & {
      value: string
    }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)

async function openFirstDrawer(page: Page) {
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
}

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

async function captureViews(page: Page, suffix: string) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-list${suffix}.png` })

  await setView(page, 'board')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-board${suffix}.png` })

  await setView(page, 'dashboard')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `shots/pm-dash${suffix}.png` })

  // 迭代报表卡（当前迭代燃尽 + 近 6 期完成量）：仪表盘纵向滚动到底部再截
  await expect
    .poll(
      async () => {
        const raw = await page.getByTestId('chart-burndown').getAttribute('data')
        return /"data":\[\d/.test(raw ?? '') ? 1 : 0
      },
      { timeout: 60_000 },
    )
    .toBe(1)
  await page.getByTestId('velocity-box').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-dash-cycles${suffix}.png` })

  await setView(page, 'timeline')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `shots/pm-timeline${suffix}.png` })

  await setView(page, 'resource')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `shots/pm-resource${suffix}.png` })

  // 日程视图：月历 + 周（seed 演示组每天每桶约 2 条 → week 桶块 60min 平铺；
  // 精确同刻的并排见 schedule same moment 用例）
  await setView(page, 'schedule')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `shots/pm-schedule-month${suffix}.png` })

  await page.getByTestId('schedule-gantt').locator("button[data-view='week']").click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-schedule-week${suffix}.png` })

  // day 视图：导航到次日（seed 演示组 day+1 含精确时刻 15:45/16:20 与 pm 桶块混排）
  await page.getByTestId('schedule-gantt').locator("button[data-view='day']").click()
  await page.waitForTimeout(800)
  await page.getByTestId('schedule-gantt').locator('[part="next"]').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-schedule-day${suffix}.png` })

  // 回列表验证切换往返不丢行
  await setView(page, 'issues')
  await page.waitForSelector('.issue-row', { timeout: 15_000 })
  await page.waitForTimeout(800)
}

async function captureDrawerAndCreate(page: Page, suffix: string) {
  await openFirstDrawer(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/pm-drawer${suffix}.png` })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.getByTestId('toolbar-new').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-create${suffix}.png` })
}

async function expectDarkTheme(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? ''))
    .toBe('dark')
}

/** API 模式（DEV 决断 localStorage oas-pm-data=api）：不跑 Dexie seed，数据来自 mock 端点。
 *  API 模式需要会话：预置 admin token，否则首屏停在登录页。
 *  expectRows=false 用于故意让首屏请求失败的截图（无行可等） */
async function openApiApp(page: Page, theme: 'light' | 'dark' = 'light', expectRows = true) {
  const login = await page.request.post('/api/auth/login', {
    data: { email: 'user1@oas.dev', password: 'oas' },
  })
  expect(login.ok()).toBe(true)
  const { token } = (await login.json()) as { token: string }
  await page.addInitScript(
    ([mode, authToken]) => {
      localStorage.setItem('oas-pm-data', 'api')
      localStorage.setItem('oas-pm-theme', mode)
      localStorage.setItem('oas-pm-token', authToken)
    },
    [theme, token] as const,
  )
  const reset = await page.request.post('/api/admin/reset', {
    headers: { authorization: `Bearer ${token}` },
  })
  expect(reset.ok()).toBe(true)
  await page.goto('/')
  await expect(page.getByTestId('data-source-badge')).toHaveText('API', { timeout: 20_000 })
  if (!expectRows) return
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
  if (theme === 'dark') await expectDarkTheme(page)
  // 行渲染早于成员/权限就绪时勾选列缺失、头像退化成灰色 ?——断言两者可见后再截图
  await expect(page.locator('.issue-row .row-check').first()).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(
      () =>
        page.locator('.issue-row oas-avatar').evaluateAll(
          (els) =>
            els.filter((el) => {
              const text = (el.shadowRoot?.querySelector('[part=text]')?.textContent ?? '').trim()
              return text !== '' && text !== '?'
            }).length,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0)
}

async function openAdmin(page: Page) {
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-tab-overview')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(
      () =>
        page
          .getByTestId('admin-table-health')
          .evaluate((el) => ((el as { data?: unknown[] }).data ?? []).length),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0)
}

const tableDataLength = (page: Page, testid: string) =>
  page.getByTestId(testid).evaluate((el) => ((el as { data?: unknown[] }).data ?? []).length)

async function captureAdminTabs(page: Page, suffix: string) {
  await expect
    .poll(
      async () => {
        const d = await page.getByTestId('admin-chart-workload').getAttribute('data')
        return /"data":\[\d/.test(d ?? '') ? 1 : 0
      },
      { timeout: 60_000 },
    )
    .toBe(1)
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `shots/pm-admin-overview${suffix}.png` })

  await page.getByTestId('admin-nav-projects').click()
  await expect(page.getByTestId('admin-tab-projects')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => tableDataLength(page, 'admin-table-projects'), { timeout: 30_000 })
    .toBeGreaterThan(0)
  await expect(page.getByTestId('admin-table-projects').locator('tbody tr').first()).toBeVisible({
    timeout: 10_000,
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-admin-projects${suffix}.png` })

  await page.getByTestId('admin-nav-members').click()
  await expect(page.getByTestId('admin-tab-members')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => tableDataLength(page, 'admin-table-members'), { timeout: 30_000 })
    .toBeGreaterThan(0)
  await expect(page.getByTestId('admin-table-members').locator('tbody tr').first()).toBeVisible({
    timeout: 10_000,
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-admin-members${suffix}.png` })

  await page.getByTestId('admin-nav-cycles').click()
  await expect(page.getByTestId('admin-tab-cycles')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-table-cycles').locator('tbody tr').first()).toBeVisible({
    timeout: 30_000,
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-admin-cycles${suffix}.png` })

  // 新建迭代弹窗：名称/项目/起止/目标 + 重叠警告（与进行中的 Sprint 3 区间重叠）
  await page.getByTestId('admin-cycle-new').click()
  await expect(page.getByTestId('admin-cycle-modal')).toHaveAttribute('visible', /.*/)
  const today = new Date()
  const dayStr = (offset: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  await page.getByTestId('admin-cycle-name').evaluate((el, v) => {
    const host = el as HTMLElement
    const input = host.shadowRoot?.querySelector('input') as HTMLInputElement | null
    if (input) input.value = v
    host.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: v } }))
  }, 'Sprint 4')
  for (const [tid, v] of [
    ['admin-cycle-start', dayStr(0)],
    ['admin-cycle-end', dayStr(7)],
  ] as const) {
    await page.getByTestId(tid).evaluate((el, val) => {
      ;(el as unknown as { value: string }).value = val
      el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    }, v)
  }
  await expect(page.getByTestId('admin-cycle-overlap-warn')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/pm-admin-cycle-modal${suffix}.png` })
  await page.getByTestId('admin-cycle-cancel').click()
  await expect(page.getByTestId('admin-cycle-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })

  // 结转确认弹窗：目标二选一（有下一周期时默认「移到下一周期」，无则只可移出）
  await page
    .getByTestId('admin-table-cycles')
    .locator('tbody tr', { hasText: 'Sprint 3' })
    .getByTestId(/^admin-cycle-close-/)
    .click()
  await expect(page.getByTestId('admin-cycle-close-modal')).toHaveAttribute('visible', /.*/)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `shots/pm-admin-cycle-close${suffix}.png` })
  await page.getByTestId('admin-cycle-close-cancel').click()
  await expect(page.getByTestId('admin-cycle-close-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })

  await page.getByTestId('admin-nav-config').click()
  await expect(page.getByTestId('admin-config-labels')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-config-priorities')).toBeVisible()
  await expect(page.getByTestId('admin-config-statuses')).toBeVisible()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-admin-config${suffix}.png` })

  await page.getByTestId('admin-nav-permissions').click()
  const matrix = page.getByTestId('admin-permissions-matrix')
  await expect(matrix).toBeVisible({ timeout: 10_000 })
  await expect(matrix.locator('tbody tr')).toHaveCount(14, { timeout: 10_000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-admin-permissions${suffix}.png` })

  await page.getByTestId('admin-nav-settings').click()
  await expect(page.getByTestId('admin-data-actions')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-admin-settings${suffix}.png` })
}

async function captureReadonlyDrawer(page: Page, suffix: string) {
  await switchUser(page, 'member-4')
  await expect(page.locator('.issue-row .row-check')).toHaveCount(0)
  await openFirstDrawer(page)
  await expect(page.getByTestId('detail-status')).toHaveAttribute('disabled', /.*/, {
    timeout: 15_000,
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/pm-drawer-readonly${suffix}.png` })
}

async function captureSidebar(page: Page, suffix: string) {
  await page.waitForTimeout(1500)
  await page.getByTestId('side-panel').screenshot({ path: `shots/pm-sidebar${suffix}.png` })
}

async function captureSidebarCollapsed(page: Page, suffix: string) {
  const sidebar = page.getByTestId('side-list')
  await sidebar.locator('[part="toggle"]').click()
  await expect(sidebar).toHaveAttribute('collapsed', '')
  await page.waitForTimeout(800)
  await page
    .getByTestId('side-panel')
    .screenshot({ path: `shots/pm-sidebar-collapsed${suffix}.png` })
}

/** 侧栏行（按分组 data-value 定位，不依赖行文案） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** 多选筛选态：两状态并集 + 成员 + 两优先级（组内 OR / 组间 AND）。
 *  侧栏内容超出视口：分「顶部（状态组）」与「底部（优先级组 + 成员）」两张，供目检多高亮 */
async function captureFilterSelection(page: Page, suffix: string) {
  await sideItem(page, 'status:todo').click()
  await sideItem(page, 'status:in_progress').click()
  await sideItem(page, 'member:member-2').click()
  await sideItem(page, 'priority:urgent').click()
  await sideItem(page, 'priority:high').click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-filters-list${suffix}.png` })

  const scrollPanel = (top: boolean) =>
    page.getByTestId('side-list').evaluate((el, toTop) => {
      const panel = el.shadowRoot?.querySelector<HTMLElement>('.panel')
      if (panel) panel.scrollTop = toTop ? 0 : panel.scrollHeight
    }, top)

  await scrollPanel(true)
  await page.waitForTimeout(400)
  await page.getByTestId('side-panel').screenshot({ path: `shots/pm-filters-sidebar${suffix}.png` })

  await scrollPanel(false)
  await page.waitForTimeout(400)
  await page
    .getByTestId('side-panel')
    .screenshot({ path: `shots/pm-filters-sidebar-bottom${suffix}.png` })
}

/** 迭代组：当前迭代筛选 + 侧栏迭代组（分组在优先级之后，滚动到可见再截图） */
async function captureCycles(page: Page, suffix: string) {
  await sideItem(page, 'cycle:__current__').click()
  await expect(sideItem(page, 'cycle:__current__')).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-list-current-cycle${suffix}.png` })

  await page.getByTestId('side-list').evaluate((el) => {
    el.shadowRoot
      ?.querySelector('[part="item"][data-value="cycle:__current__"]')
      ?.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(400)
  await page.getByTestId('side-panel').screenshot({ path: `shots/pm-sidebar-cycles${suffix}.png` })
}

test('shots', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureViews(page, '')
  await captureDrawerAndCreate(page, '')

  console.log('shots done')
})

test('shots drawer custom time', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await openFirstDrawer(page)
  // segmented 切「自定义」（不写库）：time-picker 带当前时刻出现
  await page.evaluate(() => {
    document
      .querySelector('[data-testid=detail-due-bucket]')
      ?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: 'custom' } }))
  })
  await expect(page.getByTestId('detail-due-time')).toBeAttached({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/pm-drawer-custom-time.png' })
})

test('shots schedule same moment', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await page.getByTestId('schedule-gantt').locator("button[data-view='week']").click()
  await page.waitForTimeout(1000)

  // 造精确同刻组：取当前周可见列里事件最多的一天，把该日 3 条事件对应的 issue 的 dueAt
  // 改写成同一天 11:00（非桶时刻）。宿主派生出的 3 块 start 相同 → 验收组件贪心车道并排
  //（宿主已不再自行 +30k 错位）。改写走 raw IDB + reload：只动当前载入窗口内的行，
  // 否则改到窗口外的行不会进派生。
  const pick = await page.getByTestId('schedule-gantt').evaluate((el) => {
    const evs = (
      (el as unknown as { events?: { id: string; date: string }[] }).events ?? []
    ).filter((e) => !!e.date && !e.id.startsWith('__more__'))
    const cols = [...(el.shadowRoot?.querySelectorAll<HTMLElement>('.col') ?? [])].map(
      (c) => c.dataset.date ?? '',
    )
    const byDate = new Map<string, string[]>()
    for (const e of evs) {
      if (!cols.includes(e.date)) continue
      byDate.set(e.date, [...(byDate.get(e.date) ?? []), e.id])
    }
    const best = [...byDate.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    return { date: best?.[0] ?? '', ids: (best?.[1] ?? []).slice(0, 3) }
  })
  expect(pick.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(pick.ids).toHaveLength(3)
  const target = pick.date
  const [y, mo, d] = target.split('-').map(Number)
  const at = Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, 11, 0)
  await page.evaluate(
    async ({ dueAt, ids }) => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const req = indexedDB.open('oas-pm')
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('issues', 'readwrite')
        const store = tx.objectStore('issues')
        for (const id of ids) {
          const get = store.get(id)
          get.onsuccess = () => {
            const row = get.result as Record<string, unknown> | undefined
            if (row) store.put({ ...row, dueAt })
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    },
    { dueAt: at, ids: pick.ids },
  )
  // 重载让 Dexie 读到改写后的同刻数据（raw IDB 写不推 liveQuery）
  await openApp(page)
  await setView(page, 'schedule')
  await expect(page.getByTestId('schedule-gantt')).toBeAttached({ timeout: 10_000 })
  await page.getByTestId('schedule-gantt').locator("button[data-view='week']").click()
  await page.waitForTimeout(1200)

  const lanes = page
    .getByTestId('schedule-gantt')
    .locator(`.col[data-date="${target}"] .event`)
    .filter({ hasText: '11:00 ' })
  await expect.poll(() => lanes.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
  const geom = await lanes.evaluateAll((els) =>
    els.map((el) => ({
      left: (el as HTMLElement).style.insetInlineStart,
      width: Math.round(el.getBoundingClientRect().width),
      top: (el as HTMLElement).style.top,
    })),
  )
  // 同刻并排：三块 left 各异、宽约 1/3 列宽、top 相同
  expect(new Set(geom.map((g) => g.top)).size).toBe(1)
  expect(new Set(geom.map((g) => g.left)).size).toBeGreaterThanOrEqual(3)
  await page.getByTestId('schedule-gantt').screenshot({ path: 'shots/pm-schedule-week-lanes.png' })

  console.log('shots schedule same moment done')
})

test('shots sidebar', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureSidebar(page, '')
  await captureSidebarCollapsed(page, '')

  console.log('shots sidebar done')
})

test('shots sidebar dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureSidebar(page, '-dark')
  await captureSidebarCollapsed(page, '-dark')

  console.log('shots sidebar dark done')
})

test('shots cycles', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureCycles(page, '')
  console.log('shots cycles done')
})

test('shots cycles dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureCycles(page, '-dark')
  console.log('shots cycles dark done')
})

test('shots filters multi', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureFilterSelection(page, '')
  console.log('shots filters multi done')
})

test('shots filters multi dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureFilterSelection(page, '-dark')
  console.log('shots filters multi dark done')
})

test('shots dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureViews(page, '-dark')
  await captureDrawerAndCreate(page, '-dark')

  console.log('shots dark done')
})

test('shots all projects', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  // 全部项目作用域：窗口跨项目（key 前缀 ≥2 种），侧栏 Projects 组「全部项目」高亮
  await sideItem(page, 'project:__all__').click()
  await expect
    .poll(
      async () => {
        const keys = await page.locator('.issue-row .issue-key').allTextContents()
        return new Set(keys.map((k) => k.slice(0, k.indexOf('-')))).size
      },
      { timeout: 20_000 },
    )
    .toBe(2)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'shots/pm-list-all-projects.png' })

  console.log('shots all projects done')
})

test('shots readonly drawer', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureReadonlyDrawer(page, '')
})

test('shots readonly drawer dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureReadonlyDrawer(page, '-dark')
})

test('shots api', async ({ page }) => {
  test.setTimeout(240_000)
  await openApiApp(page)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'shots/pm-api-list.png' })

  await openAdmin(page)
  const table = page.getByTestId('admin-table-health')
  await expect
    .poll(() => tableDataLength(page, 'admin-table-health'), { timeout: 60_000 })
    .toBeGreaterThan(0)
  await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 })
  // 健康度：至少一个项目的 stale 非零（截图要能看清「久未更新」这一列）
  await expect
    .poll(
      () =>
        table.evaluate((el) =>
          ((el as { data?: Array<{ stale?: string }> }).data ?? []).some(
            (r) => Number(String(r.stale ?? '0').replace(/,/g, '')) > 0,
          ),
        ),
      { timeout: 60_000 },
    )
    .toBe(true)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'shots/pm-api-admin-overview.png' })

  console.log('shots api done')
})

test('shots api dark', async ({ page }) => {
  test.setTimeout(240_000)
  await openApiApp(page, 'dark')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'shots/pm-api-list-dark.png' })

  console.log('shots api dark done')
})

/** 登录页（浅/深）：API 模式无会话时的首屏 */
async function openLogin(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((mode) => {
    localStorage.setItem('oas-pm-data', 'api')
    localStorage.setItem('oas-pm-theme', mode)
    localStorage.removeItem('oas-pm-token')
  }, theme)
  await page.goto('/')
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)
}

test('shots auth', async ({ page }) => {
  await openLogin(page, 'light')
  await page.screenshot({ path: 'shots/pm-login.png' })

  // 凭据错误提示
  await page.getByTestId('login-email').evaluate((el) => {
    const input = el as HTMLElement & { value?: string }
    input.value = 'user1@oas.dev'
  })
  await page.getByTestId('login-password').evaluate((el) => {
    const input = el as HTMLElement & { value?: string }
    input.value = 'wrong'
  })
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'shots/pm-login-error.png' })

  console.log('shots auth done')
})

test('shots auth dark', async ({ page }) => {
  await openLogin(page, 'dark')
  await page.screenshot({ path: 'shots/pm-login-dark.png' })

  console.log('shots auth dark done')
})

test('shots list error', async ({ page }) => {
  test.setTimeout(120_000)
  const failures = (url: URL) => url.pathname === '/api/issues'
  await page.route(failures, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'upstream unavailable' }),
    }),
  )
  await openApiApp(page, 'light', false)
  await expect(page.getByTestId('list-error')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'shots/pm-list-error.png' })

  console.log('shots list error done')
})

test('shots admin', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await openAdmin(page)
  await captureAdminTabs(page, '')

  console.log('shots admin done')
})

test('shots admin dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await openAdmin(page)
  await captureAdminTabs(page, '-dark')

  console.log('shots admin dark done')
})
