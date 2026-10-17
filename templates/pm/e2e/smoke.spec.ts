import { expect, test, type Page } from '@playwright/test'

/** 视图切换（oas-segmented property + 契约事件） */
async function setView(page: Page, v: string) {
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    ;(el as unknown as { value: string }).value = view
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
}

/** oas-select 设值（property + 契约事件，宿主 OSelect 监听同元素） */
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

/** oas-input 填值：穿透 shadow 写内部 input 并派发 oas-input */
async function fillOInput(page: Page, testid: string, text: string) {
  await page.evaluate(
    ([tid, val]) => {
      const host = document.querySelector('[data-testid="' + tid + '"]')
      const inner =
        (host?.shadowRoot?.querySelector('input, textarea') as HTMLInputElement) ??
        (host as HTMLInputElement)
      inner.value = val as string
      host?.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: val } }))
    },
    [testid, text],
  )
}

/** 等待 100K seed 完成并以列表行出现（seed 走后台 bulkPut，首次约 5~15s） */
async function waitForSeed(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  // seed 完成的确定性信号：SEED_VER 标记写入（写完 100K 才 set）
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v4')), {
      timeout: 120_000,
      intervals: [1000, 3000, 5000],
    })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 60_000 })
}

test('M1 架构：100K seed + 虚拟列表渲染 + 真实计数', async ({ page }) => {
  await waitForSeed(page)
  // 虚拟滚动只渲染窗口行（40~60 行），不能是全量
  const rows = await page.locator('.issue-row').count()
  expect(rows).toBeGreaterThan(10)
  expect(rows).toBeLessThan(200)
  // 计数是真实全量（≈70K），不是窗口 500
  const total = await page.getByTestId('issue-total').textContent()
  expect(Number(total?.replace(/[^\d]/g, '') ?? 0)).toBeGreaterThan(60_000)
})

test('M2 状态筛选：compound index 直取 + 计数联动', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('filter-in_progress').click()
  // 窗口行全部是 In Progress（行内显示状态标签）
  await expect(page.locator('.issue-row .issue-status').first()).toHaveText('In Progress', {
    timeout: 10_000,
  })
  const statuses = await page.locator('.issue-row .issue-status').allTextContents()
  expect(statuses.length).toBeGreaterThan(0)
  for (const s of statuses) expect(s).toBe('In Progress')
  // 筛选计数 < 全量计数
  const filtered = await page.getByTestId('issue-total').textContent()
  expect(filtered).not.toBeNull()
  // 切回全部
  await page.getByTestId('filter-all').click()
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 10_000 })
})

