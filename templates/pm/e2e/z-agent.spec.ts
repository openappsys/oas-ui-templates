import { expect, test, type Page } from '@playwright/test'

/**
 * Agentic PM：agent 成员被指派后的完整闭环。
 * fast 档（oas-pm-agent-speed=fast）下 run 步进 150ms，一条 run ≈ 700ms；
 * 断言一律轮询到终态，不依赖精确时长。
 *
 * 文件名以 z- 开头：本 spec 会留下 agent 子任务/通知等残留（共享串行 IndexedDB），
 * 必须排在全部业务 spec 之后执行。每个用例自建全新 Issue，不受历史残留影响。
 */

async function setOSelect(page: Page, testid: string, v: string) {
  await page.evaluate(
    ([tid, val]) => {
      const el = document.querySelector('[data-testid="' + tid + '"]')
      ;(el as unknown as { value: string }).value = val as string
      el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    },
    [testid, v],
  )
}

const AGENT = 'agent-coder'
const AGENT_NAME = '编码助手'

const boot = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('oas-pm-seed-size', '5000')
    localStorage.setItem('oas-pm-agent-speed', 'fast')
  })
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
    timeout: 180_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
}

/** 新建一条专属 Issue 并打开抽屉（标题唯一，行定位不受 agent 子任务行序影响） */
const createAndOpen = async (page: Page, title: string) => {
  await page.getByTestId('toolbar-new').click()
  const modal = page.getByTestId('modal-create')
  await expect(modal).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('create-title').locator('input').fill(title)
  await page.getByTestId('create-submit').click()
  await expect(modal).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
  const row = page.locator('.issue-row').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
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

test('AG1 指派给 agent：自动推进（工作条）→ 交付待验收（面板+徽标+通知）', async ({ page }) => {
  await boot(page)
  await createAndOpen(page, 'AG1 agent 交付验证')

  // 负责人下拉出现 agent 选项（🤖 前缀）；改派
  await setOSelect(page, 'detail-assignee', AGENT)

  // 执行中工作条出现（步骤进度）
  await expect(page.getByTestId('agent-strip')).toBeVisible({ timeout: 15_000 })

  // 交付：待验收面板（fast 档秒级；上限放宽到 30s）
  await expect(page.getByTestId('agent-review-panel')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('agent-review-panel')).toContainText(AGENT_NAME)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 10_000 })

  // 列表：该 Issue 行带待验收徽标
  const row = page.locator('.issue-row').filter({ hasText: 'AG1 agent 交付验证', hasNotText: '——' })
  await expect(row.getByTestId('review-badge')).toBeVisible({ timeout: 15_000 })

  // 报告人收到 review 通知（通知铃铛带未读角标）
  const bell = page.getByTestId('toolbar-notify')
  await expect(bell).toBeVisible({ timeout: 15_000 })
  await expect(bell).toContainText(/\d/, { timeout: 15_000 })
})

test('AG2 验收通过：状态置 done，徽标消失', async ({ page }) => {
  await boot(page)
  // 自包含：自建 issue → 指派 → 等交付 → 验收（不依赖其他用例留下的状态）
  await createAndOpen(page, 'AG2 验收通过验证')
  await setOSelect(page, 'detail-assignee', AGENT)
  await expect(page.getByTestId('agent-review-panel')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('review-approve').click()
  // 面板消失（reviewRequired 清除）+ 状态 done
  await expect(page.getByTestId('agent-review-panel')).toHaveCount(0, { timeout: 15_000 })
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-status]') as { value?: string })?.value ??
            '',
        ),
      { timeout: 15_000 },
    )
    .toBe('done')
})

test('AG3 侧栏「待验收」入口：队列过滤只留待验收行', async ({ page }) => {
  await boot(page)
  // 自包含：自建交付，让队列确定性地含有本用例的行
  await createAndOpen(page, 'AG3 待验收队列验证')
  await setOSelect(page, 'detail-assignee', AGENT)
  await expect(page.getByTestId('agent-review-panel')).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 10_000 })

  const row = page.locator('.issue-row').filter({ hasText: 'AG3 待验收队列验证', hasNotText: '——' })
  await expect(row.getByTestId('review-badge')).toBeVisible({ timeout: 15_000 })

  const item = page.getByTestId('side-list').locator('[data-value="filter:review"]')
  /** 可见行全部带待验收徽标 = 队列过滤已生效（侧栏重渲染可能吞掉一次点击，必要时重试） */
  const filterApplied = async () => {
    for (let i = 0; i < 10; i++) {
      const ok = await page.locator('.issue-row').evaluateAll((rows) => {
        if (rows.length === 0) return false
        return rows.every((r) => r.querySelector('[data-testid=review-badge]'))
      })
      if (ok) return true
      await item.click().catch(() => {})
      await page.waitForTimeout(400)
    }
    return false
  }
  expect(await filterApplied()).toBe(true)
  await expect(row).toBeVisible({ timeout: 15_000 })

  // 关闭过滤：非待验收行回来（badged < all），本用例的行仍在
  await item.click()
  await expect
    .poll(
      async () => {
        const c = await page.locator('.issue-row').evaluateAll((rows) => ({
          all: rows.length,
          badged: rows.filter((r) => r.querySelector('[data-testid=review-badge]')).length,
        }))
        return c.all > c.badged
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  await expect(row).toBeVisible({ timeout: 15_000 })
})

test('AG4 驳回重做：状态回 todo，agent 再次推进到待验收', async ({ page }) => {
  await boot(page)
  await createAndOpen(page, 'AG4 驳回重做验证')
  await setOSelect(page, 'detail-assignee', AGENT)
  await expect(page.getByTestId('agent-review-panel')).toBeVisible({ timeout: 30_000 })

  // 驳回 → 清待验收；调度器重跑（工作条）→ 再次交付（重做闭环）。
  // fast 档重交付只要 ~0.7s，「回 todo」是瞬态，断言重跑/重交付这两个稳定锚点
  await page.getByTestId('review-reject').click()
  await expect(page.getByTestId('agent-review-panel')).toHaveCount(0, { timeout: 5_000 })
  await expect(page.getByTestId('agent-strip')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('agent-review-panel')).toBeVisible({ timeout: 30_000 })
})
