import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（$12 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  // 预算沿用 10 万口径（M1 仍跑 10 万，其余 5K）：轮询与用例预算统一留足
  test.setTimeout(240_000)
  // 播种规模：e2e 默认 5K（$12 万）。每个用例都是新上下文、都要重播种子，
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

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** 按分组 data-value 精确定位行（不依赖 role/name：行文案随语言与分组语义变化） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** 列表渲染行的状态文案集合 */
const rowStatuses = (page: Page) => page.locator('.issue-row .issue-status').allTextContents()

/** 行头像姓名集合（oas-avatar 的 title 属性随成员名） */
const rowAssignees = (page: Page) =>
  page
    .locator('.issue-row oas-avatar')
    .evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))

test('S1 多组独立高亮：项目/视图/状态各组 active 互不干扰', async ({ page }) => {
  await waitForSeed(page)
  await expect(sideRow(page, 'OAS 平台')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '移动端 App')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, '全部 Issues')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '我的（张伟）')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')

  await sideRow(page, '已完成').click()
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideRow(page, 'OAS 平台')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideRow(page, '全部 Issues')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S2 状态多选：组内 OR 并集，再点取消，「全部」清空', async ({ page }) => {
  await waitForSeed(page)
  await sideRow(page, '待规划').click()
  await sideRow(page, '已完成').click()
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'false')
  // 并集：渲染行只含这两种状态
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && st.every((s) => s === '待规划' || s === '已完成')
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 再点一次取消该值，仅剩另一态
  await sideRow(page, '已完成').click()
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && st.every((s) => s === '待规划')
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 全部：清空该组，回到全量
  await sideItem(page, 'status:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () => {
        const st = await rowStatuses(page)
        return st.length > 0 && new Set(st).size > 1
      },
      { timeout: 10_000 },
    )
    .toBe(true)
})

test('S3 侧栏成员组：点两项取并集，再点取消', async ({ page }) => {
  await waitForSeed(page)
  const picks = await page.getByTestId('side-list').evaluate((nav) => {
    const rows = [
      ...(nav.shadowRoot?.querySelectorAll('[part="item"][data-value^="assignee:"]') ?? []),
    ]
    return rows
      .map((el) => ({
        value: el.getAttribute('data-value') ?? '',
        name: el.querySelector('.label')?.textContent ?? '',
        count: parseInt(
          (el.querySelector('[part="badge"]')?.textContent ?? '0').replace(/[^\d]/g, ''),
          10,
        ),
      }))
      .filter(
        (r) =>
          r.value &&
          r.value !== 'assignee:all' &&
          r.value !== 'assignee:__none__' &&
          r.name &&
          r.count > 0,
      )
      .slice(0, 2)
  })
  expect(picks.length, '至少两位有 Issue 的成员').toBe(2)
  const [a, b] = picks

  await expect(sideItem(page, 'assignee:all')).toHaveAttribute('aria-pressed', 'true')
  await sideItem(page, a.value).click()
  await expect(sideItem(page, a.value)).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () => {
        const list = await rowAssignees(page)
        return list.length > 0 && list.every((n) => n === a.name)
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 并集：只含这两位成员
  await sideItem(page, b.value).click()
  await expect(sideItem(page, b.value)).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () => {
        const list = await rowAssignees(page)
        return list.length > 0 && list.every((n) => n === a.name || n === b.name)
      },
      { timeout: 10_000 },
    )
    .toBe(true)

  // 再点已选项 = 取消该值，仅剩另一位
  await sideItem(page, a.value).click()
  await expect(sideItem(page, a.value)).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(
      async () => {
        const list = await rowAssignees(page)
        return list.length > 0 && list.every((n) => n === b.name)
      },
      { timeout: 10_000 },
    )
    .toBe(true)
})

test('S4 优先级组多选：紧急+高 并集，全部清空', async ({ page }) => {
  await waitForSeed(page)
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  // 两次点击之间必须等状态落地：侧栏数据重挂会整树重建，连点两次会打在被替换的旧节点上
  await sideRow(page, '紧急').click()
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await sideRow(page, '高').click()
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:high')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'false')
  // 列表行优先级徽章只含 urgent/high（行 class 为 pri-<priority>）
  await expect
    .poll(
      async () =>
        page
          .locator('.issue-row .issue-priority')
          .evaluateAll(
            (els) =>
              els.length > 0 &&
              els.every((el) => ['pri-urgent', 'pri-high'].some((c) => el.classList.contains(c))),
          ),
      { timeout: 10_000 },
    )
    .toBe(true)

  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'priority:all')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'false')
})

