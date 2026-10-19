import { expect, test, type Page } from '@playwright/test'

/** 视图切换（oas-tabs 宿主 + oas-change 契约事件，与 segmented 时代同协议） */
async function setView(page: Page, v: string) {
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    ;(el as unknown as { value: string }).value = view
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
}

async function waitForSeed(page: Page) {
  test.setTimeout(150_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v5')), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

async function switchUser(page: Page, id: string) {
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId(`pick-user-${id}`).click()
  await expect(page.getByTestId('modal-user')).not.toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
}

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

type ResTask = { id: string; name: string; start: string; end: string; resources?: string[] }

/** oas-resource 的 resources/tasks property 读回（宿主注入通道） */
function resHost(page: Page) {
  return page.getByTestId('resource-view-gantt').evaluate((el) => {
    const h = el as HTMLElement & {
      resources?: Array<{ id: string; name: string }>
      tasks?: ResTask[]
    }
    return { resources: h.resources ?? [], tasks: h.tasks ?? [] }
  })
}

function readIssue(page: Page, id: string) {
  return page.evaluate(async (issueId) => {
    const req = indexedDB.open('oas-pm')
    const db = await new Promise<IDBDatabase>((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('issues', 'readonly')
    return await new Promise<{
      startAt: number | null
      dueAt: number | null
      assigneeId: string | null
    } | null>((res) => {
      const r = tx.objectStore('issues').get(issueId as string)
      r.onsuccess = () => {
        const row = r.result as
          | { startAt: number | null; dueAt: number | null; assigneeId: string | null }
          | undefined
        res(row ? { startAt: row.startAt, dueAt: row.dueAt, assigneeId: row.assigneeId } : null)
      }
      r.onerror = () => res(null as never)
    })
  }, id)
}

test('R1 资源视图可达：tab 可见 → oas-resource 渲染 → 资源行 ≥ 成员数', async ({ page }) => {
  await waitForSeed(page)
  // 侧栏第 5 个视图 tab（资源）可见（Playwright locator 穿透 shadow DOM）
  const resourceTab = page.getByTestId('view-seg').locator('.tab', { hasText: '资源' })
  await expect(resourceTab).toBeVisible()
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  // 资源行 = 成员 + 未分配虚拟行（seed 8 成员 → ≥ 8）
  await expect
    .poll(async () => (await resHost(page)).resources.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(8)
})

test('R2 负载/超载：seed 下有人多任务 → 超载角标 N 人 ≥ 1', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  // oas-overload 事件 → 宿主角标「N 人超载」（day 档容量 1，seed 窗口内必然有成员同日多任务）
  await expect
    .poll(
      async () => {
        const text = (await page.getByTestId('resource-overload-count').textContent()) ?? ''
        return Number(text.match(/(\d+)/)?.[1] ?? 0)
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1)
})

test('R3 点击任务条 → 详情抽屉打开且 issue 正确', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  const target = await page.evaluate(() => {
    const g = document.querySelector('[data-testid=resource-view-gantt]') as HTMLElement & {
      tasks?: ResTask[]
    }
    return g.tasks?.[0] ?? null
  })
  expect(target).toBeTruthy()
  await page.evaluate((task) => {
    const t = task as ResTask
    const g = document.querySelector('[data-testid=resource-view-gantt]') as HTMLElement
    g.dispatchEvent(
      new CustomEvent('oas-task-click', {
        bubbles: true,
        composed: true,
        detail: { id: t.id, task: t, resourceId: (t.resources ?? [])[0] ?? '' },
      }),
    )
  }, target)
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
  // 抽屉标题含该 issue 的 key 序号（name = `${key} ${title}`，title 内嵌 #序号）
  const seq = (target!.name.match(/#(\d+)/)?.[1] ?? '').trim()
  expect(seq).not.toBe('')
  await expect(page.locator('.detail-title')).toContainText(`#${seq}`, { timeout: 10_000 })
})

test('R4 拖拽改期/转派写回（tasks-change 契约重放）；无权限身份不落库', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })

  // 管理员（默认 member-1）：改期 + 转派 → IndexedDB 落库
  const adminTarget = await page.evaluate(() => {
    const g = document.querySelector('[data-testid=resource-view-gantt]') as HTMLElement & {
      tasks?: ResTask[]
    }
    return g.tasks?.find((t) => (t.resources ?? [])[0] === 'member-2') ?? g.tasks?.[0] ?? null
  })
  expect(adminTarget).toBeTruthy()
  // 重放走真实契约通道：宿主 property 赋值（setter 更新组件内部模型并派发 oas-tasks-change）
  const replay = (id: string, patch: Partial<ResTask>) =>
    page.evaluate(
      ({ id, patch }) => {
        const g = document.querySelector('[data-testid=resource-view-gantt]') as HTMLElement & {
          tasks?: ResTask[]
        }
        g.tasks = (g.tasks ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t))
      },
      { id, patch },
    )
  const startAt = new Date('2026-11-02').getTime()
  const dueAt = new Date('2026-11-09').getTime()
  await replay(adminTarget!.id, { start: '2026-11-02', end: '2026-11-09', resources: ['member-3'] })
  await expect
    .poll(async () => readIssue(page, adminTarget!.id), { timeout: 15_000 })
    .toEqual({ startAt, dueAt, assigneeId: 'member-3' })

  // viewer（member-4）：改他人任务 → 不落库（can('issue:edit') 拒绝）且组件内部模型回弹
  await switchUser(page, 'member-4')
  await expect
    .poll(async () => (await resHost(page)).tasks.length, { timeout: 15_000 })
    .toBeGreaterThan(0)
  const viewerTarget = await page.evaluate(() => {
    const g = document.querySelector('[data-testid=resource-view-gantt]') as HTMLElement & {
      tasks?: ResTask[]
    }
    return g.tasks?.find((t) => t.id !== null && (t.resources ?? [])[0] === 'member-1') ?? null
  })
  expect(viewerTarget).toBeTruthy()
  const before = await readIssue(page, viewerTarget!.id)
  const hostBefore = (await resHost(page)).tasks.find((t) => t.id === viewerTarget!.id)
  expect(hostBefore).toBeTruthy()
  await replay(viewerTarget!.id, { start: '2027-05-01', end: '2027-05-06' })
  await page.waitForTimeout(1200)
  const after = await readIssue(page, viewerTarget!.id)
  expect(after?.startAt).toBe(before?.startAt)
  expect(after?.dueAt).toBe(before?.dueAt)
  expect(after?.assigneeId).toBe(before?.assigneeId)
  // 回归：无写库 liveQuery 不推新值 → 重注入必须把内部模型弹回拖拽前的 start/end/resources
  await expect
    .poll(
      async () => {
        const t = (await resHost(page)).tasks.find((x) => x.id === viewerTarget!.id)
        return t ? { start: t.start, end: t.end, resources: t.resources ?? [] } : null
      },
      { timeout: 15_000 },
    )
    .toEqual({
      start: hostBefore!.start,
      end: hostBefore!.end,
      resources: hostBefore!.resources ?? [],
    })

  await switchUser(page, 'member-1')
})

test('R5 未分配行存在且承接无 assignee 任务', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  // 虚拟行 __unassigned__（未分配）在场 + 至少一条任务挂在该行（seed 15% 无负责人）
  await expect
    .poll(
      async () => {
        const { resources, tasks } = await resHost(page)
        const hasRow = resources.some((r) => r.id === '__unassigned__')
        const attached = tasks.filter((t) => (t.resources ?? [])[0] === '__unassigned__').length
        return hasRow && attached >= 1 ? attached : 0
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1)
})

test('R6 一键均载（admin）：popconfirm 确认 → 无错误告警，按钮仍在', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  // admin（默认 member-1）+ seed 超载在场（R2 已断言角标 ≥1）→ 均载按钮可见
  await expect(page.getByTestId('resource-level-btn')).toBeVisible({ timeout: 15_000 })

  // popconfirm 确认（契约事件 reason='ok'，同 admin.spec confirmPop / smoke M9）
  await page.getByTestId('resource-level-btn').evaluate((el) => {
    el.closest('oas-popconfirm')?.dispatchEvent(
      new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
    )
  })

  // 反馈告警必现（成功 N / 已均衡 / 失败三态之一；告警 4s 自动隐藏，poll 短间隔抢读）
  await expect
    .poll(async () => (await page.getByTestId('resource-level-alert').textContent()) ?? '', {
      timeout: 15_000,
      intervals: [100, 300, 500],
    })
    .not.toBe('')
  const text = ((await page.getByTestId('resource-level-alert').textContent()) ?? '').trim()
  expect(text).not.toContain('失败')
  expect(text).not.toContain('failed')

  // 无错误 → 按钮仍在（seed 负载远超容量，reassign 后仍有超载，入口不撤）
  await expect(page.getByTestId('resource-level-btn')).toBeVisible()
})

test('R7 均载按钮仅 admin 可见：viewer 不渲染', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  // admin + 超载在场 → 按钮渲染（前置，避免超载为 0 时的空过断言）
  await expect(page.getByTestId('resource-level-btn')).toBeVisible({ timeout: 15_000 })
  // viewer（member-4）：can('bulk:apply') 拒绝 → 按钮不渲染
  await switchUser(page, 'member-4')
  await expect(page.getByTestId('resource-level-btn')).toHaveCount(0)
})

