import { expect, test, type Page } from '@playwright/test'

async function waitForSeed(page: Page) {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v7')), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

/** 列表 shadow 内的焦点落点（行内控件在 shadow 内，document.activeElement 拿不到） */
function focusedRow(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-testid=issue-vlist]')
    const ae = host?.shadowRoot?.activeElement as HTMLElement | null | undefined
    if (!ae) return null
    const row = ae.closest('.issue-row') as HTMLElement | null
    return {
      testid: ae.dataset.testid ?? '',
      key: row?.dataset.key ?? '',
      // 行内可见 key：不依赖恢复机制使用的 data-key，独立核对行身份
      keyText: row?.querySelector('.issue-key')?.textContent ?? '',
      // K6 标记：重建后的新节点不带标记 → 证明焦点确实迁到新 DOM
      marked: ae.dataset.k6 === '1',
    }
  })
}

/**
 * 外部更新一条 other 行的 issue：动态 import 应用自己的仓库单例（与页面同一 Dexie 实例），
 * 走仓库层写库 → Dexie storagemutated → liveQuery 重派 → 列表 items 换引用 → 行整树重建。
 * 直写 IndexedDB 不行：原生写入不经过 Dexie 的变更广播，liveQuery 不会重派。
 */
function updateOtherIssue(page: Page, skipKey: string) {
  return page.evaluate(async (skip) => {
    type Row = { key: string; status: string }
    type Repo = {
      get: (id: string) => Promise<Row | undefined>
      update: (id: string, changes: Record<string, unknown>) => Promise<void>
    }
    const spec = '/src/data/dexie/index.ts'
    const mod = (await import(spec)) as { dexieRepositories: { issues: Repo } }
    const repo = mod.dexieRepositories.issues
    for (const id of ['issue-project-1-1001', 'issue-project-1-1002', 'issue-project-1-1003']) {
      const row = await repo.get(id)
      if (!row || row.key === skip) continue
      await repo.update(id, { status: row.status === 'done' ? 'todo' : 'done' })
      return row.key
    }
    return ''
  }, skipKey)
}

test('K1 j/k 光标导航：无初始光标 → j 首行 → j 次行 → k 回首行', async ({ page }) => {
  await waitForSeed(page)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(0)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(1)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').nth(1)).toHaveClass(/is-cursor/)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(1)
  await page.keyboard.press('k')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(1)
})

test('K2 Enter 打开光标行详情抽屉 + Esc 关闭', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await page.keyboard.press('Enter')
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-drawer]') as { opened?: boolean })
              ?.opened ?? false,
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })
})

test('K3 x 多选切换：bulk-bar 出现/消失（admin 默认身份）', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
  await page.keyboard.press('x')
  await expect(page.getByTestId('bulk-bar')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('bulk-bar')).toContainText('已选 1')
  await page.keyboard.press('x')
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0, { timeout: 5000 })
})

test('K4 ? 快捷键帮助：打开 + Esc 关闭且抽屉状态不受影响', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcuts-help')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(page.locator('.shortcuts-body .shortcut-row')).toHaveCount(8)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcuts-help')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0)
  await page.keyboard.press('?')
  await expect(page.getByTestId('shortcuts-help')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
})

test('K5 输入守卫：搜索框聚焦时 j 不移动光标', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('toolbar-search').click()
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const host = document.querySelector('[data-testid=toolbar-search]')
        const ae = document.activeElement
        if (ae === host) return true
        return !!ae && !!host?.shadowRoot && ae.getRootNode() === host.shadowRoot
      }),
    )
    .toBe(true)
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row.is-cursor')).toHaveCount(0)
  await page.locator('.issue-thead').click()
  await page.keyboard.press('j')
  await expect(page.locator('.issue-row').first()).toHaveClass(/is-cursor/)
})

test('K6 行重建焦点恢复：外部改他人 issue 后焦点仍在原行勾选框', async ({ page }) => {
  await waitForSeed(page)
  // 默认 admin（member-1）→ 行首多选列可见
  const firstCheck = page.locator('.issue-row .row-check').first()
  await expect(firstCheck).toBeVisible({ timeout: 10_000 })
  // 勾选框宿主自身不可聚焦，焦点落内部 input；列表 shadow 的 activeElement 会 retarget 到宿主
  await firstCheck.locator('input').focus()
  const before = await focusedRow(page)
  expect(before).toMatchObject({ testid: 'row-check' })
  expect(before!.key).not.toBe('')
  expect(before!.marked).toBe(false)
  // 打标旧节点：重建后该标记必须消失，否则说明本轮没走到重建路径（用例无效）
  await firstCheck.evaluate((el) => {
    ;(el as HTMLElement).dataset.k6 = '1'
  })

  const bumpedKey = await updateOtherIssue(page, before!.key)
  expect(bumpedKey).not.toBe('')
  // 前置：列表确实吃了这次更新（改的那条升到窗口头部、被渲染出来）
  await expect
    .poll(
      () =>
        page.evaluate(
          (key) =>
            !!document
              .querySelector('[data-testid=issue-vlist]')
              ?.shadowRoot?.querySelector(`.issue-row[data-key="${key}"]`),
          bumpedKey,
        ),
      { timeout: 10_000 },
    )
    .toBe(true)

  // 焦点仍在原行勾选框，且落在重建后的新节点上（旧节点已随整树重建销毁）
  await expect
    .poll(() => focusedRow(page), { timeout: 10_000 })
    .toMatchObject({
      testid: 'row-check',
      key: before!.key,
      marked: false,
    })
  const after = await focusedRow(page)
  expect(after!.keyText).toBe(before!.keyText)
})