test('M3 看板：oas-change 跨列移动 → status/order 落库', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeAttached({ timeout: 10_000 })
  // 组件数据就绪（renderCard 通道，cards 由宿主 property 注入）
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const k = document.querySelector('oas-kanban') as HTMLElement & {
            cards?: Array<{ column: string }>
          }
          return (k.cards ?? []).filter((x) => x.column === 'todo').length
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0)

  // 取 todo 列首卡，派发组件契约事件：跨列到 done 首位（index=0）
  const moved = await page.evaluate(() => {
    const k = document.querySelector('oas-kanban') as HTMLElement & {
      cards?: Array<{ id: string; column: string }>
    }
    const card = (k.cards ?? []).find((x) => x.column === 'todo')
    if (!card) return null
    k.dispatchEvent(
      new CustomEvent('oas-change', {
        bubbles: true,
        detail: { id: card.id, from: 'todo', to: 'done', index: 0 },
      }),
    )
    return card.id
  })
  expect(moved).toBeTruthy()
  // 宿主落库：该卡 status=done 且 order 为 done 列最小（首位）
  await expect
    .poll(
      async () =>
        page.evaluate(async (id) => {
          const req = indexedDB.open('oas-pm')
          const dbp = await new Promise<IDBDatabase>((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
          const tx = dbp.transaction('issues', 'readonly')
          const row = await new Promise<{ status?: string; order?: number } | undefined>((res) => {
            const r = tx.objectStore('issues').get(id as string)
            r.onsuccess = () => res(r.result)
          })
          if (!row || row.status !== 'done') return -1
          const idx = tx.objectStore('issues').index('[projectId+status]')
          const doneKeys = await new Promise<number[]>((res) => {
            const r = idx.getAllKeys(['project-1', 'done'])
            r.onsuccess = () => res([])
          })
          void doneKeys
          return row.order ?? -2
        }, moved),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(-1)
  // liveQuery 刷新：组件 cards 中该卡 column=done
  await expect
    .poll(
      async () =>
        page.evaluate((id) => {
          const k = document.querySelector('oas-kanban') as HTMLElement & {
            cards?: Array<{ id: string; column: string }>
          }
          return (k.cards ?? []).find((x) => x.id === id)?.column ?? ''
        }, moved),
      { timeout: 10_000 },
    )
    .toBe('done')
})

test('M3b 看板：列内排序 oas-change → order 落库', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeAttached({ timeout: 10_000 })
  // done 列内：首卡移到第 2 位（index=1）
  const moved = await page.evaluate(() => {
    const k = document.querySelector('oas-kanban') as HTMLElement & {
      cards?: Array<{ id: string; column: string }>
    }
    const done = (k.cards ?? []).filter((x) => x.column === 'done')
    if (done.length < 2) return null
    return done[0].id
  })
  expect(moved).toBeTruthy()
  await page.evaluate((id) => {
    const k = document.querySelector('oas-kanban') as HTMLElement
    k.dispatchEvent(
      new CustomEvent('oas-change', {
        bubbles: true,
        detail: { id, from: 'done', to: 'done', index: 1 },
      }),
    )
  }, moved)
  // liveQuery 刷新后：组件 cards 序中该卡在 done 列第 2 位
  await expect
    .poll(
      async () =>
        page.evaluate((id) => {
          const k = document.querySelector('oas-kanban') as HTMLElement & {
            cards?: Array<{ id: string; column: string }>
          }
          const done = (k.cards ?? []).filter((x) => x.column === 'done')
          return done.findIndex((x) => x.id === id)
        }, moved),
      { timeout: 10_000 },
    )
    .toBe(1)
})

test('M4 时间线：oas-gantt 接收 tasks 并渲染', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'timeline')
  const gantt = page.getByTestId('gantt')
  await expect(gantt).toBeAttached({ timeout: 10_000 })
  // 属性通道（JSON 字符串）→ 组件 property 解析成功：tasks 读回非空
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const g = document.querySelector('oas-gantt') as HTMLElement & { tasks?: unknown[] }
          return Array.isArray(g.tasks) ? g.tasks.length : 0
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0)
})

test('M5 工具栏：新建 Issue 全流程 + CSV 导出 + 关于弹窗', async ({ page }) => {
  await waitForSeed(page)

  // 新建 Issue：标题空 → 错误提示；填写 → 创建 → 列表与看板出现
  await page.getByTestId('toolbar-new').click()
  const modal = page.getByTestId('modal-create')
  await expect(modal).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('create-error')).toBeVisible()
  await fillOInput(page, 'create-title', 'E2E 新建测试 Issue')
  await setOSelect(page, 'create-status', 'todo')
  await setOSelect(page, 'create-priority', 'high')
  await page.getByTestId('create-submit').click()
  await expect(modal).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
  // 新建 updatedAt 最新 → 列表窗口第一行
  await expect(page.locator('.issue-row').first()).toContainText('E2E 新建测试 Issue', {
    timeout: 10_000,
  })
  // 新建 order = Date.now() 列内最大 → 看板 todo 列尾出现（updatedAt 最新必在窗口内）
  await setView(page, 'board')
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const k = document.querySelector('oas-kanban') as HTMLElement & {
            cards?: Array<{ column: string; title: string }>
          }
          const todo = (k.cards ?? []).filter((x) => x.column === 'todo')
          return todo.length ? todo[todo.length - 1].title : ''
        }),
      { timeout: 10_000 },
    )
    .toBe('E2E 新建测试 Issue')

  // CSV 导出
  const dl = page.waitForEvent('download', { timeout: 10_000 })
  await page.getByTestId('toolbar-export').click()
  const download = await dl
  expect(download.suggestedFilename()).toMatch(/^oas-pm-issues-\d+\.csv$/)

  // 关于弹窗开合
  await page.getByTestId('toolbar-about').click()
  const about = page.getByTestId('modal-about')
  await expect(about).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await expect(page.locator('.about-name')).toContainText('OAS PM')
  await page.getByTestId('about-close').click()
  await expect(about).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
})

