import { expect, test, type Locator, type Page } from '@playwright/test'

/** e2e 播种规模（与 smoke 同口径；M24-27 四个新功能用例） */
const E2E_SEED_SIZE = 5_000

async function setView(page: Page, v: string) {
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    ;(el as unknown as { value: string }).value = view
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
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

const sideItem = (page: Page, value: string) =>
  page.getByTestId('side-list').locator(`[part="item"][data-value="${value}"]`)

/** popconfirm 确认（契约事件 reason='ok'，同 admin.spec confirmPop） */
async function confirmPop(btn: Locator) {
  await btn.evaluate((el: HTMLElement) => {
    el.closest('oas-popconfirm')?.dispatchEvent(
      new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
    )
  })
}

async function waitForSeed(page: Page, size = E2E_SEED_SIZE) {
  test.setTimeout(240_000)
  await page.addInitScript((n) => localStorage.setItem('oas-pm-seed-size', String(n)), size)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 120_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v11')), {
      timeout: 180_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 打开首行详情抽屉（smoke M9 同款：行 dispatch click → drawer.opened 轮询） */
async function openFirstRowDrawer(page: Page): Promise<string> {
  const key = (await page.locator('.issue-row .issue-key').first().textContent()) ?? ''
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
  return key
}

test('M24 里程碑：侧栏组过滤 + 甘特里程碑条 + 抽屉选择 + 管理增删', async ({ page }) => {
  await waitForSeed(page)

  // 1) 侧栏里程碑组：全部里程碑 + seed 的 M1/M2 行可见
  await expect(sideItem(page, 'milestone:all')).toBeVisible({ timeout: 10_000 })
  const m1Row = sideItem(page, 'milestone:milestone-1')
  await expect(m1Row).toBeVisible({ timeout: 10_000 })

  // 2) 点 M1 → 列表只剩挂在该里程碑的 8 条（seed：project-1 前 8 条挂 milestone-1）
  await m1Row.click()
  await expect.poll(() => page.locator('.issue-row').count(), { timeout: 15_000 }).toBe(8)

  // 3) 再点取消 → 窗口恢复（>8 行）
  await m1Row.click()
  await expect
    .poll(() => page.locator('.issue-row').count(), { timeout: 15_000 })
    .toBeGreaterThan(8)

  // 4) 甘特：里程碑条目进 tasks（property 通道，msRows 异步加载 → 轮询）
  await setView(page, 'timeline')
  await expect(page.getByTestId('gantt')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid=gantt]') as {
            tasks?: Array<Record<string, unknown>>
          }
          return (el?.tasks ?? []).some(
            (t) => t.type === 'milestone' && String(t.name ?? '').includes('M1'),
          )
        }),
      { timeout: 15_000 },
    )
    .toBe(true)

  // 5) 抽屉选择里程碑 → 即时保存回读
  await setView(page, 'issues')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 15_000 })
  await openFirstRowDrawer(page)
  await expect(page.getByTestId('detail-milestone')).toBeVisible({ timeout: 10_000 })
  await setOSelect(page, 'detail-milestone', 'milestone-1')
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-milestone]') as { value?: string })
              ?.value ?? '',
        ),
      { timeout: 10_000 },
    )
    .toBe('milestone-1')
  await page.keyboard.press('Escape')

  // 6) 管理：独立「里程碑」页 → 新建（含描述）→ 卡片 +1 → 行内改名 → 删除回落
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-milestones').click()
  await expect(page.getByTestId('admin-tab-milestones')).toBeVisible({ timeout: 10_000 })
  const cardsBefore = await page.locator('.ms-card').count()
  await page.getByTestId('admin-milestone-new-name').fill('M3 · e2e 里程碑')
  await page.getByTestId('admin-milestone-new-desc').fill('e2e 建的验证行')
  await page.getByTestId('admin-milestone-add').click()
  // 卡片数 +1（名称在 input value 里，hasText 不可用；用计数 + toHaveValue 断言）
  await expect
    .poll(() => page.locator('.ms-card').count(), { timeout: 10_000 })
    .toBe(cardsBefore + 1)
  // 新建无 dueAt → dueAt 升序排在最前，取 first
  const newCard = page.locator('.ms-card').first()
  const lastName = newCard.locator('input[data-testid^=admin-milestone-name-]')
  await expect(lastName).toHaveValue('M3 · e2e 里程碑', { timeout: 10_000 })
  // 进度聚合行存在（新建为 0/0）
  await expect(newCard.locator('[data-testid^=admin-milestone-progress-]')).toContainText('0')
  // 行内改名（Enter 失焦保存 → value 回读）
  await lastName.fill('M3 · 改名后')
  await lastName.press('Enter')
  await expect(lastName).toHaveValue('M3 · 改名后', { timeout: 10_000 })
  // 删除 → popconfirm 确认 → 卡片数回落
  await newCard.getByTestId(/^admin-milestone-del-/).click()
  await confirmPop(newCard.getByTestId(/^admin-milestone-del-/))
  await expect.poll(() => page.locator('.ms-card').count(), { timeout: 10_000 }).toBe(cardsBefore)
})

