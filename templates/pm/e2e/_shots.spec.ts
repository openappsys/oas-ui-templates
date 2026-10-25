import { expect, test, type Page } from '@playwright/test'

async function openApp(page: Page) {
  // 播种规模：截图用例同样走 e2e 默认 5K（$12 万，截图内容与条数无关）
  await page.addInitScript(() => localStorage.setItem('oas-pm-seed-size', '5000'))
  await page.goto('/')
  // 预算沿用 10 万口径：与主用例保持同一口径
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
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
  await page.getByTestId('user-menu').getByRole('menuitem', { name: '切换身份' }).click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

/** 侧栏成员组：先「全部成员」清空，再逐个点选；顶部筛选栏模式回退到多选控件 */
async function setAssigneeFilter(page: Page, ids: string[]) {
  const nav = page.getByTestId('side-list')
  const all = nav.locator('[part="item"][data-value="assignee:all"]')
  if (await all.count()) {
    await all.click()
    for (const id of ids) {
      await nav.locator(`[part="item"][data-value="assignee:${id}"]`).click()
    }
    return
  }
  await page.evaluate((values) => {
    const el = document.querySelector('[data-testid="filters-assignee"]') as
      | (HTMLElement & { value?: string[] })
      | null
    if (!el) return
    el.value = values
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: values } }))
  }, ids)
}

/** 造两条未读通知（李娜 @张伟 评论 + 把李娜负责的 Issue 改派张伟），切回张伟后截图 */
async function composeUnreadNotifications(page: Page) {
  await switchUser(page, 'member-2')
  await setAssigneeFilter(page, ['member-1'])
  await page.waitForTimeout(1000)
  await openFirstDrawer(page)
  await page.getByTestId('comment-input').fill('@张伟 请确认排期')
  await page.getByTestId('comment-send').click()
  await expect(page.getByTestId('comment-item').last()).toContainText('@张伟', {
    timeout: 10_000,
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  await setAssigneeFilter(page, ['member-2'])
  await page.waitForTimeout(1200)
  await openFirstDrawer(page)
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=detail-assignee]') as HTMLElement & {
      value?: string
    }
    if (!el) return
    el.value = 'member-1'
    el.dispatchEvent(
      new CustomEvent('oas-change', { bubbles: true, detail: { value: 'member-1' } }),
    )
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  await switchUser(page, 'member-1')
  await expect(page.getByTestId('notify-badge')).toBeVisible({ timeout: 20_000 })
}

/** WCAG 相对亮度/对比度（登录页主按钮实测用；rgba 文本先按底色合成） */
function parseRgb(input: string): [number, number, number, number] {
  const m = input.match(/rgba?\(([^)]+)\)/)
  const parts = (m?.[1] ?? '0,0,0,1')
    .split(/[,/\s]+/)
    .filter(Boolean)
    .map(Number)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1]
}

