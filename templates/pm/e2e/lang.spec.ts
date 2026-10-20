import { expect, test, type Page } from '@playwright/test'

async function setView(page: Page, v: string) {
  await page.evaluate((view) => {
    const el = document.querySelector('[data-testid=view-seg]')
    ;(el as unknown as { value: string }).value = view
    el?.dispatchEvent(new CustomEvent('oas-change', { bubbles: true, detail: { value: view } }))
  }, v)
}

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

async function sortLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid=sort-by]') as
      | (HTMLElement & { options?: Array<{ label: string }> })
      | null
    return (el?.options ?? []).map((o) => o.label)
  })
}

test('L1 默认中文：关键文案为中文', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('view-seg')).toHaveAttribute('items', /列表/)
  await expect(page.getByTestId('toolbar-new')).toContainText('新建 Issue')
  await expect(page.getByTestId('toolbar-search')).toHaveAttribute('placeholder', /搜索 Key 或标题/)
  await expect.poll(() => sortLabels(page)).toContain('最近更新')
  await setView(page, 'dashboard')
  await expect(page.locator('.dash-page .page-h1')).toHaveText('仪表盘', { timeout: 10_000 })
})

test('L2 切换英文：文案变英文 + localStorage 持久化 + reload 保持 + 抽屉字段英文', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('lang-toggle').click()
  await expect(page.getByTestId('lang-toggle')).toHaveText('中')
  await expect(page.getByTestId('view-seg')).toHaveAttribute('items', /List/)
  await expect(page.getByTestId('toolbar-new')).toContainText('New Issue')
  await expect.poll(() => sortLabels(page)).toContain('Last updated')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('oas-pm-lang'))).toBe('en')
  await setView(page, 'dashboard')
  await expect(page.locator('.dash-page .page-h1')).toHaveText('Dashboard', { timeout: 10_000 })

  await setView(page, 'issues')
  await page.getByTestId('toolbar-new').click()
  const modal = page.getByTestId('modal-create')
  await expect(modal).toHaveAttribute('visible', /.*/, { timeout: 5000 })
  await page.getByTestId('create-submit').click()
  await expect(page.getByTestId('create-error')).toHaveText('Title is required')
  await fillOInput(page, 'create-title', 'Lang E2E Issue')
  await page.getByTestId('create-submit').click()
  await expect(modal).not.toHaveAttribute('visible', /.*/, { timeout: 5000 })
  const row = page.locator('.issue-row', { hasText: 'Lang E2E Issue' }).first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.click()
  const drawer = page.getByTestId('detail-drawer')
  await expect(drawer.locator('.detail-title')).toContainText('Lang E2E Issue', {
    timeout: 10_000,
  })
  const fieldLabels = await drawer.locator('.detail-field > span').allTextContents()
  expect(fieldLabels).toContain('Status')
  expect(fieldLabels).toContain('Priority')
  expect(fieldLabels).toContain('Assignee')
  expect(fieldLabels).toContain('Due date')
  await page.keyboard.press('Escape')

  await page.reload()
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('toolbar-new')).toContainText('New Issue')
  await expect(page.getByTestId('view-seg')).toHaveAttribute('items', /Board/)
})

test('L3 切回中文：文案恢复且结束时 lang=zh', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByTestId('pm-toolbar')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('lang-toggle').click()
  await expect(page.getByTestId('lang-toggle')).toHaveText('中')
  await page.getByTestId('lang-toggle').click()
  await expect(page.getByTestId('lang-toggle')).toHaveText('EN')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('oas-pm-lang'))).toBe('zh')
  await expect(page.getByTestId('view-seg')).toHaveAttribute('items', /列表/)
  await expect(page.getByTestId('toolbar-new')).toContainText('新建 Issue')
  await setView(page, 'dashboard')
  await expect(page.locator('.dash-page .page-h1')).toHaveText('仪表盘', { timeout: 10_000 })
})
