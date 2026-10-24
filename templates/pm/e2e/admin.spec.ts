import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

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

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await page.getByTestId('user-menu').getByRole('menuitem', { name: '切换身份' }).click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

function statNumber(text: string | null): number {
  return Number(text?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') ?? 0)
}

/** 侧栏行按钮（oas-sidebar shadow 内 button，accessible name = 行 label） */
const sideRow = (page: Page, name: string) =>
  page.getByTestId('side-panel').getByRole('button', { name, exact: true })

/** oas-input 填值（弹窗在 light DOM，document.querySelector 可达） */
async function fillOInput(page: Page, testid: string, text: string) {
  await page.evaluate(
    ([tid, val]) => {
      const host = document.querySelector(`[data-testid="${tid}"]`)
      const inner =
        (host?.shadowRoot?.querySelector('input, textarea') as HTMLInputElement) ??
        (host as HTMLInputElement)
      inner.value = val as string
      host?.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: val } }))
    },
    [testid, text],
  )
}

/** light DOM 内 oas-select 设值（property + 契约事件） */
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

/** shadow DOM 内（表格单元格）oas-select 设值 */
async function setCellSelect(row: Locator, v: string) {
  await row.getByTestId(/^admin-member-role-/).evaluate((el, val) => {
    ;(el as unknown as { value: string }).value = val as string
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
  }, v)
}

/** popconfirm 确认（契约事件 reason='ok'，同 smoke M9） */
async function confirmPop(btn: Locator) {
  await btn.evaluate((el) => {
    el.closest('oas-popconfirm')?.dispatchEvent(
      new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
    )
  })
}

test('A1 管理总览：入口 → 统计/工作量/健康度 → 行点击回项目 → 占位页签 → 返回工作台', async ({
  page,
}) => {
  await waitForSeed(page)

  await expect(page.getByTestId('admin-entry')).toBeVisible()
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await expect(page.getByTestId('side-panel')).toHaveCount(0)
  await expect(page.getByTestId('admin-tab-overview')).toBeVisible()

  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-issues').textContent()), {
      timeout: 30_000,
    })
    // e2e 播种 5K：断言「真实全量（≈5K）而非首屏窗口」，不再写死 10 万级的绝对数
    .toBeGreaterThan(4_000)
  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-projects').textContent()))
    .toBe(2)
  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-members').textContent()))
    .toBe(8)
  await expect(page.getByTestId('admin-stat-done')).toContainText(/[1-9]/)

  await expect
    .poll(async () => {
      const d = await page.getByTestId('admin-chart-workload').getAttribute('data')
      return /"data":\[\d/.test(d ?? '') ? 1 : 0
    })
    .toBe(1)

  const rows = page.getByTestId('admin-table-health').locator('tbody tr')
  await expect
    .poll(
      async () =>
        page
          .getByTestId('admin-table-health')
          .evaluate((el) => ((el as { data?: unknown[] }).data ?? []).length),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0)
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
  const firstRowText = (await rows.first().textContent()) ?? ''
  const targetProject = firstRowText.includes('移动端 App') ? 'project-2' : 'project-1'
  await rows.first().click()
  await expect(page.getByTestId('admin-view')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  const projectRow = sideRow(page, targetProject === 'project-2' ? '移动端 App' : 'OAS 平台')
  await expect(projectRow).toHaveClass(/active/)
  await expect(projectRow).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.issue-row .issue-key').first()).toContainText(
    targetProject === 'project-2' ? 'APP-' : 'OAS-',
    { timeout: 10_000 },
  )

  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await page.getByTestId('admin-nav-config').click()
  await expect(page.getByTestId('admin-tab-config')).toBeVisible()
  await expect(page.getByTestId('admin-config-labels')).toBeVisible()
  await page.getByTestId('admin-back').click()
  await expect(page.getByTestId('admin-view')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
})

test('A2 viewer 门禁：无管理入口', async ({ page }) => {
  await waitForSeed(page)
  await switchUser(page, 'member-4')
  await expect(page.getByTestId('admin-entry')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await switchUser(page, 'member-1')
})

test('A3 member 门禁：无管理入口', async ({ page }) => {
  await waitForSeed(page)
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-entry')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await switchUser(page, 'member-1')
})

test('A4 门禁回落：admin 视图内切身份为 member → 自动回工作台', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await switchUser(page, 'member-2')
  await expect(page.getByTestId('admin-view')).toHaveCount(0)
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
  await switchUser(page, 'member-1')
})