test('S5 保存的视图：多选筛选存读（点击行应用，删除动作不触发行选择）', async ({ page }) => {
  await waitForSeed(page)
  await sideRow(page, '待规划').click()
  await sideRow(page, '已完成').click()
  await sideRow(page, '紧急').click()

  await page.getByTestId('save-view-btn').click()
  await expect(page.getByTestId('modal-save-view')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.getByTestId('save-view-name').locator('input').fill('S5 视图')
  await page.getByTestId('save-view-ok').click()
  await expect(page.getByTestId('modal-save-view')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(sideRow(page, 'S5 视图')).toBeVisible({ timeout: 10_000 })

  await sideItem(page, 'status:all').click()
  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')

  await sideRow(page, 'S5 视图').click()
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'status:done')).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'priority:urgent')).toHaveAttribute('aria-pressed', 'true')

  await sideItem(page, 'status:all').click()
  await sideItem(page, 'priority:all').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  const sv = sideRow(page, 'S5 视图')
  await sv.hover()
  await sideRow(page, '删除视图 S5 视图').click()
  await expect(sideRow(page, 'S5 视图')).toHaveCount(0, { timeout: 10_000 })
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
})

test('S6 折叠 rail：240→56 收窄、行存活、角标仍在，再展开恢复', async ({ page }) => {
  await waitForSeed(page)
  const sidebar = page.getByTestId('side-list')
  const panel = page.getByTestId('side-panel')
  const toggle = sidebar.locator('[part="toggle"]')
  await expect(toggle).toBeVisible()
  // 成员筛选钉底（.side-footer），不是行组：行组不含 member: 行
  await expect(sideItem(page, 'priority:all')).toBeVisible()
  await expect(sidebar.locator('[part="item"][data-value^="member:"]')).toHaveCount(0)
  const barWidth = () => sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const panelWidth = () => panel.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  await expect.poll(barWidth).toBe(240)
  await expect.poll(panelWidth).toBe(256)

  await toggle.click()
  await expect(sidebar).toHaveAttribute('collapsed', '')
  await expect.poll(barWidth).toBe(56)
  await expect.poll(panelWidth).toBe(72)

  await expect(sideRow(page, 'OAS 平台')).toBeVisible()
  await expect(sideRow(page, '全部 Issues')).toBeVisible()
  // rail 态：4 个筛选组都在（状态/优先级/迭代/成员），子行收进 flyout
  await expect(sideItem(page, 'group:status')).toBeVisible()
  await expect(sideItem(page, 'group:priority')).toBeVisible()
  await expect(sideItem(page, 'group:cycles')).toBeVisible()
  await expect(sideItem(page, 'group:members')).toBeVisible()
  await expect(sideItem(page, 'status:all')).toBeHidden()
  await expect(sideItem(page, 'assignee:all')).toBeHidden()

  await toggle.click()
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await expect.poll(barWidth).toBe(240)

  await sideRow(page, '已完成').click()
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S9 侧栏分区：导航在上、筛选在下，成员是筛选区第 4 个组', async ({ page }) => {
  await waitForSeed(page)
  // 分区顺序：项目 → 视图 → 已保存视图 → 分隔线 → 筛选（状态/优先级/迭代/成员）
  const order = await page.getByTestId('side-list').evaluate((nav) => {
    const values = [
      'project:__all__',
      'view:all',
      'savedview:view-demo-1',
      'group:status',
      'group:priority',
      'group:cycles',
      'group:members',
    ]
    const root = (nav.shadowRoot ?? nav) as unknown as Element
    // 先序遍历编号：DOM 文档序的可比值（跨层级，不能只比兄弟序号）
    const index = new Map<Element, number>()
    let n = 0
    const walk = (node: Element) => {
      index.set(node, n++)
      for (const child of Array.from(node.children)) walk(child)
    }
    walk(root)
    return values.map((v) => {
      const el = root.querySelector(`[data-value="${v}"]`)
      return el ? (index.get(el) ?? -1) : -1
    })
  })
  expect(
    order.every((i) => i >= 0),
    '七个行锚点都在 DOM 里',
  ).toBe(true)
  expect(
    [...order].sort((a, b) => a - b),
    '分区顺序',
  ).toEqual(order)

  // 成员组与状态/优先级/迭代同构：全部成员 / 未分配 / 每位成员一行
  await expect(sideItem(page, 'assignee:all')).toBeVisible()
  await expect(sideItem(page, 'assignee:__none__')).toBeVisible()
  await sideItem(page, 'assignee:member-2').click()
  await expect(sideItem(page, 'assignee:member-2')).toHaveAttribute('aria-pressed', 'true')

  // 无生效筛选时「清除全部筛选」不出现；加上筛选后出现在 nav（含成员组）之后
  await expect(page.getByTestId('side-filter-clear')).toBeVisible()
  const clearBelowMembers = await page.getByTestId('side-filter-clear').evaluate((el) => {
    const nav = document.querySelector('[data-testid=side-list]')
    const member = nav?.shadowRoot?.querySelector('[part="item"][data-value="group:members"]')
    return !!member && el.getBoundingClientRect().top >= member.getBoundingClientRect().bottom - 1
  })
  expect(clearBelowMembers, '清除全部筛选在成员组之后').toBe(true)
})