test('M25 合并重复：评论/子任务迁移 + duplicate 关系 + 源卡入回收站', async ({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[pm-console]', m.text().slice(0, 400))
  })
  page.on('pageerror', (e) => console.log('[pm-pageerror]', String(e).slice(0, 400)))
  await waitForSeed(page)

  // 取前两行的 key（row dataset.key 是行身份锚点）
  const keys = await page
    .locator('.issue-row')
    .evaluateAll((els) => els.slice(0, 2).map((el) => (el as HTMLElement).dataset.key ?? ''))
  const [sourceKey, targetKey] = keys
  expect(sourceKey).toBeTruthy()
  expect(targetKey).toBeTruthy()

  // 打开源卡抽屉 → 合并入口 → 选目标（issue id 从 IndexedDB 反查，OSelect options 不外露 getter）
  await openFirstRowDrawer(page)
  await page.getByTestId('merge-open').click()
  await expect(page.getByTestId('merge-panel')).toBeVisible({ timeout: 10_000 })
  const targetId = await page.evaluate(async (tk) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    return await new Promise<string>((res) => {
      const rq = db.transaction('issues', 'readonly').objectStore('issues').index('key').get(tk)
      rq.onsuccess = () => res(String((rq.result as { id?: string })?.id ?? ''))
      rq.onerror = () => res('')
    })
  }, targetKey)
  expect(targetId).toBeTruthy()
  // 等 React effects flush（oas-change 监听器挂上）再设值，回读校验确实生效
  await page.waitForTimeout(300)
  await setOSelect(page, 'merge-target', targetId)
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=merge-target]') as { value?: string })?.value ??
            '',
        ),
      { timeout: 10_000 },
    )
    .toBe(targetId)
  await page.getByTestId('merge-confirm').click()

  // 抽屉关闭（合并完成即关——宿主直接卸载抽屉，querySelector 为 null 也算已关闭）
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid=detail-drawer]') as {
            opened?: boolean
          } | null
          return el == null ? false : (el.opened ?? false)
        }),
      { timeout: 10_000 },
    )
    .toBe(false)

  // 源卡从列表消失（软删），目标卡还在
  await expect
    .poll(() => page.locator(`.issue-row[data-key="${sourceKey}"]`).count(), { timeout: 15_000 })
    .toBe(0)
  await expect(page.locator(`.issue-row[data-key="${targetKey}"]`).first()).toBeVisible({
    timeout: 15_000,
  })

  // 目标卡抽屉：duplicate 关系 chip（源卡已软删，候选表不再含其 key，chip 只显示类型）
  await page
    .locator(`.issue-row[data-key="${targetKey}"]`)
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
  await expect(
    page.getByTestId('detail-drawer').locator('[data-testid^=relation-chip-]').first(),
  ).toContainText(/重复|duplicate/, { timeout: 10_000 })
})