test('R8 均载确认监听随重挂重绑：搜索清空 → 恢复 → 确认仍生效', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'resource')
  await expect(page.getByTestId('resource-view-gantt')).toBeAttached({ timeout: 10_000 })
  await expect(page.getByTestId('resource-level-btn')).toBeVisible({ timeout: 15_000 })

  // 搜索无结果 → 资源视图空态树卸载 popconfirm（按钮随之消失）
  await fillOInput(page, 'toolbar-search', 'zzzz不存在')
  await expect(page.getByTestId('resource-level-btn')).toHaveCount(0, { timeout: 10_000 })

  // 清除搜索 → 数据回流，popconfirm 重挂为全新 DOM 节点（确认监听必须绑在新节点上）
  await fillOInput(page, 'toolbar-search', '')
  await expect(page.getByTestId('resource-level-btn')).toBeVisible({ timeout: 15_000 })

  // 在重挂后的节点上派发契约事件（reason='ok'，同 R6）——旧实现监听器滞留死节点时此事件无响应
  await page.getByTestId('resource-level-btn').evaluate((el) => {
    el.closest('oas-popconfirm')?.dispatchEvent(
      new CustomEvent('oas-open-change', { bubbles: true, detail: { reason: 'ok' } }),
    )
  })

  // 告警三态之一必现且非失败（4s 自动隐藏，poll 短间隔抢读）
  await expect
    .poll(async () => (await page.getByTestId('resource-level-alert').textContent()) ?? '', {
      timeout: 15_000,
      intervals: [100, 300, 500],
    })
    .not.toBe('')
  const text = ((await page.getByTestId('resource-level-alert').textContent()) ?? '').trim()
  expect(text).not.toContain('失败')
  expect(text).not.toContain('failed')
})