test('A5 项目闭环：新建 → 表格行 + 侧栏可见 → 删除 → 行消失', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await page.getByTestId('admin-nav-projects').click()
  await expect(page.getByTestId('admin-tab-projects')).toBeVisible()

  await page.getByTestId('admin-project-new').click()
  await expect(page.getByTestId('admin-project-modal')).toHaveAttribute('visible', /.*/)
  await fillOInput(page, 'admin-project-name', 'P3 测试项目')
  await fillOInput(page, 'admin-project-key', 'P3T')
  await setOSelect(page, 'admin-project-lead', 'member-1')
  await page.getByTestId('admin-project-save').click()
  await expect(page.getByTestId('admin-project-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })

  const table = page.getByTestId('admin-table-projects')
  const row = table.locator('tbody tr', { hasText: 'P3 测试项目' })
  await expect(row).toBeVisible({ timeout: 20_000 })

  await page.getByTestId('admin-back').click()
  await expect(page.getByTestId('side-panel')).toBeVisible()
  await expect(sideRow(page, 'P3 测试项目')).toBeVisible({ timeout: 10_000 })

  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-projects').click()
  await expect(page.getByTestId('admin-tab-projects')).toBeVisible()
  await expect(row).toBeVisible({ timeout: 20_000 })
  await confirmPop(row.getByTestId(/^admin-project-del-/))
  await expect(table.locator('tbody tr', { hasText: 'P3 测试项目' })).toHaveCount(0, {
    timeout: 10_000,
  })
})

test('A6 非空项目删除被阻止：错误提示可见 + 项目仍在', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-projects').click()
  const table = page.getByTestId('admin-table-projects')
  const row = table.locator('tbody tr', { hasText: 'OAS 平台' })
  await expect(row).toBeVisible({ timeout: 30_000 })
  await confirmPop(row.getByTestId(/^admin-project-del-/))
  await expect(page.getByTestId('admin-project-error')).toBeVisible({ timeout: 10_000 })
  await expect(table.locator('tbody tr', { hasText: 'OAS 平台' })).toBeVisible()
})

test('A7 成员闭环：新建 → 行可见 → 行内改角色 viewer → 移除 → 行消失', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-members').click()
  await expect(page.getByTestId('admin-tab-members')).toBeVisible()

  await page.getByTestId('admin-member-new').click()
  await expect(page.getByTestId('admin-member-modal')).toHaveAttribute('visible', /.*/)
  await fillOInput(page, 'admin-member-name', 'P3 成员')
  await fillOInput(page, 'admin-member-email', 'p3@oas.dev')
  await setOSelect(page, 'admin-member-role-new', 'member')
  await page.getByTestId('admin-member-save').click()
  await expect(page.getByTestId('admin-member-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })

  const table = page.getByTestId('admin-table-members')
  const row = table.locator('tbody tr', { hasText: 'P3 成员' })
  await expect(row).toBeVisible({ timeout: 10_000 })

  await setCellSelect(row, 'viewer')
  await expect
    .poll(() =>
      row
        .getByTestId(/^admin-member-role-/)
        .evaluate((el) => (el as unknown as { value?: string }).value ?? ''),
    )
    .toBe('viewer')

  await confirmPop(row.getByTestId(/^admin-member-del-/))
  await expect(table.locator('tbody tr', { hasText: 'P3 成员' })).toHaveCount(0, {
    timeout: 10_000,
  })
})

test('A8 最后管理员守卫：行内降级被拒 → 错误提示 + 角色回读 admin', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-members').click()
  const table = page.getByTestId('admin-table-members')
  const row = table.locator('tbody tr', { hasText: '张伟' })
  await expect(row).toBeVisible({ timeout: 10_000 })
  const roleSel = row.getByTestId(/^admin-member-role-/)
  await setCellSelect(row, 'member')
  await expect(page.getByTestId('admin-member-error')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => roleSel.evaluate((el) => (el as unknown as { value?: string }).value ?? ''))
    .toBe('admin')
  await expect(table.locator('tbody tr', { hasText: '张伟' })).toBeVisible()
})