function luminance([r, g, b]: [number, number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 登录页主按钮文字/底色对比度（取 oas-button shadow 内的内部按钮计算样式） */
async function measureLoginContrast(page: Page) {
  const raw = await page.getByTestId('login-submit').evaluate((host) => {
    const btn = (host.shadowRoot?.querySelector('button') as HTMLElement | null) ?? host
    const cs = getComputedStyle(btn)
    return { color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize }
  })
  const fg = parseRgb(raw.color)
  const bg = parseRgb(raw.background)
  // 文字半透明时按底色合成，再算比值
  const a = fg[3]
  const fgOverBg: [number, number, number, number] = [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ]
  const [hi, lo] = [luminance(fgOverBg), luminance(bg)].sort((x, y) => y - x)
  return { ratio: Number(((hi + 0.05) / (lo + 0.05)).toFixed(2)), raw }
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
  await expect(matrix.locator('tbody tr:not(.group-header)')).toHaveCount(15, { timeout: 10_000 })
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

/** 定稿布局：顶栏三段 / 设置菜单 / 用户菜单 / 侧栏分区 / 表头全选（双主题各截一组） */
async function captureLayout(page: Page, suffix: string) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-layout${suffix}.png` })
  await page.getByTestId('pm-toolbar').screenshot({ path: `shots/pm-topbar${suffix}.png` })

  await page.getByTestId('settings-trigger').click()
  await expect(page.getByTestId('settings-menu')).toHaveAttribute('open', /.*/, { timeout: 10_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `shots/pm-settings-menu${suffix}.png` })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-menu')).not.toHaveAttribute('open', /.*/, {
    timeout: 5_000,
  })

  // 用户菜单（oas-dropdown）：先截展开态，再点「切换身份」截既有身份弹窗
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('user-menu')).toHaveAttribute('open', /.*/, { timeout: 10_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `shots/pm-user-menu${suffix}.png` })
  await page.getByTestId('user-menu').getByRole('menuitem', { name: '切换身份' }).click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `shots/pm-user-picker${suffix}.png` })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })

  // 侧栏分区 + 折叠态
  await captureSidebar(page, suffix)
  await page.getByTestId('side-list').locator('[part="item"][data-value="group:status"]').click()
  await page.waitForTimeout(500)
  await page.getByTestId('side-panel').screenshot({ path: `shots/pm-sidebar-folded${suffix}.png` })
  await page.getByTestId('side-list').locator('[part="item"][data-value="group:status"]').click()

  // 表头全选（批量栏计数 = 已加载数）
  await page.getByTestId('select-all').click()
  await expect(page.getByTestId('bulk-bar')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `shots/pm-select-all${suffix}.png` })
  await page.getByTestId('bulk-cancel').click()
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0, { timeout: 5_000 })
}

/** 多选筛选态：两状态并集 + 成员（工具条多选 chips）+ 两优先级（组内 OR / 组间 AND）。
 *  侧栏内容超出视口：分「顶部（状态组）」与「底部（优先级组 + 迭代组）」两张，供目检多高亮 */
async function captureFilterSelection(page: Page, suffix: string) {
  await sideItem(page, 'status:todo').click()
  await sideItem(page, 'status:in_progress').click()
  await setAssigneeFilter(page, ['member-2'])
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

/** 筛选位置：设置菜单 → oas-dropdown 单选组（menuitemradio）→ Esc 收起 */
const PLACEMENT_LABEL: Record<string, string> = {
  sidebar: '侧栏',
  topbar: '顶部',
  both: '两者',
}
async function setPlacement(page: Page, value: string) {
  await page.getByTestId('settings-trigger').click()
  await expect(page.getByTestId('settings-menu')).toHaveAttribute('open', /.*/, { timeout: 10_000 })
  await page
    .getByTestId('settings-menu')
    .getByRole('menuitemradio', { name: PLACEMENT_LABEL[value] ?? value })
    .click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-menu')).not.toHaveAttribute('open', /.*/, {
    timeout: 5_000,
  })
}

/** 三态（侧栏/顶部/两者）+ 四个视图的顶栏筛选控件，供目检「同一筛选两处同源」 */
async function captureFilterPlacement(page: Page, suffix: string) {
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-placement-sidebar${suffix}.png` })

  await setPlacement(page, 'topbar')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-placement-topbar${suffix}.png` })

  await setPlacement(page, 'both')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-placement-both${suffix}.png` })

  // 顶部模式下逐视图复核筛选栏在场（仪表盘不在筛选视图内）
  await setPlacement(page, 'topbar')
  for (const view of ['board', 'timeline', 'resource', 'schedule']) {
    await setView(page, view)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `shots/pm-placement-topbar-${view}${suffix}.png` })
  }
  await setView(page, 'issues')
  await page.waitForTimeout(600)
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

/** 侧栏成员组：多选回显 + 列表联动（双主题目检） */
async function captureAssigneeFilter(page: Page, suffix: string) {
  const nav = page.getByTestId('side-list')
  await nav.locator('[part="item"][data-value="assignee:all"]').click()
  for (const id of ['member-1', 'member-2']) {
    await nav.locator(`[part="item"][data-value="assignee:${id}"]`).click()
  }
  await page.waitForTimeout(600)
  await page.locator('aside.side-panel').screenshot({
    path: `shots/pm-assignee-open${suffix}.png`,
  })
  await page.screenshot({ path: `shots/pm-assignee-chips${suffix}.png` })
}

