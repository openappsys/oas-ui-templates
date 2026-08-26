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

async function setLocal(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [
    key,
    value,
  ] as const)
}

test('admin 商品管理：卡片/列表双视图切换，列表含开关与操作列', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page.getByTestId('product-grid')).toContainText('无线降噪耳机')
  await expect(page.getByTestId('product-view')).toHaveAttribute('value', 'cards')

  await page.getByTestId('product-view').getByText('列表').click()
  await expect(page.getByTestId('product-view')).toHaveAttribute('value', 'table')
  await expect(page.getByTestId('product-table')).toBeVisible()
  await expect(page.getByTestId('product-table')).toContainText('无线降噪耳机')
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.products-view'))).toBe('table')

  await page.getByTestId('product-view').getByText('卡片').click()
  await expect(page.getByTestId('product-view')).toHaveAttribute('value', 'cards')
  await expect(page.getByTestId('product-grid')).toBeVisible()
  expect(errors).toEqual([])
})

test('admin 商品管理：dialog 模式下新建表单以对话框呈现', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await setLocal(page, 'oas-admin.form-mode', 'dialog')
  await page.locator('#nav').getByText('商品管理').click()
  await page.getByTestId('product-create').click()
  await expect(page.getByTestId('product-dialog')).toHaveAttribute('visible', '')
  await page.getByTestId('pf-save').click()
  await expect(page.locator('.error-text')).toContainText('请输入商品名称')
  await expect(page.getByTestId('product-dialog')).toHaveAttribute('visible', '')
  expect(errors).toEqual([])
})

test('admin 商品管理：page 模式下新建跳转整页表单', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await setLocal(page, 'oas-admin.form-mode', 'page')
  await page.locator('#nav').getByText('商品管理').click()
  await expect(page.getByTestId('product-create')).toBeVisible()
  await page.getByTestId('product-create').click()
  await expect(page).toHaveURL(/#\/products\/edit$/)
  await expect(page.getByTestId('pe-page-header')).toBeVisible()
  await page.getByTestId('pe-save').click()
  await expect(page.locator('.error-text')).toContainText('请输入商品名称')
  expect(errors).toEqual([])
})

test('设置中心：通用页切换表单呈现方式写入 localStorage', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('设置中心').click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'general')
  await page.getByTestId('form-mode-group').getByText('对话框').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.form-mode'))).toBe('dialog')
  await page.getByTestId('density-group').getByText('紧凑').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.table-density'))).toBe(
    'compact',
  )
  await page.getByTestId('font-size-group').getByText('特大').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.font-size'))).toBe('xl')
  expect(errors).toEqual([])
})

test('设置中心：字号较大档位写入 localStorage 且 reload 后保持选中', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('设置中心').click()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'general')
  await page.getByTestId('font-size-group').getByText('较大').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.font-size'))).toBe('lg')
  await page.reload()
  await expect(page.getByTestId('settings-tabs')).toHaveAttribute('active', 'general')
  await expect(page.locator('#font-size-group oas-radio[checked]')).toContainText('较大')
  await page.getByTestId('font-size-group').getByText('特大').click()
  expect(await page.evaluate(() => localStorage.getItem('oas-admin.settings.font-size'))).toBe('xl')
  expect(errors).toEqual([])
})

test('设置中心：外观页主题色即时作用于 --oas-color-primary', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '张伟', 'admin')
  await page.locator('#nav').getByText('设置中心').click()
  await page.getByTestId('settings-tabs').getByText('外观').click()
  const picker = page.getByTestId('appearance-color')
  await picker.locator('[part="trigger"]').click()
  await picker.locator('[part="preset"]').nth(1).click()
  const primary = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--oas-color-primary'),
  )
  expect(primary).toMatch(/^#[0-9a-f]{6}$/i)
  expect(errors).toEqual([])
})

test('viewer 可访问设置中心（不限角色）', async ({ page }) => {
  const errors = await noConsoleErrors(page)
  await login(page, '李四', 'viewer')
  await page.goto('/#/settings')
  await expect(page.getByTestId('settings-tabs')).toBeVisible()
  expect(errors).toEqual([])
})