test('A9 标签集：工作项配置新增标签 → 抽屉快捷按钮可见并落 chip → 回收清理', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-config').click()
  await expect(page.getByTestId('admin-config-labels')).toBeVisible()

  const tags = page.getByTestId('admin-labels-tags')
  await tags.locator('input').first().click()
  await page.keyboard.type('p3-label')
  await page.keyboard.press('Enter')
  await expect
    .poll(() =>
      tags.evaluate((el) =>
        ((el as unknown as { modelValue?: string[] }).modelValue ?? []).includes('p3-label'),
      ),
    )
    .toBe(true)

  await page.getByTestId('admin-back').click()
  await expect(page.getByTestId('side-panel')).toBeVisible()
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
      { timeout: 10_000 },
    )
    .toBe(true)
  await expect(page.getByTestId('label-quick-p3-label')).toBeVisible()
  await page.getByTestId('label-quick-p3-label').click()
  await expect(
    page
      .getByTestId('label-add')
      .locator('.tag-label')
      .filter({ hasText: /^p3-label$/ }),
  ).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })

  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-config').click()
  await tags.locator('.tag', { hasText: 'p3-label' }).locator('.tag-remove').click()
  await expect
    .poll(() =>
      tags.evaluate((el) =>
        ((el as unknown as { modelValue?: string[] }).modelValue ?? []).includes('p3-label'),
      ),
    )
    .toBe(false)
})

test('A10 权限矩阵：行数与 ACTIONS 一致，viewer×新建只读为 —，admin 列全 ✓', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-permissions').click()
  const matrix = page.getByTestId('admin-permissions-matrix')
  await expect(matrix).toBeVisible()
  const rows = matrix.locator('tbody tr:not(.group-header)')
  await expect(rows).toHaveCount(15, { timeout: 10_000 })
  const viewerCell = rows.filter({ hasText: '新建 Issue' }).first().locator('td').nth(1)
  await expect(viewerCell).toHaveText('—')
  const adminCells = matrix.locator('tbody tr:not(.group-header) td:nth-child(4)')
  await expect(adminCells).toHaveCount(15)
  for (const cell of await adminCells.all()) {
    expect(await cell.textContent()).toContain('✓')
  }
})

test('A11 数据闭环：导出 JSON（含权限表）→ 清空保留管理员 → 刷新不重播 → 导入恢复 → 统计回归', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000)
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-settings').click()
  await expect(page.getByTestId('admin-data-actions')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('admin-export-json').click()
  const download = await downloadPromise
  const backup = testInfo.outputPath('oas-pm-backup.json')
  await download.saveAs(backup)
  const parsed = JSON.parse(readFileSync(backup, 'utf8')) as {
    version: number
    tables: Record<string, unknown[]>
  }
  expect(parsed.version).toBe(10)
  expect(parsed.tables.roles.length).toBeGreaterThanOrEqual(3)
  expect(parsed.tables.projectMembers.length).toBeGreaterThan(0)
  expect(parsed.tables.projectRoles).toBeInstanceOf(Array)

  await confirmPop(page.getByTestId('admin-wipe-all'))
  await expect(page.getByTestId('admin-data-ok')).toBeVisible({ timeout: 20_000 })
  // 清空保留当前管理员与内置角色：可原地恢复备份，且刷新后不重播演示数据
  await expect(page.getByTestId('admin-view')).toBeVisible()
  await page.getByTestId('admin-back').click()
  await expect(page.getByTestId('issues-empty')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.issue-row')).toHaveCount(0)
  await expect(page.getByTestId('admin-entry')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('admin-entry')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('issues-empty')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-settings').click()
  await expect(page.getByTestId('admin-data-actions')).toBeVisible()
  await page.getByTestId('admin-import-json').setInputFiles(backup)
  await page.getByTestId('admin-import-btn').click()
  await expect(page.getByTestId('admin-data-ok')).toBeVisible({ timeout: 120_000 })

  await page.reload()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('admin-entry').click()
  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-issues').textContent()), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    // 备份文件来自 e2e 5K seed：导入后条数应回到 5K 量级（> 首屏窗口）
    .toBeGreaterThan(4_000)
})

test('A12 重建演示数据：确认 → 页面重载 → 数据恢复（统计回到 5K 量级）', async ({ page }) => {
  test.setTimeout(300_000)
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-settings').click()
  await expect(page.getByTestId('admin-data-actions')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __t4Boot?: number }).__t4Boot = 1
  })
  await confirmPop(page.getByTestId('admin-reset-demo'))
  await expect
    .poll(
      async () => {
        try {
          return await page.evaluate(
            () => (window as unknown as { __t4Boot?: number }).__t4Boot ?? 0,
          )
        } catch {
          return 1
        }
      },
      { timeout: 300_000, intervals: [1000, 3000, 5000] },
    )
    .toBe(0)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 120_000 })
  await page.getByTestId('admin-entry').click()
  await expect
    .poll(async () => statNumber(await page.getByTestId('admin-stat-issues').textContent()), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    // 重建后回填 e2e 5K seed（initScript 仍生效）：断言回到 5K 量级
    .toBeGreaterThan(4_000)
})

/* ── 迭代管理页签 ── */

function dayStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 日期选择器：value 走 property（'YYYY-MM-DD'），oas-change detail {value} 驱动受控状态 */
async function setODate(page: Page, testid: string, v: string) {
  await page.evaluate(
    ([tid, val]) => {
      const el = document.querySelector(`[data-testid="${tid}"]`)
      ;(el as unknown as { value: string }).value = val as string
      el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: val } }))
    },
    [testid, v],
  )
}

test('A13 迭代页签闭环：新建（重叠警告允许保存）→ 编辑名称 → 删除', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-cycles').click()
  await expect(page.getByTestId('admin-tab-cycles')).toBeVisible({ timeout: 10_000 })

  const table = page.getByTestId('admin-table-cycles')
  // seed v9：project-1 三个周期，Sprint 1/2 已结束、Sprint 3 进行中
  await expect(table.locator('tbody tr', { hasText: 'Sprint 1' })).toBeVisible({ timeout: 30_000 })
  await expect(table.locator('tbody tr', { hasText: 'Sprint 1' })).toContainText('已结束')
  await expect(table.locator('tbody tr', { hasText: 'Sprint 3' })).toContainText('进行中')

  // 新建：今天 ~ 今天+7（与 Sprint 3 重叠 → 警告出现，但允许保存）
  await page.getByTestId('admin-cycle-new').click()
  await expect(page.getByTestId('admin-cycle-modal')).toHaveAttribute('visible', /.*/)
  await fillOInput(page, 'admin-cycle-name', 'Sprint 9')
  await setOSelect(page, 'admin-cycle-project', 'project-1')
  await setODate(page, 'admin-cycle-start', dayStr(0))
  await setODate(page, 'admin-cycle-end', dayStr(7))
  await expect(page.getByTestId('admin-cycle-overlap-warn')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('admin-cycle-save').click()
  await expect(page.getByTestId('admin-cycle-modal')).not.toHaveAttribute('visible', /.*/, {
    timeout: 10_000,
  })

  const row = table.locator('tbody tr', { hasText: 'Sprint 9' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText('进行中')

  // 编辑：改名后表格行跟随
  await row.getByTestId(/^admin-cycle-edit-/).click()
  await expect(page.getByTestId('admin-cycle-modal')).toHaveAttribute('visible', /.*/)
  await fillOInput(page, 'admin-cycle-name', 'Sprint 9b')
  await page.getByTestId('admin-cycle-save').click()
  await expect(table.locator('tbody tr', { hasText: 'Sprint 9b' })).toBeVisible({ timeout: 10_000 })

  // 删除：确认后行消失
  await confirmPop(
    table.locator('tbody tr', { hasText: 'Sprint 9b' }).getByTestId(/^admin-cycle-del-/),
  )
  await expect(table.locator('tbody tr', { hasText: 'Sprint 9b' })).toHaveCount(0, {
    timeout: 10_000,
  })
})

test('A14 迭代删除不误删工作项：删周期后 Issue 仍在，归属回到未入迭代', async ({ page }) => {
  await waitForSeed(page)
  // 取一个归属 Sprint 1 的 issue key（表格外的原始数据探针）
  const key = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    const idx = db.transaction('issues', 'readonly').objectStore('issues').index('cycleId')
    return await new Promise<string>((res) => {
      const rq = idx.openCursor(IDBKeyRange.only('cycle-1'))
      rq.onsuccess = () => {
        const cur = rq.result
        if (!cur) {
          res('')
          return
        }
        res(String((cur.value as { key?: string }).key ?? ''))
      }
    })
  })
  expect(key).not.toBe('')

  await page.getByTestId('admin-entry').click()
  await page.getByTestId('admin-nav-cycles').click()
  const table = page.getByTestId('admin-table-cycles')
  const row = table.locator('tbody tr', { hasText: 'Sprint 1' })
  await expect(row).toBeVisible({ timeout: 30_000 })
  await confirmPop(row.getByTestId(/^admin-cycle-del-/))
  await expect(table.locator('tbody tr', { hasText: 'Sprint 1' })).toHaveCount(0, {
    timeout: 15_000,
  })

  // Issue 未删、归属清空
  const row2 = await page.evaluate(async (k) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const rq = indexedDB.open('oas-pm')
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
    const idx = db.transaction('issues', 'readonly').objectStore('issues').index('key')
    return await new Promise<{ cycleId: string | null } | null>((res) => {
      const rq = idx.get(k)
      rq.onsuccess = () => {
        const v = rq.result as { cycleId?: string | null } | undefined
        res(v ? { cycleId: v.cycleId ?? null } : null)
      }
    })
  }, key)
  expect(row2).not.toBeNull()
  expect(row2?.cycleId).toBe(null)
})