test('S10 分组折叠：状态/优先级/迭代各自可折叠，刷新后保持', async ({ page }) => {
  await waitForSeed(page)
  const group = (value: string) => sideItem(page, value)
  // 默认全部展开（宿主按偏好对齐，偏好缺省 = 展开）
  await expect(group('group:status')).toHaveAttribute('aria-expanded', 'true')
  await expect(group('group:priority')).toHaveAttribute('aria-expanded', 'true')
  await expect(group('group:cycles')).toHaveAttribute('aria-expanded', 'true')
  await expect(sideItem(page, 'status:all')).toBeVisible()

  // 逐个折叠（父子项通道：独立展开，互斥的 accordion 不启用）
  for (const key of ['status', 'priority', 'cycles']) {
    await group(`group:${key}`).click()
    await expect(group(`group:${key}`)).toHaveAttribute('aria-expanded', 'false')
  }
  await expect(sideItem(page, 'status:all')).toBeHidden()
  await expect(sideItem(page, 'priority:all')).toBeHidden()
  await expect(sideItem(page, 'cycle:all')).toBeHidden()

  // 折叠偏好落 localStorage，刷新后保持
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-side-collapsed')))
    .toBe(JSON.stringify(['status', 'priority', 'cycles']))
  await page.reload()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
  await expect(group('group:status')).toHaveAttribute('aria-expanded', 'false')
  await expect(group('group:priority')).toHaveAttribute('aria-expanded', 'false')
  await expect(group('group:cycles')).toHaveAttribute('aria-expanded', 'false')
  await expect(sideItem(page, 'status:all')).toBeHidden()

  // 单独展开状态组：只有它回来
  await group('group:status').click()
  await expect(group('group:status')).toHaveAttribute('aria-expanded', 'true')
  await expect(sideItem(page, 'status:all')).toBeVisible()
  await expect(sideItem(page, 'priority:all')).toBeHidden()
})

test('S11 高亮分级：当前视图实底，生效筛选浅底 + 左色条', async ({ page }) => {
  await waitForSeed(page)
  // 行会在筛选变化时整树重建：detached 节点的 getComputedStyle 返回空串，取样要轮询到非空
  const sample = async (value: string, prop: 'backgroundColor' | 'boxShadow') => {
    let out = ''
    await expect
      .poll(async () => {
        out = await sideItem(page, value).evaluate(
          (el, key) => getComputedStyle(el)[key] as string,
          prop,
        )
        return out
      })
      .not.toBe('')
    return out
  }
  const bg = (value: string) => sample(value, 'backgroundColor')
  const shadow = (value: string) => sample(value, 'boxShadow')

  // 当前项目/视图：组件 active 通道的实底（非透明）
  expect(await bg('project:project-1')).not.toBe('rgba(0, 0, 0, 0)')
  expect(await bg('view:all')).not.toBe('rgba(0, 0, 0, 0)')
  // 「全部状态」只是选中语义（该维度不限），不高亮：宿主注入的规则去掉底色与色条
  expect(await bg('status:all')).toBe('rgba(0, 0, 0, 0)')
  expect(await shadow('status:all')).toBe('none')

  await sideRow(page, '待规划').click()
  await expect(sideItem(page, 'status:backlog')).toHaveAttribute('aria-pressed', 'true')
  // 弱标记：浅底 + 2px 左色条（box-shadow inset）
  expect(await bg('status:backlog')).not.toBe('rgba(0, 0, 0, 0)')
  expect(await shadow('status:backlog')).toContain('inset')
  // 项目/视图的高亮不受筛选影响
  expect(await bg('project:project-1')).not.toBe('rgba(0, 0, 0, 0)')

  // 清除全部筛选：一次清掉状态
  await page.getByTestId('side-filter-clear').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  expect(await bg('status:backlog')).toBe('rgba(0, 0, 0, 0)')
  await expect(page.getByTestId('side-filter-clear')).toHaveCount(0)
})