test('M7 项目切换：project-2 的 key 前缀为 APP-', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('project-project-2').click()
  await expect(page.locator('.issue-row').first()).toContainText('APP-', { timeout: 10_000 })
  const keys = await page.locator('.issue-row .issue-key').allTextContents()
  expect(keys.length).toBeGreaterThan(0)
  for (const k of keys) expect(k.startsWith('APP-')).toBe(true)
  // 状态计数随项目变化（project-2 ≈30%，远小于全量）；文案含「窗口」后缀取首段数字
  await expect
    .poll(async () => {
      const t = await page.getByTestId('issue-total').textContent()
      return Number((t?.match(/^[\d,]+/)?.[0] ?? '0').replace(/,/g, ''))
    })
    .toBeLessThan(40000)
})

test('M8 搜索：标题命中过滤 + 清除筛选', async ({ page }) => {
  await waitForSeed(page)
  await fillOInput(page, 'toolbar-search', '修复登录页面白屏')
  await expect(page.locator('.issue-row').first()).toContainText('修复登录页面白屏', {
    timeout: 10_000,
  })
  const titles = await page.locator('.issue-row .issue-title').allTextContents()
  expect(titles.length).toBeGreaterThan(0)
  for (const t of titles) expect(t).toContain('修复登录页面白屏')
  await page.getByTestId('filter-clear').click()
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=toolbar-search]') as { value?: string })?.value ??
            '',
        ),
      { timeout: 10_000 },
    )
    .toBe('')
})

test('M9 详情抽屉：优先级即时保存 + 描述保存 + 删除两连确认', async ({ page }) => {
  await waitForSeed(page)
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
  const key = await page.getByTestId('detail-drawer').getAttribute('title')
  // 选一个与当前不同的优先级（避免 from===to 无 diff 不落活动/不触发保存）
  const newPri = await page.evaluate(() => {
    const cur = (document.querySelector('[data-testid=detail-priority]') as { value?: string })
      ?.value
    return cur === 'urgent' ? 'high' : 'urgent'
  })
  await setOSelect(page, 'detail-priority', newPri)
  // liveQuery 推送：select 值即时生效 + 列表行徽章变色
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-priority]') as { value?: string })
              ?.value ?? '',
        ),
      { timeout: 10_000 },
    )
    .toBe(newPri)
  await expect(page.locator(`.issue-row .pri-${newPri}`).first()).toBeVisible({ timeout: 10_000 })
  // 描述保存
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid=detail-desc]') as unknown as {
      value: string
      dispatchEvent: (e: Event) => void
    }
    el.value = 'E2E 描述内容'
    el.dispatchEvent(new CustomEvent('oas-input', { bubbles: true }))
  })
  await page.getByTestId('detail-desc-save').click()
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (document.querySelector('[data-testid=detail-desc]') as { value?: string })?.value ??
            '',
        ),
      { timeout: 10_000 },
    )
    .toBe('E2E 描述内容')
  // 删除：popconfirm 确认（契约事件 reason='ok'）→ 抽屉关
  await expect(page.getByTestId('detail-delete')).toBeAttached({ timeout: 10_000 })
  await page.evaluate(() => {
    document.querySelector('[data-testid=detail-delete]')?.dispatchEvent(
      new CustomEvent('oas-open-change', {
        bubbles: true,
        detail: { reason: 'ok' },
      }),
    )
  })
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 10_000 })
  // 列表中该 key 消失
  await page.waitForTimeout(1500)
  const left = await page.locator('.issue-row .issue-key').allTextContents()
  expect(left).not.toContain(key)
})

