import { expect, test, type Page } from '@playwright/test'

async function waitForSeed(page: Page) {
  // 高负载下 100K 播种可能超 100s：轮询与用例预算统一留余量
  test.setTimeout(240_000)
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

/** 列表 shadow 内的焦点落点（行内控件在 shadow 内，document.activeElement 拿不到） */
function focusedRow(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-testid=issue-vlist]')
    const ae = host?.shadowRoot?.activeElement as HTMLElement | null | undefined
    if (!ae) return null
    const row = ae.closest('.issue-row') as HTMLElement | null
    // 焦点环判定取最内层真实聚焦元素：oas-checkbox 的焦点落在内部 input，宿主只是 retarget 目标
    const deep = (ae.shadowRoot?.activeElement as HTMLElement | null) ?? ae
    return {
      testid: ae.dataset.testid ?? '',
      key: row?.dataset.key ?? '',
      // 行内可见 key：不依赖恢复机制使用的 data-key，独立核对行身份
      keyText: row?.querySelector('.issue-key')?.textContent ?? '',
      // K6 标记：重建后的新节点不带标记 → 证明焦点确实迁到新 DOM
      marked: ae.dataset.k6 === '1',
      // 焦点环：鼠标点击进来的焦点不应显示（程序化恢复可能继承键盘态，实测见 K7 注释）
      ring: deep.matches(':focus-visible'),
    }
  })
}

/** 行内聚焦点快照：与 VirtualIssueList 的恢复口径一致（行 data-key + 控件 testid，空 testid = 行本体） */
interface RowFocus {
  key: string
  testid: string
}

/** 打标当前焦点行控件：重建后标记必须消失，否则说明本轮没走到整树重建（用例无效） */
function markFocused(page: Page) {
  return page.evaluate(() => {
    const ae = document.querySelector('[data-testid=issue-vlist]')?.shadowRoot
      ?.activeElement as HTMLElement | null
    if (ae) ae.dataset.k6 = '1'
  })
}

/**
 * 触发通道 A（dev 服务器）：动态 import 应用自己的仓库单例（与页面同一 Dexie 实例），
 * 走仓库层写库 → Dexie storagemutated → liveQuery 重派 → 列表 items 换引用 → 行整树重建。
 * 直写 IndexedDB 不行：原生写入不经过 Dexie 的变更广播，liveQuery 不会重派。
 * 构建/预发布环境没有 Vite dev 模块 URL（/src/** 只在 dev 下可解析）→ 返回空串，调用方回退通道 B。
 */
async function updateViaModule(page: Page, skipKey: string): Promise<string> {
  return page.evaluate(async (skip) => {
    try {
      type Row = { key: string; status: string }
      type Repo = {
        get: (id: string) => Promise<Row | undefined>
        update: (id: string, changes: Record<string, unknown>) => Promise<void>
      }
      const spec = '/src/data/dexie/index.ts'
      const mod = (await import(spec)) as { dexieRepositories?: { issues?: Repo } }
      const repo = mod.dexieRepositories?.issues
      if (!repo) return ''
      for (const id of ['issue-project-1-1001', 'issue-project-1-1002', 'issue-project-1-1003']) {
        const row = await repo.get(id)
        if (!row || row.key === skip) continue
        await repo.update(id, { status: row.status === 'done' ? 'todo' : 'done' })
        return row.key
      }
      return ''
    } catch {
      return ''
    }
  }, skipKey)
}

/** 把焦点还给行内控件（通道 B 专用）：行本体 tabindex=0 可直接聚焦；
 *  宿主自定义元素（oas-checkbox）自身不可聚焦，焦点要落到内部 input 上 */
async function refocusRow(page: Page, focus: RowFocus): Promise<void> {
  const row = page.locator(`.issue-row[data-key="${focus.key}"]`)
  if (!focus.testid) {
    await row.focus()
    return
  }
  const control = row.locator(`[data-testid="${focus.testid}"]`)
  const inner = control.locator('input:not([disabled])')
  if ((await inner.count()) > 0) await inner.first().focus()
  else await control.focus()
}

/**
 * 抽屉改状态（通道 B 的唯一写入动作）：点该行 → 抽屉 → OSelect 契约事件改值 → save() 落库。
 * `refocus` 非空时在写库前把焦点还给行内控件：点行/开抽屉都会带走焦点（oas-drawer 打开即
 * focusInitial），而恢复逻辑只在「重建那一刻行内有焦点」才触发——不还焦点就等于没测到恢复。
 */
