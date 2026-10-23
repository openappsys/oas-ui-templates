import { expect, test, type Page } from '@playwright/test'

/** e2e 播种规模（产品默认 10 万；M1 架构用例单独传 100_000） */
const E2E_SEED_SIZE = 5_000

/** 等待 seed 完成（e2e 默认 5K；M1 架构用例传 10 万） */
async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
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

/** 侧栏行（按分组 data-value 定位，不依赖行文案） */
const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

const ALL_PROJECTS = 'project:__all__'

/** header 计数首段数字（文案含「已加载」后缀时取首段） */
async function issueTotal(page: Page): Promise<number> {
  const text = (await page.getByTestId('issue-total').textContent()) ?? ''
  return Number((text.replace(/,/g, '').match(/^\d+/) ?? ['0'])[0])
}

/** 当前窗口各行的 key 前缀集合（OAS/APP） */
const keyPrefixes = (page: Page) =>
  page
    .locator('.issue-row .issue-key')
    .allTextContents()
    .then((keys) => [...new Set(keys.map((k) => k.slice(0, k.indexOf('-'))))].sort())

test('P1 全部项目：列表行跨项目（≥2 个项目）+ 计数为各项目之和', async ({ page }) => {
  await waitForSeed(page)
  // 默认 project-1
  await expect(sideItem(page, 'project:project-1')).toHaveAttribute('aria-pressed', 'true')
  const totalP1 = await issueTotal(page)
  expect(totalP1).toBeGreaterThan(0)

  await sideItem(page, 'project:project-2').click()
  await expect
    .poll(async () => (await keyPrefixes(page)).join(','), { timeout: 15_000 })
    .toBe('APP')
  const totalP2 = await issueTotal(page)
  expect(totalP2).toBeGreaterThan(0)

  await sideItem(page, ALL_PROJECTS).click()
  // 项目组仍单选：全部项目高亮、两个项目行都熄灭
  await expect(sideItem(page, ALL_PROJECTS)).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'project:project-1')).toHaveAttribute('aria-pressed', 'false')
  await expect(sideItem(page, 'project:project-2')).toHaveAttribute('aria-pressed', 'false')
  // 窗口内混有两者
  await expect
    .poll(async () => (await keyPrefixes(page)).join(','), { timeout: 15_000 })
    .toBe('APP,OAS')
  // 计数 = 各项目之和（跨项目并集，不是单项目）
  expect(await issueTotal(page)).toBe(totalP1 + totalP2)
})

test('P2 全部项目 + 我的 Issues：只显示当前用户且跨项目', async ({ page }) => {
  await waitForSeed(page)
  await sideItem(page, ALL_PROJECTS).click()
  await sideItem(page, 'view:my').click()
  await expect(sideItem(page, 'view:my')).toHaveAttribute('aria-pressed', 'true')

  await expect
    .poll(
      async () => {
        const names = await page
          .locator('.issue-row oas-avatar')
          .evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''))
        return names.length > 0 && names.every((n) => n === '张伟')
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  // 个人工作台跨项目：窗口内同时有 OAS 与 APP 前缀
  await expect
    .poll(async () => (await keyPrefixes(page)).join(','), { timeout: 15_000 })
    .toBe('APP,OAS')
})

test('P3 全部项目下新建 Issue：项目字段默认上次真实项目，key 前缀随之正确', async ({ page }) => {
  await waitForSeed(page)
  // 上次选中的真实项目 = project-2（点项目行即记录）
  await sideItem(page, 'project:project-2').click()
  await expect
    .poll(async () => (await keyPrefixes(page)).join(','), { timeout: 15_000 })
    .toBe('APP')
  await sideItem(page, ALL_PROJECTS).click()
  await expect(sideItem(page, ALL_PROJECTS)).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('toolbar-new').click()
  await expect(page.getByTestId('modal-create')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  // 全部项目不是可写入作用域：项目字段回落到上次真实项目
  await expect
    .poll(() =>
      page.getByTestId('create-project').evaluate((el) => (el as { value?: string }).value ?? ''),
    )
    .toBe('project-2')

  await page.getByTestId('create-title').locator('input').fill('P3 跨项目新建')
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('modal-create')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })

  // 新建 updatedAt 最新 → 列表首行；key 前缀跟随所选项目（APP-）
  await expect(page.locator('.issue-row').first()).toContainText('P3 跨项目新建', {
    timeout: 15_000,
  })
  const key = (await page.locator('.issue-row .issue-key').first().textContent()) ?? ''
  expect(key).toMatch(/^APP-\d+$/)

  // 出现在真实项目（移动端 App）下，且不在 OAS 平台
  await sideItem(page, 'project:project-2').click()
  await expect(page.locator('.issue-row').first()).toContainText('P3 跨项目新建', {
    timeout: 15_000,
  })
  await sideItem(page, 'project:project-1').click()
  await expect
    .poll(async () => (await keyPrefixes(page)).join(','), { timeout: 15_000 })
    .toBe('OAS')
  const oasKeys = await page.locator('.issue-row .issue-key').allTextContents()
  expect(oasKeys).not.toContain(key)
})

test('P4 保存视图可存「全部项目」：切换项目后应用回显', async ({ page }) => {
  await waitForSeed(page)
  await sideItem(page, ALL_PROJECTS).click()
  await expect(sideItem(page, ALL_PROJECTS)).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('save-view-btn').click()
  await expect(page.getByTestId('modal-save-view')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.getByTestId('save-view-name').locator('input').fill('P4 全部项目视图')
  await page.getByTestId('save-view-ok').click()
  await expect(page.getByTestId('modal-save-view')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  const saved = page.getByTestId('side-panel').getByRole('button', {
    name: 'P4 全部项目视图',
    exact: true,
  })
  await expect(saved).toBeVisible({ timeout: 10_000 })

  // 切到单项目，再应用保存视图 → 回到全部项目作用域
  await sideItem(page, 'project:project-2').click()
  await expect(sideItem(page, 'project:project-2')).toHaveAttribute('aria-pressed', 'true')
  await saved.click()
  await expect(sideItem(page, ALL_PROJECTS)).toHaveAttribute('aria-pressed', 'true')
  await expect(sideItem(page, 'project:project-2')).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(async () => (await keyPrefixes(page)).join(','), { timeout: 15_000 })
    .toBe('APP,OAS')

  // 收尾：删除该视图，避免污染后续用例的侧栏截图
  await saved.hover()
  await page
    .getByTestId('side-panel')
    .getByRole('button', { name: '删除视图 P4 全部项目视图', exact: true })
    .click()
  await expect(saved).toHaveCount(0, { timeout: 10_000 })
})
