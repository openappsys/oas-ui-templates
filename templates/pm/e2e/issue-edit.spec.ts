import { expect, test, type Page } from '@playwright/test'

/** 详情抽屉编辑闭环：标题就地编辑（保存/取消）+ 描述编辑（放弃/快捷键保存） */

async function fillO(page: Page, testid: string, text: string) {
  await page.evaluate(
    ([tid, val]) => {
      const host = document.querySelector(`[data-testid="${tid}"]`) as HTMLElement & {
        value: string
      }
      const inner = host?.shadowRoot?.querySelector('input, textarea') as HTMLInputElement
      host.value = val as string
      if (inner) inner.value = val as string
      host?.dispatchEvent(new CustomEvent('oas-input', { bubbles: true, detail: { value: val } }))
    },
    [testid, text],
  )
}

/** 往 oas 组件派发 keydown：直接在 host 上发出（React 委托在 root，冒泡必达；
 *  真实按键从 shadow inner composed 穿界到达 host，对 handler 等价） */
async function pressKey(page: Page, testid: string, key: string, mods: { ctrl?: boolean } = {}) {
  await page.evaluate(
    ([tid, k, ctrl]) => {
      const host = document.querySelector(`[data-testid="${tid}"]`) as HTMLElement
      host.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: k as string,
          ctrlKey: ctrl as boolean,
          bubbles: true,
          composed: true,
          // 真实按键可取消；不可取消事件上 preventDefault 是 no-op，守卫链会失效
          cancelable: true,
        }),
      )
    },
    [testid, key, mods.ctrl ?? false],
  )
}

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('oas-pm-seed-size', '5000'))
  await page.goto('/')
  await page.waitForFunction(() => localStorage.getItem('oas-pm-seed-v11') === '1', {
    timeout: 180_000,
  })
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
}

async function openDrawer(page: Page) {
  await page
    .locator('.issue-row')
    .first()
    .evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  await expect
    .poll(async () => page.getByTestId('detail-drawer').getAttribute('visible'), {
      timeout: 10_000,
    })
    .not.toBeNull()
  await expect(page.getByTestId('detail-title')).toBeVisible({ timeout: 10_000 })
}

test('IE1 标题就地编辑：点击 → 输入框 → Enter 保存并持久', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await openDrawer(page)
  const original = await page.getByTestId('detail-title').textContent()
  expect(original).toBeTruthy()
  await page.getByTestId('detail-title').click()
  await expect(page.getByTestId('detail-title-input')).toBeVisible()
  // 进入编辑态应填入现值
  const filled = await page
    .getByTestId('detail-title-input')
    .evaluate((el) => (el as HTMLInputElement).value)
  expect(filled).toBe(original)
  await fillO(page, 'detail-title-input', `${original}（修订）`)
  await pressKey(page, 'detail-title-input', 'Enter')
  await expect(page.getByTestId('detail-title')).toHaveText(`${original}（修订）`, {
    timeout: 10_000,
  })
  // 保存是异步落库（Dexie Promise）；UI 即时反映但 reload 会打断未完成的写
  await page.waitForTimeout(500)
  // 刷新持久
  await page.reload()
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
  await openDrawer(page)
  await expect(page.getByTestId('detail-title')).toHaveText(`${original}（修订）`, {
    timeout: 10_000,
  })
})

test('IE2 标题 Esc 取消：回原值纯文本，抽屉不关', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await openDrawer(page)
  const original = (await page.getByTestId('detail-title').textContent()) ?? ''
  await page.getByTestId('detail-title').click()
  await expect(page.getByTestId('detail-title-input')).toBeVisible()
  await fillO(page, 'detail-title-input', '不应保存的标题')
  await pressKey(page, 'detail-title-input', 'Escape')
  await expect(page.getByTestId('detail-title')).toHaveText(original, { timeout: 10_000 })
  // 抽屉仍开（全局 Esc 守卫跳过 shadow 输入框，不触发关抽屉）
  await expect(page.getByTestId('detail-title')).toBeVisible()
})

test('IE3 描述放弃更改：取消回滚原文、脏态熄灭', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await openDrawer(page)
  const original = await page
    .getByTestId('detail-desc')
    .evaluate((el) => (el as HTMLTextAreaElement).value)
  await fillO(page, 'detail-desc', '这段编辑应当被放弃')
  await expect(page.getByTestId('detail-desc-save')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('detail-desc-cancel').click()
  // 回滚到库值 + 按钮组消失
  await expect
    .poll(
      async () =>
        page.getByTestId('detail-desc').evaluate((el) => (el as HTMLTextAreaElement).value),
      { timeout: 10_000 },
    )
    .toBe(original)
  await expect(page.getByTestId('detail-desc-save')).toHaveCount(0)
})

test('IE4 描述 Ctrl+Enter 保存', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await openDrawer(page)
  await fillO(page, 'detail-desc', '快捷键保存的描述内容')
  // 等脏态轮询（500ms）确认值已写入并出现保存按钮，再触发快捷键
  await expect(page.getByTestId('detail-desc-save')).toBeVisible({ timeout: 10_000 })
  await pressKey(page, 'detail-desc', 'Enter', { ctrl: true })
  await expect(page.getByTestId('detail-desc-save')).toHaveCount(0, { timeout: 10_000 })
  // 同 IE1：脏态熄灭是同步的，落库是异步——reload 前给写窗口
  await page.waitForTimeout(500)
  // 持久：刷新后值仍在
  await page.reload()
  await page.waitForSelector('.issue-row', { timeout: 20_000 })
  await openDrawer(page)
  await expect
    .poll(
      async () =>
        page.getByTestId('detail-desc').evaluate((el) => (el as HTMLTextAreaElement).value),
      { timeout: 10_000 },
    )
    .toBe('快捷键保存的描述内容')
})