test('M26 工时：记录/汇总 + 估算落库 + 看板卡徽章', async ({ page }) => {
  await waitForSeed(page)
  const key = await openFirstRowDrawer(page)

  // 空态 → 记 90 分钟 → 1h 30m
  await expect(page.getByTestId('worklog-empty')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('worklog-minutes').fill('90')
  await page.getByTestId('worklog-note').fill('e2e 编码实现')
  await page.getByTestId('worklog-add').click()
  const item = page.getByTestId('worklog-item').first()
  await expect(item).toBeVisible({ timeout: 10_000 })
  await expect(item).toContainText('1h 30m')
  await expect(item).toContainText('e2e 编码实现')

  // 估算 3（小时，Enter 即失焦落库）→ 工时区标题出现「估算 3h」
  await page.getByTestId('detail-estimate').fill('3')
  await page.getByTestId('detail-estimate').press('Enter')
  await expect(page.getByTestId('worklog-block')).toContainText('估算 3h', { timeout: 10_000 })

  // 列表：该 Issue updatedAt 被保存顶到首行 → 行内 3h 徽章
  await page.keyboard.press('Escape')
  const firstRow = page.locator('.issue-row').first()
  await expect(firstRow.locator('.issue-key')).toHaveText(key, { timeout: 15_000 })
  await expect(firstRow.locator('.estimate-badge')).toHaveText('3h', { timeout: 10_000 })

  // 看板：cards 数据通道带 estimate（DOM 卡片有列内渲染截断，属性通道是确定性断言）
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      () =>
        page.evaluate((k) => {
          const el = document.querySelector('[data-testid=board]') as {
            cards?: Array<{ key: string; estimate: number | null }>
          }
          return (el?.cards ?? []).find((c) => c.key === k)?.estimate ?? null
        }, key),
      { timeout: 15_000 },
    )
    .toBe(3)
})

test('M27 自定义工作流状态：新增 → 看板列跟随 → 改名 → 删除恢复', async ({ page }) => {
  await waitForSeed(page)

  // Admin → 设置 → 工作流状态面板（默认 project-1，五个内置态）
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-settings').click()
  await expect(page.getByTestId('admin-workflow-states')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-states-table').locator('.states-row')).toHaveCount(5, {
    timeout: 15_000,
  })

  // 新增「待验收」（进行类）→ 第 6 行
  await page.getByTestId('admin-state-new-name').fill('待验收')
  await setOSelect(page, 'admin-state-new-cat', 'started')
  await page.getByTestId('admin-state-add').click()
  await expect(page.getByTestId('admin-states-table').locator('.states-row')).toHaveCount(6, {
    timeout: 10_000,
  })
  const newId = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid^=admin-state-row-]')
    return (rows[rows.length - 1] as HTMLElement)?.dataset.testid?.replace('admin-state-row-', '')
  })
  expect(newId).toBeTruthy()

  // 回工作区：看板列出现「待验收」（内置五列 + 1）
  await page.getByTestId('admin-back').click()
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid=board]') as {
            columns?: Array<{ title: string }>
          }
          return (el?.columns ?? []).map((c) => c.title).join('|')
        }),
      { timeout: 15_000 },
    )
    .toContain('待验收')

  // 改名「待办」→「Ready」→ 看板列跟随
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-settings').click()
  const todoName = page.getByTestId('admin-state-name-todo')
  await expect(todoName).toBeVisible({ timeout: 10_000 })
  await todoName.fill('Ready')
  await todoName.press('Enter')
  await page.getByTestId('admin-back').click()
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid=board]') as {
            columns?: Array<{ title: string }>
          }
          return (el?.columns ?? []).map((c) => c.title).join('|')
        }),
      { timeout: 15_000 },
    )
    .toContain('Ready')

  // 删除自定义态（无 Issue 使用）→ 行数回到 5
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-settings').click()
  await page.getByTestId(`admin-state-del-${newId}`).click()
  await expect(page.getByTestId('admin-states-table').locator('.states-row')).toHaveCount(5, {
    timeout: 10_000,
  })
  // 改回内置名（后续用例看到词典态）
  const readyName = page.getByTestId('admin-state-name-todo')
  await readyName.fill('待办')
  await readyName.press('Enter')
})