async function flipStatusViaDrawer(
  page: Page,
  targetKey: string,
  refocus: RowFocus | null,
): Promise<void> {
  await page.locator(`.issue-row[data-key="${targetKey}"]`).click()
  await expect(page.getByTestId('detail-status')).toBeAttached({ timeout: 10_000 })
  if (refocus) await refocusRow(page, refocus)
  const cur = await page.evaluate(
    () =>
      (document.querySelector('[data-testid=detail-status]') as { value?: string } | null)?.value ??
      '',
  )
  const next = cur === 'in_progress' ? 'todo' : 'in_progress'
  // 与 smoke/api-mode 同口径：property + 契约事件驱动 OSelect，不依赖下拉浮层的鼠标路径
  await page.evaluate((v) => {
    const el = document.querySelector('[data-testid=detail-status]')
    ;(el as unknown as { value: string }).value = v
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: v } }))
  }, next)
}

/**
 * 触发通道 B（构建/预发布回退）：全程走应用自己的 UI 写入链路——
 * 打开另一行的详情抽屉改状态（不碰被测行，避免把被测行改出窗口）→ 抽屉 save() → 仓库 update
 * → liveQuery → 列表 items 换引用。两条通道驱动同一重建效应（[issues, lang]）。
 */
async function updateViaDrawer(page: Page, focus: RowFocus): Promise<string> {
  const targetKey = await page.evaluate((skip) => {
    const root = document.querySelector('[data-testid=issue-vlist]')?.shadowRoot
    const rows = Array.from(root?.querySelectorAll('.issue-row') ?? []) as HTMLElement[]
    return rows.find((r) => r.dataset.key && r.dataset.key !== skip)?.dataset.key ?? ''
  }, focus.key)
  if (!targetKey) return ''
  await flipStatusViaDrawer(page, targetKey, focus)
  return targetKey
}

/** 外部数据更新：优先通道 A，失败回退通道 B；返回被改 issue 的 key */
async function triggerExternalUpdate(page: Page, focus: RowFocus): Promise<string> {
  const viaModule = await updateViaModule(page, focus.key)
  if (viaModule) return viaModule
  return updateViaDrawer(page, focus)
}

/** 列表 shadow 内是否还有行拿着焦点（K9 的「不跳到其他行」断言） */
function activeInRow(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid=issue-vlist]')?.shadowRoot
    const ae = (root?.activeElement as HTMLElement | null) ?? null
    return !!(ae && ae.closest('.issue-row'))
  })
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** 状态 id → 侧栏文案（e2e 固定 zh-CN） */
const STATUS_LABEL: Record<string, string> = {
  backlog: '待规划',
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
}