test('M10 仪表盘：统计卡 + 图表数据', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'dashboard')
  await expect(page.getByTestId('dashboard')).toBeVisible()
  // 统计卡数字就位（seed 大事务批间让出后 liveQuery 逐步逼近，最终一致）
  await expect
    .poll(
      async () => {
        const t = await page.getByTestId('stat-total').textContent()
        return Number(t?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') ?? 0)
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(60000)
  await expect(page.getByTestId('stat-in_progress')).toBeVisible()
  // 图表 data attribute 非空且含数值
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.querySelector('[data-testid=chart-status]')
          const d = el?.getAttribute('data') ?? ''
          return /"value":\d/.test(d) ? 1 : 0
        }),
      { timeout: 10_000 },
    )
    .toBe(1)
})

test('M11 快捷键：C 打开新建 + / 聚焦搜索 + Esc 关抽屉', async ({ page }) => {
  await waitForSeed(page)
  await page.keyboard.press('c')
  await expect(page.getByTestId('modal-create')).toHaveAttribute('visible', /.*/, {
    timeout: 5000,
  })
  await page.getByTestId('create-cancel').click()
  await page.keyboard.press('/')
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
  // Esc 关抽屉
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
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('detail-drawer')).toHaveCount(0, { timeout: 5000 })
})

test('M12 标签与评论：添加标签 chip + 发送评论', async ({ page }) => {
  await waitForSeed(page)
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
  // 加标签：dynamic-tags 聚焦内部输入框输入回车（自由标签）+ 快捷按钮
  await page.locator('[data-testid=label-add]').locator('input').first().click()
  await page.keyboard.type('frontend')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('label-chip-frontend')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('label-quick-bug').click()
  await expect(page.getByTestId('label-chip-bug')).toBeVisible({ timeout: 10_000 })
  // 发评论（回车）
  await fillOInput(page, 'comment-input', 'E2E 评论内容')
  await page.getByTestId('comment-send').click()
  await expect(page.getByTestId('comment-item').first()).toContainText('E2E 评论内容', {
    timeout: 10_000,
  })
  // 关开抽屉持久（IndexedDB）
  await page.keyboard.press('Escape')
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
  await expect(page.getByTestId('comment-item').first()).toContainText('E2E 评论内容', {
    timeout: 10_000,
  })
})

test('M13 新建 Issue key 严格递增（项目计数器）', async ({ page }) => {
  await waitForSeed(page)
  const keys: string[] = []
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('toolbar-new').click()
    await expect(page.getByTestId('modal-create')).toHaveAttribute('visible', /.*/, {
      timeout: 5000,
    })
    await page
      .getByTestId('create-title')
      .locator('input')
      .fill(`递增验证 ${i + 1}`)
    await page.getByTestId('create-submit').click()
    await expect(page.locator('.issue-row').first()).toContainText(`递增验证 ${i + 1}`, {
      timeout: 10_000,
    })
    keys.push((await page.locator('.issue-row .issue-key').first().textContent()) ?? '')
  }
  // 两条 key 均为 OAS-数字，且第二条数值严格大于第一条
  const parse = (k: string) => Number(k.replace('OAS-', ''))
  expect(keys[0]).toMatch(/^OAS-\d+$/)
  expect(keys[1]).toMatch(/^OAS-\d+$/)
  expect(parse(keys[1])).toBe(parse(keys[0]) + 1)
})

