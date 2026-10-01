// e2e/advanced-form.spec.ts —— 高级表单 oas-form-list（项目经验）用例：
// min=1 行渲染与 {index} 索引化、增行、提交 values.projects 数组收集
import { expect, test, type Page } from '@playwright/test'

async function noConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

async function login(page: Page, name: string, role: 'admin' | 'viewer'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('login-name').locator('input').fill(name)
  if (role === 'viewer') {
    await page.getByTestId('login-role').click()
    await page.getByText('访客（只读）').click()
  }
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('stat-visits')).toBeVisible()
}

test('项目经验：form-list 行渲染与增行索引化', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/advanced-form')
  const list = page.locator('#advanced-form oas-form-list')
  await expect(list).toBeVisible()
  // min=1 → 初始一行，行内字段 name 经 {index} 索引化
  await expect(list.locator('[data-oas-form-list-item]')).toHaveCount(1)
  await expect(
    list.locator('[data-oas-form-list-item]').first().locator('oas-input[name="projects[0].name"]'),
  ).toBeVisible()
  await expect(
    list.locator('[data-oas-form-list-item]').first().locator('oas-input[name="projects[0].role"]'),
  ).toBeVisible()
  // 增行：第二行 name 索引 +1
  await page.locator('#advanced-form oas-form-list').getByRole('button', { name: '添加' }).click()
  await expect(list.locator('[data-oas-form-list-item]')).toHaveCount(2)
  await expect(list.locator('oas-input[name="projects[1].name"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('项目经验：提交 values.projects 数组收集', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.goto('/#/advanced-form')
  const list = page.locator('#advanced-form oas-form-list')
  await expect(list).toBeVisible()
  // 挂 oas-submit 监听（在提交前）捕获 detail.values
  await page.evaluate(() => {
    ;(window as unknown as { __advVals: unknown }).__advVals = null
    document.getElementById('advanced-form')?.addEventListener('oas-submit', (e) => {
      ;(window as unknown as { __advVals: unknown }).__advVals = (
        e as CustomEvent<{ values: unknown }>
      ).detail.values
    })
  })
  await list.locator('oas-input[name="projects[0].name"]').locator('input').fill('CRM 系统')
  await list.locator('oas-input[name="projects[0].role"]').locator('input').fill('负责人')
  await page.locator('#advanced-form oas-form-list').getByRole('button', { name: '添加' }).click()
  await list.locator('oas-input[name="projects[1].name"]').locator('input').fill('数据中台')
  await list.locator('oas-input[name="projects[1].role"]').locator('input').fill('开发')
  // 必填三项（校验不过 oas-submit 不派发）
  await page.locator('#advanced-form oas-input[name="company"]').locator('input').fill('测试供应商')
  await page
    .locator('#advanced-form oas-input[name="creditCode"]')
    .locator('input')
    .fill('91330106MA27X8LT0A')
  await page.locator('#advanced-form oas-combobox[name="category"]').evaluate((el) => {
    el.setAttribute('value', 'electronics')
    el.dispatchEvent(
      new CustomEvent('oas-change', { detail: { value: 'electronics' }, bubbles: true }),
    )
  })
  await page.getByRole('button', { name: '提交登记' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __advVals: { projects?: unknown } }).__advVals),
    )
    .not.toBeNull()
  const values = await page.evaluate(
    () =>
      (window as unknown as { __advVals: { projects?: Array<Record<string, string>> } }).__advVals,
  )
  expect(values.projects).toEqual([
    { name: 'CRM 系统', role: '负责人' },
    { name: '数据中台', role: '开发' },
  ])
  expect(errors).toEqual([])
})