/** 窗口内是否还渲染着该 key 的行 */
function rowInWindow(page: Page, key: string) {
  return page.evaluate(
    (k) =>
      !!document
        .querySelector('[data-testid=issue-vlist]')
        ?.shadowRoot?.querySelector(`.issue-row[data-key="${k}"]`),
    key,
  )
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
  await markFocused(page)

  const bumpedKey = await triggerExternalUpdate(page, { key: before!.key, testid: 'row-check' })
  expect(bumpedKey).not.toBe('')
  // 前置：列表确实吃了这次更新（改的那条升到窗口头部、被渲染出来）
  await expect.poll(() => rowInWindow(page, bumpedKey), { timeout: 10_000 }).toBe(true)

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

test('K7 鼠标路径焦点环：外部更新后焦点仍在原行勾选框且无焦点环', async ({ page }) => {
  await waitForSeed(page)
  const firstCheck = page.locator('.issue-row .row-check').first()
  await expect(firstCheck).toBeVisible({ timeout: 10_000 })
  // 鼠标点击（不用 focus()）：浏览器按鼠标模态判定 :focus-visible，用户不该看到焦点环
  await firstCheck.click()
  const before = await focusedRow(page)
  expect(before).toMatchObject({ testid: 'row-check' })
  expect(before!.key).not.toBe('')
  expect(before!.ring).toBe(false)
  await markFocused(page)

  const bumpedKey = await triggerExternalUpdate(page, { key: before!.key, testid: 'row-check' })
  expect(bumpedKey).not.toBe('')
  await expect.poll(() => rowInWindow(page, bumpedKey), { timeout: 10_000 }).toBe(true)

  await expect
    .poll(() => focusedRow(page), { timeout: 10_000 })
    .toMatchObject({ testid: 'row-check', key: before!.key, marked: false })
  // 恢复走的是程序化 focus()：Chromium 实测维持更新前的鼠标模态（ring 仍 false），
  // 故断言「与更新前一致」而非硬编码 false——若某天浏览器改为继承键盘态，这里会先红。
  const after = await focusedRow(page)
  expect(after!.ring).toBe(before!.ring)
  expect(after!.ring).toBe(false)
})

test('K8 行本体路径：外部更新后焦点仍在该行本体（data-key 不变）', async ({ page }) => {
  await waitForSeed(page)
  const firstRow = page.locator('.issue-row').first()
  await expect(firstRow).toBeVisible({ timeout: 10_000 })
  // 行容器 tabindex=0，可聚焦本体（焦点快照的 testid 为空 → 恢复时退回行本体）
  await firstRow.focus()
  const before = await focusedRow(page)
  expect(before).toMatchObject({ testid: '' })
  expect(before!.key).not.toBe('')
  await markFocused(page)

  const bumpedKey = await triggerExternalUpdate(page, { key: before!.key, testid: '' })
  expect(bumpedKey).not.toBe('')
  expect(bumpedKey).not.toBe(before!.key)
  await expect.poll(() => rowInWindow(page, bumpedKey), { timeout: 10_000 }).toBe(true)

  await expect
    .poll(() => focusedRow(page), { timeout: 10_000 })
    .toMatchObject({ testid: '', key: before!.key, marked: false })
  const after = await focusedRow(page)
  expect(after!.keyText).toBe(before!.keyText)
})

test('K9 筛出窗口静默：焦点行离开窗口后没有任何行接管焦点', async ({ page }) => {
  await waitForSeed(page)
  const firstCheck = page.locator('.issue-row .row-check').first()
  await expect(firstCheck).toBeVisible({ timeout: 10_000 })
  const head = await page.evaluate(() => {
    const row = document
      .querySelector('[data-testid=issue-vlist]')
      ?.shadowRoot?.querySelector('.issue-row') as HTMLElement | null
    const cls = row?.querySelector('.issue-status')?.className ?? ''
    return { key: row?.dataset.key ?? '', status: /st-([a-z_]+)/.exec(cls)?.[1] ?? '' }
  })
  expect(head.key).not.toBe('')
  expect(head.status).not.toBe('')
  // 挑一个与当前行状态不同的侧栏状态项，点下去即可把该行筛出窗口
  const otherStatus = Object.keys(STATUS_LABEL).find((s) => s !== head.status)!
  await firstCheck.locator('input').focus()
  expect(await focusedRow(page)).toMatchObject({ testid: 'row-check', key: head.key })

  await sideRow(page, STATUS_LABEL[otherStatus]).click()
  await expect.poll(() => rowInWindow(page, head.key), { timeout: 10_000 }).toBe(false)
  // 恢复逻辑只做「按 key 找回」，找不回就静默放弃：焦点不许落到任何行上 / 不许跳到别的行
  await page.waitForTimeout(300)
  expect(await activeInRow(page)).toBe(false)
  expect(await focusedRow(page)).toBeNull()

  // 第二阶段：把「焦点行被筛出窗口」真正走一遍。第一阶段点侧栏必然先把焦点带离行内，
  // capture 拿到 null、恢复逻辑根本没机会跑（这一步只挡「机制主动抢焦点回列表」）。
  // 这里聚焦一行后改它自己的状态（脱离当前状态筛选），重建时才真的走到「行已不在窗内」分支。
  const target = page.locator('.issue-row').first()
  const targetKey = (await target.getAttribute('data-key')) ?? ''
  expect(targetKey).not.toBe('')
  await target.locator('.row-check').click()
  expect(await focusedRow(page)).toMatchObject({ testid: 'row-check', key: targetKey })
  await flipStatusViaDrawer(page, targetKey, { key: targetKey, testid: 'row-check' })
  await expect.poll(() => rowInWindow(page, targetKey), { timeout: 10_000 }).toBe(false)
  await page.waitForTimeout(300)
  expect(await activeInRow(page)).toBe(false)
  expect(await focusedRow(page)).toBeNull()
})