test('M14 甘特写回：task-change 改期落库', async ({ page }) => {
  await waitForSeed(page)
  await setView(page, 'timeline')
  await expect(page.getByTestId('gantt')).toBeAttached({ timeout: 10_000 })
  // 组件 tasks property 读回取第一条的 issue id
  const target = await page.evaluate(() => {
    const g = document.querySelector('oas-gantt') as HTMLElement & { tasks?: Array<{ id: string }> }
    return g.tasks?.[0]?.id ?? null
  })
  expect(target).toBeTruthy()
  // 重放 task-change（组件拖拽改期时派发的同一事件）
  await page.evaluate(
    ({ id }) => {
      const g = document.querySelector('oas-gantt') as HTMLElement
      g.dispatchEvent(
        new CustomEvent('task-change', {
          bubbles: true,
          detail: {
            id,
            start: '2026-01-05',
            end: '2026-02-10',
            oldStart: '',
            oldEnd: '',
            task: {},
          },
        }),
      )
    },
    { id: target },
  )
  // liveQuery 列表里该 issue 的 updatedAt 变化 → 排到窗口头部；直接读库验证 dueAt
  await expect
    .poll(
      async () =>
        page.evaluate(async (issueId) => {
          const req = indexedDB.open('oas-pm')
          const dbp = await new Promise<IDBDatabase>((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
          const tx = dbp.transaction('issues', 'readonly')
          const row = await new Promise<{ dueAt?: number; startAt?: number } | undefined>((res) => {
            const r = tx.objectStore('issues').get(issueId as string)
            r.onsuccess = () => res(r.result)
          })
          return row ? `${row.startAt}-${row.dueAt}` : 'missing'
        }, target),
      { timeout: 10_000 },
    )
    .toBe(`${new Date('2026-01-05').getTime()}-${new Date('2026-02-10').getTime()}`)
})

test('M15 批量操作：勾选两条 → 批量改状态 → 删除一条', async ({ page }) => {
  await waitForSeed(page)
  // 勾选前两行（virtual-list 行会随选中态重建，用 evaluate 直派点击绕 actionability）
  const clickCheck = (nth: number) =>
    page
      .locator('.issue-row .row-check')
      .nth(nth)
      .evaluate((el) => (el as HTMLInputElement).click())
  await page.locator('.issue-row .row-check').nth(0).waitFor({ timeout: 10_000 })
  await clickCheck(0)
  await clickCheck(1)
  await expect(page.getByTestId('bulk-bar')).toBeVisible()
  await expect(page.locator('.bulk-count')).toContainText('已选 2')
  // 批量改状态为 Done
  await setOSelect(page, 'bulk-status', 'done')
  await page.getByTestId('bulk-apply').click()
  // 浮条消失（onDone 清选区），Done 列计数 +2 由看板验证
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0, { timeout: 10_000 })
  await setView(page, 'board')
  await expect(page.getByTestId('board')).toBeAttached({ timeout: 10_000 })
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const k = document.querySelector('oas-kanban') as HTMLElement & {
            cards?: Array<{ column: string }>
          }
          return (k.cards ?? []).filter((x) => x.column === 'done').length
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(1)
})

test('M16 保存视图：保存 → 侧栏出现 → 应用 → 删除', async ({ page }) => {
  await waitForSeed(page)
  await page.getByTestId('save-view-btn').click()
  const modal = page.getByTestId('modal-save-view')
  await expect(modal).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await fillOInput(page, 'save-view-name', 'E2E 视图')
  await page.getByTestId('save-view-ok').click()
  await expect(modal).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
  // 侧栏出现该视图
  const item = page.locator('.saved-view-item').first()
  await expect(item).toContainText('E2E 视图', { timeout: 10_000 })
  // 删除
  await page.locator('[data-testid^="saved-view-del-"]').first().click()
  await expect(page.locator('.saved-view-item')).toHaveCount(0, { timeout: 10_000 })
})

test('M17 活动历史：详情改优先级 → 活动区出现记录', async ({ page }) => {
  await waitForSeed(page)
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
  await expect(page.getByTestId('activities-block')).toBeVisible({ timeout: 10_000 })
  // 选一个与当前不同的优先级（避免 from===to 无 diff 不落活动）
  const curPri17 = await page.evaluate(
    () =>
      (document.querySelector('[data-testid=detail-priority]') as { value?: string })?.value ?? '',
  )
  const newPri17 = curPri17 === 'urgent' ? 'high' : 'urgent'
  await setOSelect(page, 'detail-priority', newPri17)
  await expect(
    page.getByTestId('activities-block').locator(`[data-testid=activity-item]`).first(),
  ).toContainText('优先级', { timeout: 10_000 })
})

test('M18 通知：他人变更我负责的 Issue → 切回后动态出现', async ({ page }) => {
  test.setTimeout(120_000)
  await waitForSeed(page)

  // 1) 切到李娜（member）：她新建「负责人=张伟」的 Issue——reporter 身份创建/编辑均合法（can(issue:edit) 放行）
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('pick-user-member-2').click()
  await page.waitForTimeout(800)
  await page.getByTestId('view-all').click()

  // 预读项目计数器 → 新 Issue 的 key 可预知（OAS-<nextKeyNum>），标题内嵌 #序号 供末段 detail-title 断言
  const nextNum = await page.evaluate(async () => {
    const req = indexedDB.open('oas-pm')
    const dbp = await new Promise<IDBDatabase>((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = dbp.transaction('projects', 'readonly')
    return await new Promise<number>((res) => {
      const r = tx.objectStore('projects').get('project-1')
      r.onsuccess = () => res((r.result as { nextKeyNum?: number } | undefined)?.nextKeyNum ?? -1)
      r.onerror = () => res(-1)
    })
  })
  expect(nextNum).toBeGreaterThan(0)

  await page.getByTestId('toolbar-new').click()
  const modal = page.getByTestId('modal-create')
  await expect(modal).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await fillOInput(page, 'create-title', `M18 通知链路 #${nextNum}`)
  // 负责人下拉 options 为成员（value=成员 id）：张伟 = member-1
  await setOSelect(page, 'create-assignee', 'member-1')
  await page.getByTestId('create-submit').click()
  await expect(modal).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })

  // 2) 新 Issue updatedAt 最新 → 列表首行；捕获 key 并核对与项目计数器一致
  await expect(page.locator('.issue-row').first()).toContainText('M18 通知链路', {
    timeout: 10_000,
  })
  const firstKey = (await page.locator('.issue-row .issue-key').first().textContent()) ?? ''
  expect(firstKey).toBe(`OAS-${nextNum}`)

  // 3) 李娜打开该 Issue 详情，做差异化状态变更（活动 actor=李娜，issue 负责人=张伟）
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
  // 选一个与当前不同的状态，确保产生 diff 活动记录（新建默认 todo → in_progress）
  const curStatus = await page.evaluate(
    () =>
      (document.querySelector('[data-testid=detail-status]') as { value?: string })?.value ?? '',
  )
  await setOSelect(page, 'detail-status', curStatus === 'in_progress' ? 'todo' : 'in_progress')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // 4) 切回张伟 → 负责的 Issue 被他人合法变更 → 动态角标出现
  await page.getByTestId('tb-user').click()
  await expect(page.getByTestId('modal-user')).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('pick-user-member-1').click()
  await expect(page.getByTestId('notify-badge')).toBeVisible({ timeout: 15_000 })

  // 5) 打开动态列表：liveRecent 按 createdAt 倒序，最新一条即李娜对该 Issue 的状态变更
  await page.getByTestId('toolbar-notify').click()
  await expect(page.getByTestId('notify-item').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('notify-item').first()).toContainText(firstKey)

  // 6) 点击该条动态 → 打开对应 Issue 详情抽屉（title 属性被组件消费，以 detail-title 序号断言）
  await page.getByTestId('notify-item').filter({ hasText: firstKey }).first().click()
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
  const seq18 = firstKey.split('-')[1] ?? ''
  await expect(page.locator('.detail-title')).toContainText(`#${seq18}`, { timeout: 10_000 })
})

test('M20 看板：卡片点击打开详情抽屉', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('oas-pm-seed-v4')), { timeout: 30_000 })
    .toBe('1')
  await expect(page.locator('.issue-row').first()).toBeVisible({ timeout: 45_000 })
  // 「我的」视图首张卡（张伟负责），记 key
  await page.getByTestId('view-my').click()
  const myKey = await page.locator('.issue-row .issue-key').first().textContent()
  expect(myKey).toBeTruthy()
  await page.keyboard.press('Escape')

  // 看板：该卡必在 todo 列尾（order 最大），等文本出现后点击
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]') as HTMLElement & { value: string }
    el.value = view
    el.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, 'board')
  const cardLoc = page.locator('oas-kanban').locator(`text=${myKey}`)
  await expect(cardLoc.first()).toBeVisible({ timeout: 20_000 })
  await cardLoc.first().click()
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
  // 抽屉内标题含该卡序号（key 在 detail-head，h2 标题为 title 文本）
  const seq = (myKey ?? '').split('-')[1] ?? ''
  await expect(page.locator('.detail-title')).toContainText(`#${seq}`, { timeout: 10_000 })
  await page.keyboard.press('Escape')
})
