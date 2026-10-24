import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  // 预算沿用 10 万口径（M1 仍跑 10 万，其余 5K）：轮询与用例预算统一留足
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

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** 按分组 data-value 精确定位行（不依赖 role/name：行文案随语言与分组语义变化） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** 列表渲染行的状态文案集合 */
const rowStatuses = (page: Page) => page.locator('.issue-row .issue-status').allTextContents()

/** 侧栏成员多选（oas-select multiple+searchable+clearable）：trigger / 选项行都在 shadow 内 */
const assigneeSelect = (page: Page) => page.getByTestId('side-filter-assignee')
const assigneeDropdown = (page: Page) => assigneeSelect(page).locator('.dropdown')

async function openAssignee(page: Page) {
  await assigneeSelect(page).locator('button.trigger').click()
  await expect(assigneeDropdown(page)).toHaveClass(/open/, { timeout: 5000 })
}

/** 点某个选项（label 含计数后缀，如「李娜 (58)」） */
const pickAssignee = (page: Page, label: string) =>
  assigneeSelect(page).locator('.option').filter({ hasText: label }).first().click()

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

test('S3 侧栏成员多选：点两项取并集（chips 回显），再点取消', async ({ page }) => {
  await waitForSeed(page)
  await openAssignee(page)
  // 选项 label 带全量计数后缀（与列表窗口无关）；点击与断言只用成员名（去掉 " (n)"）
  const labels = await assigneeSelect(page).evaluate((el) => {
    const opts = (el as { options?: Array<{ label: string; value: string }> }).options ?? []
    return opts.filter((o) => o.value !== '__none__').map((o) => o.label)
  })
  expect(labels.length).toBeGreaterThanOrEqual(2)
  const plain = (label: string) => label.replace(/\s*\(\d+\)$/, '')
  const names = labels.map(plain).slice(0, 2) as [string, string]
  const [first, second] = names

  await expect(assigneeSelect(page).locator('.value')).toHaveText('全部成员')
  await pickAssignee(page, first)
  await expect(assigneeSelect(page).locator('.chip:not(.chip-plus)').first()).toContainText(first)
  await expect
    .poll(async () => {
      const list = await rowAssignees(page)
      return list.length > 0 && list.every((n) => n === first)
    })
    .toBe(true)

  // 侧栏只有一行宽度：max-tag-count=1，第二项折叠成 +1（选中集仍读 property）
  await pickAssignee(page, second)
  expect(await assigneeSelect(page).evaluate((el) => (el as { value?: string[] }).value)).toEqual([
    expect.any(String),
    expect.any(String),
  ])
  await expect(assigneeSelect(page).locator('.chip-plus')).toHaveText('+1', { timeout: 5000 })
  // 并集：渲染行只含这两位成员
  await expect
    .poll(async () => {
      const list = await rowAssignees(page)
      return list.length > 0 && list.every((n) => n === first || n === second)
    })
    .toBe(true)

  // 再点已选项 = 取消该值，仅剩另一位
  await pickAssignee(page, first)
  await expect(assigneeSelect(page).locator('.chip:not(.chip-plus)')).toHaveCount(1)
  await expect(assigneeSelect(page).locator('.chip-plus')).toHaveCount(0)
  await expect
    .poll(async () => {
      const list = await rowAssignees(page)
      return list.length > 0 && list.every((n) => n === second)
    })
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
  // rail 态：组件的子行收进 flyout（悬停父项才出现），父项仍在
  await expect(sideItem(page, 'group:status')).toBeVisible()
  await expect(sideItem(page, 'status:all')).toBeHidden()

  await toggle.click()
  await expect(sidebar).not.toHaveAttribute('collapsed', /.*/)
  await expect.poll(barWidth).toBe(240)

  await sideRow(page, '已完成').click()
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('已完成', {
    timeout: 10_000,
  })
})

test('S9 侧栏分区：导航在上、筛选在下，成员控件在筛选区末尾', async ({ page }) => {
  await waitForSeed(page)
  // 分区顺序：项目 → 视图 → 已保存视图 → 分隔线 → 筛选（含状态/优先级/迭代）
  const order = await page.getByTestId('side-list').evaluate((nav) => {
    const values = [
      'project:__all__',
      'view:all',
      'savedview:view-demo-1',
      'group:status',
      'group:priority',
      'group:cycles',
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
    '六个行锚点都在 DOM 里',
  ).toBe(true)
  expect(
    [...order].sort((a, b) => a - b),
    '分区顺序',
  ).toEqual(order)

  // 无生效筛选时「清除全部筛选」不出现；加上筛选后出现在筛选区末尾（成员组之后）
  await expect(page.getByTestId('filter-clear')).toHaveCount(0)
  await sideRow(page, '待规划').click()
  await expect(page.getByTestId('filter-clear')).toBeVisible()
  expect(
    await page.getByTestId('filter-clear').evaluate((el) => {
      const member = document.querySelector('[data-testid=side-filters]')
      return !!(member && member.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    }),
    '清除全部筛选在成员组之后',
  ).toBe(true)

  // 成员控件是筛选区最后一项：走组件默认插槽（.body），排在 nav（含迭代/清除）之后，
  // 不再使用 footer slot，也不钉底——和筛选保持同一组织
  const member = await page.getByTestId('side-filters').evaluate((el) => {
    const host = el.closest('oas-sidebar')
    const root = host?.shadowRoot
    const body = root?.querySelector<HTMLElement>('[part="body"]')
    const slot = (el as HTMLElement).assignedSlot
    const foot = root?.querySelector<HTMLElement>('[part="foot"]')
    const prev = body?.previousElementSibling
    return {
      parentTag: el.parentElement?.tagName ?? '',
      slotName: slot?.getAttribute('name') ?? 'default',
      slotParentClass: slot?.parentElement?.className ?? '',
      bodyAfterNav: prev?.tagName === 'NAV' || prev?.className === 'nav',
      footHidden: foot?.hasAttribute('hidden') ?? false,
    }
  })
  expect(member.parentTag).toBe('OAS-SIDEBAR')
  expect(member.slotName).toBe('default')
  expect(member.slotParentClass).toBe('body')
  expect(member.bodyAfterNav).toBe(true)
  expect(member.footHidden).toBe(true)
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
  await page.getByTestId('filter-clear').click()
  await expect(sideItem(page, 'status:all')).toHaveAttribute('aria-pressed', 'true')
  expect(await bg('status:backlog')).toBe('rgba(0, 0, 0, 0)')
  await expect(page.getByTestId('filter-clear')).toHaveCount(0)
})