/** 已保存视图：工具栏下拉展开 / 选中应用后列表与侧栏同步 / 侧栏组（双主题） */
async function captureSavedViews(page: Page, suffix: string) {
  const sel = page.getByTestId('saved-view-select')
  await sel.locator('button.trigger').click()
  await expect(sel.locator('.dropdown')).toHaveClass(/open/, { timeout: 5000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `shots/pm-saved-views-open${suffix}.png` })

  // 选中「高优先级待办」：列表收敛为 紧急+高 × 待办+积压，控件回占位
  await sel.locator('.option').filter({ hasText: '高优先级待办' }).first().click()
  await expect(sel.locator('.dropdown')).not.toHaveClass(/open/, { timeout: 5000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/pm-saved-views-applied${suffix}.png` })

  await page.getByTestId('side-list').evaluate((el) => {
    el.shadowRoot
      ?.querySelector('[part="item"][data-value="savedview:view-demo-1"]')
      ?.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(400)
  await page
    .getByTestId('side-panel')
    .screenshot({ path: `shots/pm-saved-views-sidebar${suffix}.png` })
}

test('shots sidebar', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureSidebar(page, '')
  await captureSidebarCollapsed(page, '')

  console.log('shots sidebar done')
})

test('shots layout', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureLayout(page, '')

  console.log('shots layout done')
})

test('shots layout dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureLayout(page, '-dark')

  console.log('shots layout dark done')
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

test('shots assignee filter', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureAssigneeFilter(page, '')
  console.log('shots assignee filter done')
})

test('shots assignee filter dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureAssigneeFilter(page, '-dark')
  console.log('shots assignee filter dark done')
})

test('shots saved views', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureSavedViews(page, '')
  console.log('shots saved views done')
})

test('shots saved views dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureSavedViews(page, '-dark')
  console.log('shots saved views dark done')
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

test('shots filter placement', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureFilterPlacement(page, '')
  console.log('shots filter placement done')
})

test('shots filter placement dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureFilterPlacement(page, '-dark')
  console.log('shots filter placement dark done')
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
  const light = await measureLoginContrast(page)
  console.log(`LOGIN_CONTRAST light=${light.ratio} ${light.raw.color} on ${light.raw.background}`)

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
  const dark = await measureLoginContrast(page)
  console.log(`LOGIN_CONTRAST dark=${dark.ratio} ${dark.raw.color} on ${dark.raw.background}`)

  console.log('shots auth dark done')
})

test('shots notifications', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await composeUnreadNotifications(page)
  await page.waitForTimeout(800)
  // 铃铛未读态（顶栏）
  await page.screenshot({ path: 'shots/pm-notify-bell.png' })
  await page.getByTestId('toolbar-notify').click()
  await expect(page.getByTestId('notify-item').first()).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/pm-notify-panel.png' })
  console.log('shots notifications done')
})

test('shots notifications dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await composeUnreadNotifications(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/pm-notify-bell-dark.png' })
  await page.getByTestId('toolbar-notify').click()
  await expect(page.getByTestId('notify-item').first()).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/pm-notify-panel-dark.png' })
  console.log('shots notifications dark done')
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

/** 造软删除样本：逐个开抽屉 → popconfirm 确认（撤销条 6s 后自动收起） */
async function seedTrash(page: Page, n = 3) {
  for (let i = 0; i < n; i++) {
    await openFirstDrawer(page)
    await page.evaluate(() => {
      document
        .querySelector('[data-testid=detail-delete]')
        ?.dispatchEvent(
          new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
        )
    })
    await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 10_000 })
    await page.waitForTimeout(300)
  }
}

/** 回收站页（工作项页签内的子视图）：滚到表格处再截，表格行含 key/标题/项目/删除时间/行操作 */
async function captureTrash(page: Page, suffix: string) {
  await seedTrash(page)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('admin-nav-config').click()
  await expect(page.getByTestId('admin-config-trash')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => tableDataLength(page, 'admin-table-trash'), { timeout: 30_000 })
    .toBeGreaterThan(0)
  await page.getByTestId('admin-config-trash').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `shots/pm-admin-trash${suffix}.png` })
}

/** 删除撤销提示条（顶栏下沿）：删除后立刻截，再点撤销复位 */
async function captureUndo(page: Page, suffix: string) {
  await openFirstDrawer(page)
  await page.evaluate(() => {
    document
      .querySelector('[data-testid=detail-delete]')
      ?.dispatchEvent(
        new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
      )
  })
  await expect(page.getByTestId('undo-bar')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `shots/pm-undo${suffix}.png` })
  await page.getByTestId('undo-action').click()
  await expect(page.getByTestId('undo-bar')).toHaveCount(0, { timeout: 5000 })
}

test('shots trash', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureTrash(page, '')
  console.log('shots trash done')
})

test('shots trash dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureTrash(page, '-dark')
  console.log('shots trash dark done')
})

test('shots undo', async ({ page }) => {
  test.setTimeout(240_000)
  await openApp(page)
  await captureUndo(page, '')
  console.log('shots undo done')
})

test('shots undo dark', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => localStorage.setItem('oas-pm-theme', 'dark'))
  await openApp(page)
  await expectDarkTheme(page)
  await captureUndo(page, '-dark')
  console.log('shots undo dark done')
})
